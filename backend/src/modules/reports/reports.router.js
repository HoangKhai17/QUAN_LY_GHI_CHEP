/**
 * Reports Router — metadata-driven, no hard-coded "amount" assumptions.
 *
 * GET /api/reports/summary          — count by date/type/category/status/platform
 * GET /api/reports/financial        — sum aggregation_type='sum' fields (approved only)
 * GET /api/reports/by-type/:code    — per-document-type field aggregation
 *
 * All numeric aggregation reads from record_field_values joined with
 * document_type_fields.aggregation_type — never assumes a fixed column.
 *
 * Shared query params:
 *   date_from, date_to        — ISO date strings
 *   document_type_id          — UUID filter
 *   category_id               — UUID filter
 *   platform                  — 'telegram'|'zalo'
 *   include_unapproved=true   — include non-approved records (financial endpoints default to approved only)
 */

const router = require('express').Router()
const db     = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')

router.use(requireAuth)
router.use(requireRole('admin', 'manager'))

// ── Shared filter builder ─────────────────────────────────────────────────────
function buildFilters(query) {
  const { date_from, date_to, document_type_id, category_id, platform } = query
  const conditions = []
  const params     = []

  if (date_from)        conditions.push(`r.received_at >= $${params.push(date_from)}`)
  if (date_to)          conditions.push(`r.received_at <= ($${params.push(date_to)})::date + interval '1 day'`)
  if (document_type_id) conditions.push(`r.document_type_id = $${params.push(document_type_id)}::uuid`)
  if (category_id)      conditions.push(`r.category_id = $${params.push(category_id)}::uuid`)
  if (platform)         conditions.push(`r.platform = $${params.push(platform)}`)

  return { conditions, params }
}

// ── GET /api/reports/summary ──────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  const { conditions, params } = buildFilters(req.query)
  conditions.push(`r.status != 'deleted'`)
  const where = `WHERE ${conditions.join(' AND ')}`

  const [byStatus, byPlatform, byDocType, byCategory, timeline] = await Promise.all([
    db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM records r ${where} GROUP BY status ORDER BY count DESC`, params),
    db.query(
      `SELECT platform, COUNT(*)::int AS count
       FROM records r ${where} GROUP BY platform ORDER BY count DESC`, params),
    db.query(
      `SELECT dt.code, dt.name, COUNT(r.id)::int AS count
       FROM records r LEFT JOIN document_types dt ON r.document_type_id = dt.id
       ${where} GROUP BY dt.code, dt.name ORDER BY count DESC`, params),
    db.query(
      `SELECT c.name AS category_name, c.color, COUNT(r.id)::int AS count
       FROM records r LEFT JOIN categories c ON r.category_id = c.id
       ${where} GROUP BY c.name, c.color ORDER BY count DESC`, params),
    db.query(
      `SELECT received_at::date AS date, COUNT(*)::int AS count
       FROM records r ${where} GROUP BY received_at::date ORDER BY date`, params),
  ])

  res.json({
    by_status:        byStatus.rows,
    by_platform:      byPlatform.rows,
    by_document_type: byDocType.rows,
    by_category:      byCategory.rows,
    timeline:         timeline.rows,
  })
})

// ── GET /api/reports/financial ────────────────────────────────────────────────
router.get('/financial', async (req, res) => {
  const { include_unapproved } = req.query
  const { conditions, params } = buildFilters(req.query)

  conditions.push(include_unapproved === 'true' ? `r.status != 'deleted'` : `r.status = 'approved'`)
  const where = `WHERE ${conditions.join(' AND ')}`

  const { rows } = await db.query(
    `SELECT
       dt.code                 AS document_type_code,
       dt.name                 AS document_type_name,
       dtf.field_key,
       dtf.label               AS field_label,
       dtf.unit,
       COUNT(rfv.id)::int      AS record_count,
       SUM(rfv.value_number)   AS total,
       AVG(rfv.value_number)   AS average,
       MIN(rfv.value_number)   AS min,
       MAX(rfv.value_number)   AS max
     FROM records r
     JOIN document_types       dt  ON r.document_type_id = dt.id
     JOIN record_field_values  rfv ON rfv.record_id      = r.id
     JOIN document_type_fields dtf ON dtf.id             = rfv.field_id
     ${where}
       AND dtf.aggregation_type = 'sum'
       AND rfv.value_number IS NOT NULL
     GROUP BY dt.code, dt.name, dtf.field_key, dtf.label, dtf.unit
     ORDER BY dt.code, dtf.field_key`,
    params
  )

  const { rows: [{ count: totalRecords }] } = await db.query(
    `SELECT COUNT(*)::int AS count FROM records r ${where}`, params)

  res.json({ total_records: totalRecords, aggregations: rows })
})

// ── GET /api/reports/by-type/:code ────────────────────────────────────────────
router.get('/by-type/:code', async (req, res) => {
  const { rows: [docType] } = await db.query(
    `SELECT id, code, name FROM document_types WHERE code = $1 AND is_active = TRUE`,
    [req.params.code]
  )
  if (!docType) return res.status(404).json({ error: `Document type '${req.params.code}' not found` })

  const { include_unapproved } = req.query
  const { conditions, params } = buildFilters(req.query)

  conditions.push(`r.document_type_id = $${params.push(docType.id)}::uuid`)
  conditions.push(include_unapproved === 'true' ? `r.status != 'deleted'` : `r.status = 'approved'`)
  const where = `WHERE ${conditions.join(' AND ')}`

  const { rows: fieldDefs } = await db.query(
    `SELECT id, field_key, label, data_type, unit, aggregation_type
     FROM document_type_fields
     WHERE document_type_id = $1 AND is_reportable = TRUE ORDER BY display_order`,
    [docType.id]
  )

  const aggregations = []
  for (const f of fieldDefs) {
    const aggExpr = ['sum','avg','min','max'].includes(f.aggregation_type)
      ? `${f.aggregation_type.toUpperCase()}(rfv.value_number)`
      : `COUNT(rfv.id)::int`

    const fieldParams = [...params, f.id]
    const { rows: [agg] } = await db.query(
      `SELECT ${aggExpr} AS result, COUNT(rfv.id)::int AS count
       FROM records r
       JOIN record_field_values rfv ON rfv.record_id = r.id
       ${where} AND rfv.field_id = $${fieldParams.length}::uuid`,
      fieldParams
    )

    aggregations.push({
      field_key:        f.field_key,
      label:            f.label,
      data_type:        f.data_type,
      unit:             f.unit,
      aggregation_type: f.aggregation_type,
      result:           agg?.result ?? null,
      count:            agg?.count  ?? 0,
    })
  }

  const { rows: [{ count: totalRecords }] } = await db.query(
    `SELECT COUNT(*)::int AS count FROM records r ${where}`, params)

  res.json({ document_type: docType, total_records: totalRecords, aggregations })
})

// Keep old stubs so any existing integrations don't break with 404
router.post('/generate',    (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.get('/:id/download', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
