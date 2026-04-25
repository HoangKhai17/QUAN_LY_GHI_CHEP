const router     = require('express').Router()
const path       = require('path')
const db         = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const connectors = require('../../connectors')
const logger     = require('../../config/logger')
const { logAudit }   = require('../../services/audit.service')
const docTypeSvc     = require('../../services/document-types.service')
const rfvService     = require('../../services/record-field-value.service')
const { mapValueToColumn } = require('../../services/extraction-normalizer.service')
const storageSvc   = require('../../services/storage.service')
const ocrService   = require('../../services/ocr.service')
const { normalize } = require('../../services/extraction-normalizer.service')

const multer = require('multer')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, webp…)'))
    cb(null, true)
  },
})

router.use(requireAuth)

const VALID_STATUSES = ['new', 'reviewed', 'approved', 'flagged', 'deleted']

/**
 * Build an EXISTS subquery for a single field-value filter.
 * Mutates params array (push values) and returns the SQL fragment or null.
 *
 * Operators: gte / lte (numeric), from / to (date), like (text ILIKE), eq (auto-detect)
 */
function buildFvCondition(fieldKey, op, rawVal, params, documentTypeIds = []) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null
  if (!/^[a-zA-Z0-9_]+$/.test(fieldKey)) return null // safety

  let col, castVal, sqlOp

  if (op === 'gte' || op === 'lte') {
    const n = parseFloat(rawVal)
    if (isNaN(n)) return null
    col = 'rfv_fv.value_number'
    castVal = n
    sqlOp = op === 'gte' ? '>=' : '<='
  } else if (op === 'from' || op === 'to') {
    col = 'rfv_fv.value_date'
    castVal = rawVal
    sqlOp = op === 'from' ? '>=' : '<='
  } else if (op === 'like') {
    col = 'rfv_fv.value_text'
    castVal = `%${rawVal}%`
    sqlOp = 'ILIKE'
  } else { // eq
    const n = parseFloat(rawVal)
    if (!isNaN(n) && String(rawVal).trim() !== '') {
      col = 'rfv_fv.value_number'; castVal = n
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawVal)) {
      col = 'rfv_fv.value_date'; castVal = rawVal
    } else {
      col = 'rfv_fv.value_text'; castVal = rawVal
    }
    sqlOp = '='
  }

  params.push(fieldKey)
  const keyN = params.length
  const scopedTypeIds = Array.isArray(documentTypeIds)
    ? documentTypeIds.map(id => String(id).trim()).filter(Boolean)
    : []
  let typeScope = ''
  if (scopedTypeIds.length > 0) {
    params.push(scopedTypeIds)
    typeScope = ` AND document_type_id = ANY($${params.length}::uuid[])`
  }
  params.push(castVal)
  const valN = params.length

  // Resolve field_key → field_id via subquery (avoids JOIN at outer level)
  // document_type_fields is tiny; IN subquery uses idx_dtf_type_order
  return `EXISTS (
    SELECT 1 FROM record_field_values rfv_fv
    WHERE rfv_fv.record_id = r.id
      AND rfv_fv.field_id IN (SELECT id FROM document_type_fields WHERE field_key = $${keyN}${typeScope})
      AND ${col} ${sqlOp} $${valN}
  )`
}

// ── POST /api/records ─────────────────────────────────────────────────────────
router.post('/', upload.array('images', 3), async (req, res) => {
  const { note, category_id, document_type_id, platform, sender_name, sender_id } = req.body || {}

  if (!sender_name?.trim()) {
    return res.status(400).json({ error: 'Tên người gửi là bắt buộc' })
  }
  if (!note?.trim() && !(req.files?.length > 0)) {
    return res.status(400).json({ error: 'Vui lòng nhập ghi chú hoặc đính kèm ít nhất 1 ảnh' })
  }

  const VALID_PLATFORMS = ['telegram', 'zalo', 'manual']
  const plat = platform || 'manual'
  if (!VALID_PLATFORMS.includes(plat)) {
    return res.status(400).json({ error: `platform phải là một trong: ${VALID_PLATFORMS.join(', ')}` })
  }

  const hasImage    = req.files?.length > 0
  const initOcrSt   = hasImage ? 'pending' : 'success'
  const initExtrSt  = hasImage ? 'pending' : 'done'

  const { rows: [record] } = await db.query(
    `INSERT INTO records
       (note, category_id, document_type_id, platform, sender_name,
        sender_id, status, ocr_status, extraction_status, received_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5,
        $6, 'new', $7, $8, NOW(), NOW(), NOW())
     RETURNING id, note, category_id, document_type_id, platform, sender_name, status, received_at`,
    [
      note?.trim() || null,
      category_id || null,
      document_type_id || null,
      plat,
      sender_name.trim(),
      sender_id || req.user.sub,
      initOcrSt,
      initExtrSt,
    ]
  )

  // Upload first image to Cloudinary if provided
  let image_url = null, image_thumbnail = null
  if (hasImage) {
    try {
      const file = req.files[0]
      const ext  = path.extname(file.originalname || '.jpg') || '.jpg'
      const result = await storageSvc.uploadImage(file.buffer, `manual_${record.id}_${Date.now()}${ext}`)
      image_url       = result.image_url
      image_thumbnail = result.thumbnail_url
      await db.query(
        `UPDATE records SET image_url = $1, image_thumbnail = $2, image_key = $3 WHERE id = $4`,
        [image_url, image_thumbnail, image_url, record.id]
      )

      // Run OCR + normalization asynchronously — don't block the response
      const recordId = record.id
      setImmediate(async () => {
        // Phase 1: external calls (OCR + normalize) — outside any transaction
        let ocrResult, extraction = null
        try {
          ocrResult = await ocrService.extractText(image_url)
          if (ocrResult.status === 'success') {
            try { extraction = await normalize(ocrResult) } catch (normErr) {
              logger.warn('records.manual.normalize_error', { recordId, error: normErr.message })
            }
          }
        } catch (ocrErr) {
          logger.warn('records.manual.ocr_failed', { recordId, error: ocrErr.message })
          await db.query(
            `UPDATE records SET ocr_status = 'failed', extraction_status = 'failed', updated_at = NOW() WHERE id = $1`,
            [recordId]
          )
          return
        }

        // Phase 2: DB writes — wrapped in transaction so UPDATE + upsertMany are atomic
        const client = await db.pool.connect()
        try {
          await client.query('BEGIN')

          await client.query(
            `UPDATE records SET
               ocr_text = $1, ocr_status = $2, ocr_confidence = $3,
               document_type_id         = COALESCE($4, document_type_id),
               suggested_category_id    = COALESCE($5, suggested_category_id),
               classification_confidence = $6,
               extraction_status = $7, extracted_data = $8::jsonb,
               updated_at = NOW()
             WHERE id = $9`,
            [
              ocrResult.text,
              ocrResult.status,
              ocrResult.confidence,
              extraction?.document_type_id          ?? null,
              extraction?.suggested_category_id     ?? null,
              extraction?.classification_confidence ?? null,
              extraction?.extraction_status ?? (ocrResult.status === 'failed' ? 'failed' : 'done'),
              extraction?.extracted_data != null ? JSON.stringify(extraction.extracted_data) : null,
              recordId,
            ]
          )

          if (extraction?.fieldEntries?.length) {
            await rfvService.upsertMany(recordId, extraction.fieldEntries, client)
          }

          await client.query('COMMIT')
          logger.info('records.manual.ocr_done', { recordId, ocrStatus: ocrResult.status })
        } catch (dbErr) {
          await client.query('ROLLBACK').catch(() => {})
          logger.warn('records.manual.ocr_db_failed', { recordId, error: dbErr.message })
          await db.query(
            `UPDATE records SET ocr_status = 'failed', extraction_status = 'failed', updated_at = NOW() WHERE id = $1`,
            [recordId]
          )
        } finally {
          client.release()
        }
      })
    } catch (uploadErr) {
      logger.warn('records.manual.upload_failed', { recordId: record.id, error: uploadErr.message })
    }
  }

  logAudit({
    userId: req.user.sub, action: 'create', resource: 'record', resourceId: record.id,
    newData: { note: record.note, platform: plat, sender_name: record.sender_name },
    req,
  })

  res.status(201).json({ ...record, image_url, image_thumbnail })
})

// ── GET /api/records/years — distinct years that have records ─────────────────
router.get('/years', async (req, res) => {
  const { rows } = await db.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
     FROM records
     WHERE status != 'deleted'
     ORDER BY year DESC`
  )
  res.json({ data: rows.map(r => r.year) })
})

// ── GET /api/records/senders — distinct sender names for filter dropdown ──────
router.get('/senders', async (req, res) => {
  const { rows } = await db.query(
    `SELECT DISTINCT sender_name
     FROM records
     WHERE sender_name IS NOT NULL AND sender_name != '' AND status != 'deleted'
     ORDER BY sender_name
     LIMIT 200`
  )
  res.json({ data: rows.map(r => r.sender_name) })
})

// ── GET /api/records/stats — status breakdown for current filters ──────────────
router.get('/stats', async (req, res) => {
  const {
    platform, category_id, document_type_id, sender_name,
    search, date_from, date_to,
  } = req.query

  // Same filter logic as GET / but WITHOUT status filter so we always get full breakdown
  const conditions = [`r.status != 'deleted'`]
  const params     = []

  const platforms = platform
    ? platform.split(',').map(p => p.trim()).filter(Boolean) : []
  if (platforms.length > 0)
    conditions.push(`r.platform = ANY($${params.push(platforms)}::text[])`)

  const categoryIds = category_id
    ? category_id.split(',').map(c => c.trim()).filter(Boolean) : []
  if (categoryIds.length > 0)
    conditions.push(`r.category_id = ANY($${params.push(categoryIds)}::uuid[])`)

  const documentTypeIds = document_type_id
    ? document_type_id.split(',').map(d => d.trim()).filter(Boolean) : []
  if (documentTypeIds.length > 0)
    conditions.push(`r.document_type_id = ANY($${params.push(documentTypeIds)}::uuid[])`)

  const senderNames = sender_name
    ? sender_name.split(',').map(s => s.trim()).filter(Boolean) : []
  if (senderNames.length > 0)
    conditions.push(`r.sender_name = ANY($${params.push(senderNames)}::text[])`)

  if (search?.trim()) {
    conditions.push(
      `to_tsvector('simple', coalesce(r.note,'') || ' ' || coalesce(r.ocr_text,'') || ' ' || coalesce(r.sender_name,'')) @@ plainto_tsquery('simple', $${params.push(search.trim())})`
    )
  }
  if (date_from) conditions.push(`r.received_at >= $${params.push(date_from)}`)
  if (date_to)   conditions.push(`r.received_at <= ($${params.push(date_to)})::date + interval '1 day'`)

  const { rows } = await db.query(
    `SELECT r.status::text AS status, COUNT(*)::int AS count
     FROM records r
     WHERE ${conditions.join(' AND ')}
     GROUP BY r.status::text`,
    params
  )

  const counts = { new: 0, reviewed: 0, approved: 0, flagged: 0 }
  for (const row of rows) {
    if (row.status in counts) counts[row.status] = row.count
  }
  const total = counts.new + counts.reviewed + counts.approved + counts.flagged

  res.json({ ...counts, total })
})

// ── GET /api/records ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    status, platform, sender_id, category_id,
    document_type_id, extraction_status,
    search, sender_name,
    date_from, date_to,
    include_field_values,
    sort_order,
    page = 1, limit = 20,
  } = req.query

  const pageNum   = Math.max(1, parseInt(page)  || 1)
  const limitNum  = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset    = (pageNum - 1) * limitNum
  const orderDir  = sort_order === 'asc' ? 'ASC' : 'DESC'

  const conditions = []
  const params     = []

  // status — cast enum to text to avoid type mismatch with ANY()
  const statuses = status
    ? status.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s))
    : []
  if (statuses.length > 0) {
    conditions.push(`r.status::text = ANY($${params.push(statuses)}::text[])`)
  } else {
    conditions.push(`r.status != 'deleted'`)
  }

  // platform — text[], multi-value
  const platforms = platform
    ? platform.split(',').map(p => p.trim()).filter(Boolean)
    : []
  if (platforms.length > 0) {
    conditions.push(`r.platform = ANY($${params.push(platforms)}::text[])`)
  }

  // category_id — uuid[], multi-value
  const categoryIds = category_id
    ? category_id.split(',').map(c => c.trim()).filter(Boolean)
    : []
  if (categoryIds.length > 0) {
    conditions.push(`r.category_id = ANY($${params.push(categoryIds)}::uuid[])`)
  }

  // sender_name — multi-value exact match
  const senderNames = sender_name
    ? sender_name.split(',').map(s => s.trim()).filter(Boolean)
    : []
  if (senderNames.length > 0) {
    conditions.push(`r.sender_name = ANY($${params.push(senderNames)}::text[])`)
  }

  // search — full-text search via GIN index (idx_records_fts)
  if (search?.trim()) {
    conditions.push(
      `to_tsvector('simple', coalesce(r.note,'') || ' ' || coalesce(r.ocr_text,'') || ' ' || coalesce(r.sender_name,'')) @@ plainto_tsquery('simple', $${params.push(search.trim())})`
    )
  }

  if (sender_id) conditions.push(`r.sender_id = $${params.push(sender_id)}::uuid`)

  // document_type_id — uuid[], multi-value
  const documentTypeIds = document_type_id
    ? document_type_id.split(',').map(d => d.trim()).filter(Boolean)
    : []
  if (documentTypeIds.length > 0) {
    conditions.push(`r.document_type_id = ANY($${params.push(documentTypeIds)}::uuid[])`)
  }

  if (extraction_status) conditions.push(`r.extraction_status = $${params.push(extraction_status)}`)
  if (date_from)         conditions.push(`r.received_at >= $${params.push(date_from)}`)
  if (date_to)           conditions.push(`r.received_at <= ($${params.push(date_to)})::date + interval '1 day'`)

  // ── Dynamic field-value filters: ?fv[field_key][op]=value ──
  const fvFilters = req.query.fv
  if (fvFilters && typeof fvFilters === 'object') {
    for (const [fieldKey, ops] of Object.entries(fvFilters)) {
      if (!ops || typeof ops !== 'object') continue
      for (const [op, rawVal] of Object.entries(ops)) {
        const cond = buildFvCondition(fieldKey, op, rawVal, params, documentTypeIds)
        if (cond) conditions.push(cond)
      }
    }
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  params.push(limitNum, offset)

  // COUNT(*) OVER() piggybacks on the same query — eliminates a second round-trip
  const { rows } = await db.query(
    `SELECT r.id, r.platform, r.sender_id, r.sender_name,
            r.image_url, r.image_thumbnail, r.ocr_text, r.note,
            r.status, r.flag_reason, r.category_id,
            c.name   AS category_name,  c.color AS category_color,
            r.ocr_status, r.ocr_confidence,
            r.document_type_id, r.extraction_status, r.classification_confidence,
            dt.code  AS document_type_code,
            dt.name  AS document_type_name,
            r.received_at, r.created_at, r.updated_at,
            COUNT(*) OVER() AS _total
     FROM records r
     LEFT JOIN categories     c  ON r.category_id      = c.id
     LEFT JOIN document_types dt ON r.document_type_id = dt.id
     ${where}
     ORDER BY r.received_at ${orderDir}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const count = rows[0]?._total ?? 0

  // Batch-attach field values when requested (document-type pivot view)
  let data = rows
  if (include_field_values === 'true' && rows.length > 0) {
    const fvMap = await rfvService.getForRecords(rows.map(r => r.id))
    data = rows.map(r => ({ ...r, field_values: fvMap[r.id] ?? {} }))
  }

  res.json({ data, total: count, page: pageNum, total_pages: Math.ceil(count / limitNum) })
})

// Dynamic numeric aggregations for the same filters used by GET /api/records.
router.get('/aggregations', async (req, res) => {
  const {
    status, platform, sender_id, category_id,
    document_type_id, extraction_status,
    search, sender_name,
    date_from, date_to,
  } = req.query

  const conditions = []
  const params     = []

  const statuses = status
    ? status.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s))
    : []
  if (statuses.length > 0) {
    conditions.push(`r.status::text = ANY($${params.push(statuses)}::text[])`)
  } else {
    conditions.push(`r.status != 'deleted'`)
  }

  const platforms = platform
    ? platform.split(',').map(p => p.trim()).filter(Boolean)
    : []
  if (platforms.length > 0) {
    conditions.push(`r.platform = ANY($${params.push(platforms)}::text[])`)
  }

  const categoryIds = category_id
    ? category_id.split(',').map(c => c.trim()).filter(Boolean)
    : []
  if (categoryIds.length > 0) {
    conditions.push(`r.category_id = ANY($${params.push(categoryIds)}::uuid[])`)
  }

  const senderNames = sender_name
    ? sender_name.split(',').map(s => s.trim()).filter(Boolean)
    : []
  if (senderNames.length > 0) {
    conditions.push(`r.sender_name = ANY($${params.push(senderNames)}::text[])`)
  }

  if (search?.trim()) {
    conditions.push(
      `to_tsvector('simple', coalesce(r.note,'') || ' ' || coalesce(r.ocr_text,'') || ' ' || coalesce(r.sender_name,'')) @@ plainto_tsquery('simple', $${params.push(search.trim())})`
    )
  }

  if (sender_id) conditions.push(`r.sender_id = $${params.push(sender_id)}::uuid`)

  const documentTypeIds = document_type_id
    ? document_type_id.split(',').map(d => d.trim()).filter(Boolean)
    : []
  if (documentTypeIds.length > 0) {
    conditions.push(`r.document_type_id = ANY($${params.push(documentTypeIds)}::uuid[])`)
  }

  if (extraction_status) conditions.push(`r.extraction_status = $${params.push(extraction_status)}`)
  if (date_from)         conditions.push(`r.received_at >= $${params.push(date_from)}`)
  if (date_to)           conditions.push(`r.received_at <= ($${params.push(date_to)})::date + interval '1 day'`)

  const fvFilters = req.query.fv
  if (fvFilters && typeof fvFilters === 'object') {
    for (const [fieldKey, ops] of Object.entries(fvFilters)) {
      if (!ops || typeof ops !== 'object') continue
      for (const [op, rawVal] of Object.entries(ops)) {
        const cond = buildFvCondition(fieldKey, op, rawVal, params, documentTypeIds)
        if (cond) conditions.push(cond)
      }
    }
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const { rows } = await db.query(
    `SELECT
       dtf.field_key,
       dtf.label,
       dtf.data_type,
       dtf.unit,
       dtf.aggregation_type,
       COUNT(rfv.id)::int           AS value_count,
       SUM(rfv.value_number)::float AS sum,
       AVG(rfv.value_number)::float AS average,
       MIN(rfv.value_number)::float AS min,
       MAX(rfv.value_number)::float AS max
     FROM records r
     JOIN record_field_values  rfv ON rfv.record_id = r.id
     JOIN document_type_fields dtf ON dtf.id        = rfv.field_id
     ${where}
       AND dtf.is_reportable = TRUE
       AND dtf.aggregation_type != 'none'
       AND dtf.data_type IN ('number', 'money')
       AND rfv.value_number IS NOT NULL
     GROUP BY dtf.field_key, dtf.label, dtf.data_type, dtf.unit, dtf.aggregation_type, dtf.display_order
     ORDER BY dtf.display_order, dtf.field_key`,
    params
  )

  const aggregations = rows.map(row => {
    const result = row.aggregation_type === 'avg' ? row.average
      : row.aggregation_type === 'min' ? row.min
      : row.aggregation_type === 'max' ? row.max
      : row.aggregation_type === 'count' ? row.value_count
      : row.sum

    return {
      field_key:        row.field_key,
      label:            row.label,
      data_type:        row.data_type,
      unit:             row.unit,
      aggregation_type: row.aggregation_type,
      result,
      value_count:      row.value_count,
    }
  })

  res.json({ data: aggregations })
})

// ── GET /api/records/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*,
            u.username   AS sender_username,
            c.name       AS category_name,   c.color AS category_color,
            rb.name      AS reviewed_by_name,
            ab.name      AS approved_by_name,
            dt.code      AS document_type_code,
            dt.name      AS document_type_name,
            dt.description AS document_type_description
     FROM records r
     LEFT JOIN users         u  ON r.sender_id      = u.id
     LEFT JOIN categories    c  ON r.category_id    = c.id
     LEFT JOIN users         rb ON r.reviewed_by    = rb.id
     LEFT JOIN users         ab ON r.approved_by    = ab.id
     LEFT JOIN document_types dt ON r.document_type_id = dt.id
     WHERE r.id = $1 AND r.status != 'deleted'`,
    [req.params.id]
  )

  if (!rows[0]) return res.status(404).json({ error: 'Record not found' })
  const record = rows[0]

  // Attach field schema + values when a document type is assigned
  let fieldDefinitions = []
  let fieldValues      = {}

  if (record.document_type_id) {
    ;[fieldDefinitions, fieldValues] = await Promise.all([
      docTypeSvc.getFields(record.document_type_id),
      rfvService.getForRecord(record.id),
    ])
  }

  res.json({ ...record, field_definitions: fieldDefinitions, field_values: fieldValues })
})

// ── PATCH /api/records/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', requireRole('admin', 'manager'), async (req, res) => {
  const { status, flag_reason } = req.body || {}

  if (!status || !['reviewed', 'approved', 'flagged'].includes(status)) {
    return res.status(400).json({ error: 'status must be one of: reviewed, approved, flagged' })
  }
  if (status === 'flagged' && !flag_reason?.trim()) {
    return res.status(400).json({ error: 'flag_reason is required when status is flagged' })
  }

  const { rows: [record] } = await db.query(
    `SELECT id, platform, source_chat_id, sender_name, status, extraction_status
     FROM records WHERE id = $1 AND status != 'deleted'`,
    [req.params.id]
  )
  if (!record) return res.status(404).json({ error: 'Record not found' })

  const setClauses = ['status = $1', 'flag_reason = $2', 'updated_at = NOW()']
  const params     = [status, status === 'flagged' ? flag_reason : null]

  if (status === 'reviewed') {
    setClauses.push(`reviewed_by = $${params.push(req.user.sub)}`, 'reviewed_at = NOW()')
  } else if (status === 'approved') {
    setClauses.push(`approved_by = $${params.push(req.user.sub)}`, 'approved_at = NOW()')
    // On approve: mark extraction as done if it was still pending/needs_review
    if (['pending','needs_review'].includes(record.extraction_status)) {
      setClauses.push(`extraction_status = 'done'`)
    }
  }

  params.push(req.params.id)
  await db.query(
    `UPDATE records SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
    params
  )

  if (status === 'flagged' && record.source_chat_id) {
    setImmediate(async () => {
      try {
        const connector = connectors[record.platform]
        if (connector?.reply) {
          await connector.reply(
            record.source_chat_id,
            `⚠️ Ghi chép của ${record.sender_name} đã bị gắn cờ.\nLý do: ${flag_reason}`
          )
        }
      } catch (e) {
        logger.warn('records.flag.reply_failed', { recordId: req.params.id, error: e.message })
      }
    })
  }

  logAudit({
    userId: req.user.sub,
    action: status === 'flagged' ? 'flag' : status === 'approved' ? 'approve' : 'review',
    resource: 'record', resourceId: req.params.id,
    oldData: { status: record.status },
    newData: { status, flag_reason: flag_reason || null },
    req,
  })

  // Emit record_updated so all clients can sync their UI + pending count
  setImmediate(async () => {
    const io = req.app.get('io')
    if (!io) return
    try {
      const { rows: [{ pending }] } = await db.query(
        `SELECT COUNT(*)::int AS pending FROM records WHERE status = 'new'`
      )
      io.emit('record_updated', { record_id: req.params.id, new_status: status, pending })
    } catch { /* ignore — non-critical */ }
  })

  res.json({ success: true })
})

// ── PATCH /api/records/:id ────────────────────────────────────────────────────
// Accepts: note, category_id, document_type_id, field_values (object)
router.patch('/:id', async (req, res) => {
  const { note, category_id, document_type_id, field_values } = req.body || {}

  const hasScalarChange = note !== undefined || category_id !== undefined || document_type_id !== undefined
  const hasFieldValues  = field_values && typeof field_values === 'object' && Object.keys(field_values).length > 0

  if (!hasScalarChange && !hasFieldValues) {
    return res.status(400).json({ error: 'Provide at least one of: note, category_id, document_type_id, field_values' })
  }

  const { rows: [record] } = await db.query(
    `SELECT id, note, category_id, document_type_id FROM records
     WHERE id = $1 AND status != 'deleted'`,
    [req.params.id]
  )
  if (!record) return res.status(404).json({ error: 'Record not found' })

  const setClauses = ['updated_at = NOW()']
  const params     = []
  const changes    = []

  if (note !== undefined && note !== record.note) {
    setClauses.push(`note = $${params.push(note ?? null)}`)
    changes.push({ field: 'note', old: record.note, new: note })
  }
  if (category_id !== undefined && category_id !== record.category_id) {
    setClauses.push(`category_id = $${params.push(category_id || null)}`)
    changes.push({ field: 'category_id', old: record.category_id, new: category_id })
  }
  if (document_type_id !== undefined && document_type_id !== record.document_type_id) {
    setClauses.push(`document_type_id = $${params.push(document_type_id || null)}`)
    changes.push({ field: 'document_type_id', old: record.document_type_id, new: document_type_id })
  }

  // Apply scalar updates
  if (changes.length > 0) {
    params.push(req.params.id)
    await db.query(
      `UPDATE records SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    )

    for (const c of changes) {
      await db.query(
        `INSERT INTO edit_logs (record_id, edited_by, field_name, old_value, new_value)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, req.user.sub, c.field,
         c.old != null ? String(c.old) : null,
         c.new != null ? String(c.new) : null]
      )
    }
  }

  // Apply dynamic field value updates
  if (hasFieldValues) {
    // Determine which document_type to use (might have just been updated)
    const effectiveTypeId = document_type_id !== undefined
      ? (document_type_id || null)
      : record.document_type_id

    if (!effectiveTypeId) {
      return res.status(400).json({ error: 'document_type_id must be set before updating field_values' })
    }

    const fieldDefs = await docTypeSvc.getFields(effectiveTypeId)
    const defsByKey = Object.fromEntries(fieldDefs.map(f => [f.field_key, f]))

    const unknownKeys = Object.keys(field_values).filter(k => !defsByKey[k])
    if (unknownKeys.length > 0) {
      return res.status(400).json({ error: `Unknown field keys for this document type: ${unknownKeys.join(', ')}` })
    }

    for (const [key, rawVal] of Object.entries(field_values)) {
      const def   = defsByKey[key]
      const typed = mapValueToColumn(def.data_type, rawVal)
      await rfvService.updateSingle(
        req.params.id, def.id, key, typed, req.user.sub
      )
      changes.push({ field: `field:${key}`, old: '(prev)', new: String(rawVal ?? '') })
    }
  }

  if (changes.length === 0) return res.json({ success: true, changed: false })

  logAudit({
    userId: req.user.sub, action: 'edit', resource: 'record', resourceId: req.params.id,
    oldData: Object.fromEntries(changes.map(c => [c.field, c.old])),
    newData: Object.fromEntries(changes.map(c => [c.field, c.new])),
    req,
  })

  res.json({ success: true, changed: true })
})

// ── DELETE /api/records/:id ───────────────────────────────────────────────────
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { rowCount } = await db.query(
    `UPDATE records SET status = 'deleted', updated_at = NOW()
     WHERE id = $1 AND status != 'deleted'`,
    [req.params.id]
  )
  if (!rowCount) return res.status(404).json({ error: 'Record not found' })

  logAudit({ userId: req.user.sub, action: 'delete', resource: 'record', resourceId: req.params.id, req })

  // Notify all clients
  const io = req.app.get('io')
  if (io) io.emit('record_deleted', { record_id: req.params.id })

  res.json({ success: true })
})

router._private = { buildFvCondition }

module.exports = router
