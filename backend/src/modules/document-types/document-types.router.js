/**
 * Document Types Router
 *
 * GET    /api/document-types                   — list all active types (staff+)
 * GET    /api/document-types/:id               — single type with fields
 * GET    /api/document-types/:id/fields        — fields only
 *
 * POST   /api/document-types                   — create type  (admin/manager)
 * PATCH  /api/document-types/:id              — update type  (admin/manager)
 * POST   /api/document-types/:id/fields        — add field    (admin/manager)
 * PATCH  /api/document-types/:id/fields/:fid  — update field (admin/manager)
 * DELETE /api/document-types/:id/fields/:fid  — delete field (admin only)
 */

const router     = require('express').Router()
const db         = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const { requireUUID } = require('../../middlewares/validators')
const docTypeSvc = require('../../services/document-types.service')

router.use(requireAuth)

const VALID_DATA_TYPES = ['text', 'number', 'date', 'datetime', 'boolean', 'json', 'money']
const VALID_AGG_TYPES  = ['none', 'sum', 'avg', 'count', 'min', 'max']
const NUMERIC_AGG_TYPES = ['sum', 'avg', 'min', 'max']

// ── GET /api/document-types ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { include_inactive } = req.query
  const types = await docTypeSvc.getAll({ includeInactive: include_inactive === 'true' })
  const light = types.map(({ fields: _f, ...t }) => t)
  res.json({ data: light })
})

// ── GET /api/document-types/:id ───────────────────────────────────────────────
router.get('/:id', requireUUID('id'), async (req, res) => {
  const type = await docTypeSvc.getById(req.params.id)
  if (!type) return res.status(404).json({ error: 'Document type not found' })
  res.json(type)
})

// ── GET /api/document-types/:id/fields ───────────────────────────────────────
router.get('/:id/fields', requireUUID('id'), async (req, res) => {
  const type = await docTypeSvc.getById(req.params.id)
  if (!type) return res.status(404).json({ error: 'Document type not found' })
  res.json({ data: type.fields })
})

// ── POST /api/document-types ──────────────────────────────────────────────────
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { code, name, description, default_category_id, is_active = true } = req.body || {}

  if (!code?.trim()) return res.status(400).json({ error: 'code is required' })
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
  if (!/^[a-z][a-z0-9_]*$/.test(code.trim())) {
    return res.status(400).json({ error: 'code must start with a letter and contain only lowercase letters, digits, and underscores' })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO document_types (code, name, description, default_category_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code.trim(), name.trim(), description?.trim() || null, default_category_id || null, Boolean(is_active)]
    )
    docTypeSvc.invalidateCache()
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Document type code already exists' })
    throw err
  }
})

// ── PATCH /api/document-types/:id ────────────────────────────────────────────
router.patch('/:id', requireUUID('id'), requireRole('admin', 'manager'), async (req, res) => {
  const { name, description, is_active, default_category_id } = req.body || {}

  const setClauses = []
  const params     = []

  if (name               !== undefined) setClauses.push(`name = $${params.push(name.trim())}`)
  if (description        !== undefined) setClauses.push(`description = $${params.push(description?.trim() || null)}`)
  if (is_active          !== undefined) setClauses.push(`is_active = $${params.push(Boolean(is_active))}`)
  if (default_category_id !== undefined) setClauses.push(`default_category_id = $${params.push(default_category_id || null)}`)

  if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' })

  params.push(req.params.id)
  const { rows, rowCount } = await db.query(
    `UPDATE document_types SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  )
  if (!rowCount) return res.status(404).json({ error: 'Document type not found' })

  docTypeSvc.invalidateCache()
  res.json(rows[0])
})

// ── POST /api/document-types/:id/fields ──────────────────────────────────────
router.post('/:id/fields', requireUUID('id'), requireRole('admin', 'manager'), async (req, res) => {
  const {
    field_key, label, data_type,
    unit, is_required = false, is_filterable = false,
    is_reportable = false, aggregation_type = 'none', display_order = 0,
  } = req.body || {}

  if (!field_key?.trim())  return res.status(400).json({ error: 'field_key is required' })
  if (!label?.trim())      return res.status(400).json({ error: 'label is required' })
  if (!VALID_DATA_TYPES.includes(data_type)) {
    return res.status(400).json({ error: `data_type must be one of: ${VALID_DATA_TYPES.join(', ')}` })
  }
  if (!VALID_AGG_TYPES.includes(aggregation_type)) {
    return res.status(400).json({ error: `aggregation_type must be one of: ${VALID_AGG_TYPES.join(', ')}` })
  }
  if (NUMERIC_AGG_TYPES.includes(aggregation_type) && !['number', 'money'].includes(data_type)) {
    return res.status(400).json({ error: `${aggregation_type} aggregation is only supported for number/money fields` })
  }
  if (!/^[a-zA-Z0-9_]+$/.test(field_key.trim())) {
    return res.status(400).json({ error: 'field_key must contain only letters, digits, and underscores' })
  }

  // Verify parent type exists
  const type = await docTypeSvc.getById(req.params.id)
  if (!type) return res.status(404).json({ error: 'Document type not found' })

  try {
    const { rows } = await db.query(
      `INSERT INTO document_type_fields
         (document_type_id, field_key, label, data_type, unit,
          is_required, is_filterable, is_reportable, aggregation_type, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.params.id, field_key.trim(), label.trim(), data_type,
        unit?.trim() || null,
        Boolean(is_required), Boolean(is_filterable), Boolean(is_reportable),
        aggregation_type, parseInt(display_order) || 0,
      ]
    )
    docTypeSvc.invalidateCache()
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'field_key already exists for this document type' })
    throw err
  }
})

// ── PATCH /api/document-types/:id/fields/:fieldId ────────────────────────────
router.patch('/:id/fields/:fieldId', requireUUID('id', 'fieldId'), requireRole('admin', 'manager'), async (req, res) => {
  const { label, data_type, unit, is_required, is_filterable, is_reportable, aggregation_type, display_order } = req.body || {}

  const setClauses = []
  const params     = []

  let effectiveDataType = data_type
  if (aggregation_type !== undefined && effectiveDataType === undefined) {
    const { rows: [field] } = await db.query(
      `SELECT data_type FROM document_type_fields WHERE id = $1 AND document_type_id = $2`,
      [req.params.fieldId, req.params.id]
    )
    effectiveDataType = field?.data_type
  }

  if (label            !== undefined) setClauses.push(`label = $${params.push(label.trim())}`)
  if (data_type        !== undefined) {
    if (!VALID_DATA_TYPES.includes(data_type)) {
      return res.status(400).json({ error: `data_type must be one of: ${VALID_DATA_TYPES.join(', ')}` })
    }
    setClauses.push(`data_type = $${params.push(data_type)}`)
  }
  if (unit             !== undefined) setClauses.push(`unit = $${params.push(unit?.trim() || null)}`)
  if (is_required      !== undefined) setClauses.push(`is_required = $${params.push(Boolean(is_required))}`)
  if (is_filterable    !== undefined) setClauses.push(`is_filterable = $${params.push(Boolean(is_filterable))}`)
  if (is_reportable    !== undefined) setClauses.push(`is_reportable = $${params.push(Boolean(is_reportable))}`)
  if (display_order    !== undefined) setClauses.push(`display_order = $${params.push(parseInt(display_order) || 0)}`)
  if (aggregation_type !== undefined) {
    if (!VALID_AGG_TYPES.includes(aggregation_type)) {
      return res.status(400).json({ error: `aggregation_type must be one of: ${VALID_AGG_TYPES.join(', ')}` })
    }
    if (NUMERIC_AGG_TYPES.includes(aggregation_type) && !['number', 'money'].includes(effectiveDataType)) {
      return res.status(400).json({ error: `${aggregation_type} aggregation is only supported for number/money fields` })
    }
    setClauses.push(`aggregation_type = $${params.push(aggregation_type)}`)
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' })

  params.push(req.params.fieldId, req.params.id)
  const { rows, rowCount } = await db.query(
    `UPDATE document_type_fields SET ${setClauses.join(', ')}
     WHERE id = $${params.length - 1} AND document_type_id = $${params.length}
     RETURNING *`,
    params
  )
  if (!rowCount) return res.status(404).json({ error: 'Field not found' })

  docTypeSvc.invalidateCache()
  res.json(rows[0])
})

// ── DELETE /api/document-types/:id/fields/:fieldId ───────────────────────────
router.delete('/:id/fields/:fieldId', requireUUID('id', 'fieldId'), requireRole('admin'), async (req, res) => {
  const { rowCount } = await db.query(
    `DELETE FROM document_type_fields WHERE id = $1 AND document_type_id = $2`,
    [req.params.fieldId, req.params.id]
  )
  if (!rowCount) return res.status(404).json({ error: 'Field not found' })

  docTypeSvc.invalidateCache()
  res.json({ success: true })
})

module.exports = router
