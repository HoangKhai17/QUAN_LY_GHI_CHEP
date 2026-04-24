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

// ── GET /api/records ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    status, platform, sender_id, category_id,
    document_type_id, extraction_status,
    date_from, date_to,
    include_field_values,
    page = 1, limit = 20,
  } = req.query

  const pageNum  = Math.max(1, parseInt(page)  || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset   = (pageNum - 1) * limitNum

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` })
  }

  const conditions = []
  const params     = []

  if (status) {
    conditions.push(`r.status = $${params.push(status)}`)
  } else {
    conditions.push(`r.status != 'deleted'`)
  }

  if (platform)          conditions.push(`r.platform = $${params.push(platform)}`)
  if (sender_id)         conditions.push(`r.sender_id = $${params.push(sender_id)}::uuid`)
  if (category_id)       conditions.push(`r.category_id = $${params.push(category_id)}::uuid`)
  if (document_type_id)  conditions.push(`r.document_type_id = $${params.push(document_type_id)}::uuid`)
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
  res.json({ success: true })
})

module.exports = router
