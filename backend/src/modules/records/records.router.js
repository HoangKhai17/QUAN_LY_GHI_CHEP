const router     = require('express').Router()
const db         = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const connectors = require('../../connectors')
const logger     = require('../../config/logger')
const { logAudit }   = require('../../services/audit.service')
const docTypeSvc     = require('../../services/document-types.service')
const rfvService     = require('../../services/record-field-value.service')
const { mapValueToColumn } = require('../../services/extraction-normalizer.service')

router.use(requireAuth)

const VALID_STATUSES = ['new', 'reviewed', 'approved', 'flagged', 'deleted']

/**
 * Build an EXISTS subquery for a single field-value filter.
 * Mutates params array (push values) and returns the SQL fragment or null.
 *
 * Operators: gte / lte (numeric), from / to (date), like (text ILIKE), eq (auto-detect)
 */
function buildFvCondition(fieldKey, op, rawVal, params) {
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
  params.push(castVal)
  const valN = params.length

  return `EXISTS (
    SELECT 1 FROM record_field_values rfv_fv
    JOIN document_type_fields dtf_fv ON dtf_fv.id = rfv_fv.field_id
    WHERE rfv_fv.record_id = r.id
      AND dtf_fv.field_key = $${keyN}
      AND ${col} ${sqlOp} $${valN}
  )`
}

// ── POST /api/records ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { note, category_id, document_type_id, platform, sender_name } = req.body || {}

  if (!note?.trim() && !sender_name?.trim()) {
    return res.status(400).json({ error: 'Cần có ít nhất ghi chú hoặc tên người gửi' })
  }

  const VALID_PLATFORMS = ['telegram', 'zalo', 'manual']
  const plat = platform || 'manual'
  if (!VALID_PLATFORMS.includes(plat)) {
    return res.status(400).json({ error: `platform phải là một trong: ${VALID_PLATFORMS.join(', ')}` })
  }

  const { rows: [record] } = await db.query(
    `INSERT INTO records
       (note, category_id, document_type_id, platform, sender_name,
        sender_id, status, ocr_status, extraction_status, received_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5,
        $6, 'new', 'pending', 'done', NOW(), NOW(), NOW())
     RETURNING id, note, category_id, document_type_id, platform, sender_name, status, received_at`,
    [
      note?.trim() || null,
      category_id || null,
      document_type_id || null,
      plat,
      sender_name?.trim() || null,
      req.user.sub,
    ]
  )

  logAudit({
    userId: req.user.sub, action: 'create', resource: 'record', resourceId: record.id,
    newData: { note: record.note, platform: plat, sender_name: record.sender_name },
    req,
  })

  res.status(201).json(record)
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
    const q = `%${search.trim()}%`
    conditions.push(
      `(r.note ILIKE $${params.push(q)} OR r.sender_name ILIKE $${params.push(q)} OR r.ocr_text ILIKE $${params.push(q)})`
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
    page = 1, limit = 20,
  } = req.query

  const pageNum  = Math.max(1, parseInt(page)  || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset   = (pageNum - 1) * limitNum

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

  // search — full-text ILIKE across note, sender_name, ocr_text
  if (search?.trim()) {
    const q = `%${search.trim()}%`
    conditions.push(
      `(r.note ILIKE $${params.push(q)} OR r.sender_name ILIKE $${params.push(q)} OR r.ocr_text ILIKE $${params.push(q)})`
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
        const cond = buildFvCondition(fieldKey, op, rawVal, params)
        if (cond) conditions.push(cond)
      }
    }
  }

  const where       = `WHERE ${conditions.join(' AND ')}`
  const countParams = [...params]
  params.push(limitNum, offset)

  const { rows } = await db.query(
    `SELECT r.id, r.platform, r.sender_id, r.sender_name,
            r.image_url, r.image_thumbnail, r.ocr_text, r.note,
            r.status, r.flag_reason, r.category_id,
            c.name   AS category_name,  c.color AS category_color,
            r.ocr_status, r.ocr_confidence,
            r.document_type_id, r.extraction_status, r.classification_confidence,
            dt.code  AS document_type_code,
            dt.name  AS document_type_name,
            r.received_at, r.created_at, r.updated_at
     FROM records r
     LEFT JOIN categories     c  ON r.category_id      = c.id
     LEFT JOIN document_types dt ON r.document_type_id = dt.id
     ${where}
     ORDER BY r.received_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*)::int FROM records r ${where}`,
    countParams
  )

  // Batch-attach field values when requested (document-type pivot view)
  let data = rows
  if (include_field_values === 'true' && rows.length > 0) {
    const fvMap = await rfvService.getForRecords(rows.map(r => r.id))
    data = rows.map(r => ({ ...r, field_values: fvMap[r.id] ?? {} }))
  }

  res.json({ data, total: count, page: pageNum, total_pages: Math.ceil(count / limitNum) })
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

module.exports = router
