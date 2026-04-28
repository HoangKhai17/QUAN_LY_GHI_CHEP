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
const { makeCacheMiddleware, clearAll } = require('../../middlewares/cache.middleware')
const { logAudit } = require('../../services/audit.service')
const rfvService = require('../../services/record-field-value.service')

router.use(requireAuth)
router.use(makeCacheMiddleware({ ttl: 60_000 }))

// ── Shared filter builder ─────────────────────────────────────────────────────
function buildFilters(query) {
  const { date_from, date_to, document_type_id, category_id, platform } = query
  const conditions = []
  const params     = []

  if (date_from)        conditions.push(`r.received_at::date >= $${params.push(date_from)}::date`)
  if (date_to)          conditions.push(`r.received_at::date <= $${params.push(date_to)}::date`)
  if (document_type_id) conditions.push(`r.document_type_id = $${params.push(document_type_id)}::uuid`)
  if (category_id)      conditions.push(`r.category_id = $${params.push(category_id)}::uuid`)
  if (platform)         conditions.push(`r.platform = $${params.push(platform)}`)

  return { conditions, params }
}

// ── GET /api/reports/summary (all authenticated users) ───────────────────────
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
      `SELECT received_at::date::text AS date, COUNT(*)::int AS count
       FROM records r ${where} GROUP BY 1 ORDER BY 1`, params),
  ])

  res.json({
    by_status:        byStatus.rows,
    by_platform:      byPlatform.rows,
    by_document_type: byDocType.rows,
    by_category:      byCategory.rows,
    timeline:         timeline.rows,
  })
})

// ── GET /api/reports/financial (admin/manager only) ──────────────────────────
router.get('/financial', requireRole('admin', 'manager'), async (req, res) => {
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

// ── GET /api/reports/by-type/:code (admin/manager only) ──────────────────────
router.get('/by-type/:code', requireRole('admin', 'manager'), async (req, res) => {
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

// ── GET /api/reports/staff (all authenticated users) ─────────────────────────
router.get('/staff', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    conditions.push(`r.sender_name IS NOT NULL`)
    conditions.push(`r.sender_name != ''`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const { rows: staff } = await db.query(
      `SELECT
         r.sender_name,
         MODE() WITHIN GROUP (ORDER BY r.platform)                                    AS user_platform,
         COUNT(r.id)::int                                                              AS total_sent,
         COUNT(CASE WHEN r.status = 'approved'             THEN 1 END)::int           AS approved,
         COUNT(CASE WHEN r.status = 'flagged'              THEN 1 END)::int           AS flagged,
         COUNT(CASE WHEN r.status IN ('new', 'reviewed')   THEN 1 END)::int           AS pending,
         ROUND(
           COUNT(CASE WHEN r.status = 'approved' THEN 1 END) * 100.0
           / NULLIF(COUNT(r.id), 0), 1
         )                                                                             AS approval_rate,
         MAX(r.received_at)                                                            AS last_activity
       FROM records r
       ${where}
       GROUP BY r.sender_name
       ORDER BY total_sent DESC`,
      params
    )

    const { rows: [{ count: total_records }] } = await db.query(
      `SELECT COUNT(*)::int AS count FROM records r ${where}`, params
    )

    res.json({ staff, total_records })
  } catch (err) {
    console.error('[reports/staff]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/heatmap ─────────────────────────────────────────────────
router.get('/heatmap', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const [byDate, byDowHour] = await Promise.all([
      db.query(
        `SELECT
           (r.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS date,
           COUNT(*)::int AS count
         FROM records r ${where}
         GROUP BY 1 ORDER BY 1`,
        params
      ),
      db.query(
        `SELECT
           EXTRACT(DOW  FROM r.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS dow,
           EXTRACT(HOUR FROM r.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
           COUNT(*)::int AS count
         FROM records r ${where}
         GROUP BY 1, 2 ORDER BY 1, 2`,
        params
      ),
    ])

    res.json({ by_date: byDate.rows, by_dow_hour: byDowHour.rows })
  } catch (err) {
    console.error('[reports/heatmap]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/quality ──────────────────────────────────────────────────
router.get('/quality', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const [summary, byDocType, bySender, byPlatform, ocrStatus] = await Promise.all([

      db.query(`
        SELECT
          COUNT(*)::int                                                               AS total_records,
          COUNT(CASE WHEN r.status = 'flagged'      THEN 1 END)::int                AS total_flagged,
          COUNT(CASE WHEN r.status = 'approved'     THEN 1 END)::int                AS total_approved,
          ROUND(COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)*100.0
            / NULLIF(COUNT(*),0), 1)                                                AS flag_rate,
          COUNT(CASE WHEN r.ocr_status = 'success'  THEN 1 END)::int               AS ocr_success,
          COUNT(CASE WHEN r.ocr_status = 'failed'   THEN 1 END)::int               AS ocr_failed,
          ROUND(COUNT(CASE WHEN r.ocr_status = 'success' THEN 1 END)*100.0
            / NULLIF(COUNT(CASE WHEN r.ocr_status IN ('success','failed') THEN 1 END),0), 1)
                                                                                    AS ocr_success_rate
        FROM records r ${where}`, params),

      db.query(`
        SELECT
          COALESCE(dt.code, '—')  AS code,
          COALESCE(dt.name, 'Chưa phân loại') AS name,
          COUNT(r.id)::int        AS total,
          COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)::int AS flagged,
          ROUND(COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)*100.0
            / NULLIF(COUNT(r.id),0), 1)                         AS flag_rate
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where}
        GROUP BY dt.code, dt.name
        ORDER BY flagged DESC, flag_rate DESC LIMIT 15`, params),

      db.query(`
        SELECT
          r.sender_name,
          COUNT(r.id)::int        AS total,
          COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)::int AS flagged,
          ROUND(COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)*100.0
            / NULLIF(COUNT(r.id),0), 1)                         AS flag_rate
        FROM records r ${where}
          AND r.sender_name IS NOT NULL AND r.sender_name != ''
        GROUP BY r.sender_name
        HAVING COUNT(CASE WHEN r.status = 'flagged' THEN 1 END) > 0
        ORDER BY flagged DESC, flag_rate DESC LIMIT 15`, params),

      db.query(`
        SELECT
          r.platform,
          COUNT(r.id)::int        AS total,
          COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)::int AS flagged,
          ROUND(COUNT(CASE WHEN r.status = 'flagged' THEN 1 END)*100.0
            / NULLIF(COUNT(r.id),0), 1)                         AS flag_rate
        FROM records r ${where}
        GROUP BY r.platform ORDER BY flagged DESC`, params),

      db.query(`
        SELECT
          COALESCE(r.ocr_status::text, 'n/a') AS status,
          COUNT(*)::int AS count
        FROM records r ${where}
        GROUP BY r.ocr_status ORDER BY count DESC`, params),
    ])

    res.json({
      ...summary.rows[0],
      by_document_type: byDocType.rows,
      by_sender:        bySender.rows,
      by_platform:      byPlatform.rows,
      ocr_status:       ocrStatus.rows,
    })
  } catch (err) {
    console.error('[reports/quality]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/sla ──────────────────────────────────────────────────────
router.get('/sla', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const slaConditions = [...conditions,
      `r.status = 'approved'`,
      `r.approved_at IS NOT NULL`,
      `r.approved_at > r.received_at`,
    ]
    const slaWhere = `WHERE ${slaConditions.join(' AND ')}`

    const [summary, histogram, byDocType, byPlatform, backlog] = await Promise.all([

      db.query(`
        SELECT
          COUNT(CASE WHEN r.status = 'approved' AND r.approved_at IS NOT NULL AND r.approved_at > r.received_at
            THEN 1 END)::int                                                             AS total_resolved,
          ROUND(AVG(CASE WHEN r.status = 'approved' AND r.approved_at IS NOT NULL AND r.approved_at > r.received_at
            THEN EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 END)::numeric, 1)
                                                                                         AS avg_hours,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
            CASE WHEN r.status = 'approved' AND r.approved_at IS NOT NULL AND r.approved_at > r.received_at
            THEN EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 END
          )::numeric, 1)                                                                 AS median_hours,
          COUNT(CASE WHEN r.status = 'approved' AND r.approved_at IS NOT NULL AND r.approved_at > r.received_at
            AND EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 <= 24
            THEN 1 END)::int                                                             AS within_24h,
          COUNT(CASE WHEN r.status = 'approved' AND r.approved_at IS NOT NULL AND r.approved_at > r.received_at
            AND EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 <= 48
            THEN 1 END)::int                                                             AS within_48h,
          COUNT(CASE WHEN r.status IN ('new','reviewed') THEN 1 END)::int               AS backlog_count
        FROM records r ${where}`, params),

      db.query(`
        SELECT bucket, COUNT(*)::int AS count
        FROM (
          SELECT
            CASE
              WHEN hrs < 1  THEN '< 1 giờ'
              WHEN hrs < 4  THEN '1 – 4 giờ'
              WHEN hrs < 24 THEN '4 – 24 giờ'
              WHEN hrs < 72 THEN '1 – 3 ngày'
              ELSE '> 3 ngày'
            END AS bucket,
            CASE
              WHEN hrs < 1  THEN 0
              WHEN hrs < 4  THEN 1
              WHEN hrs < 24 THEN 2
              WHEN hrs < 72 THEN 3
              ELSE 4
            END AS ord
          FROM (
            SELECT EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 AS hrs
            FROM records r ${slaWhere}
          ) t
        ) bucketed
        GROUP BY bucket, ord ORDER BY ord`, params),

      db.query(`
        SELECT
          COALESCE(dt.code, '—')               AS code,
          COALESCE(dt.name, 'Chưa phân loại')  AS name,
          COUNT(r.id)::int                      AS total,
          ROUND(AVG(EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600)::numeric, 1)
                                                AS avg_hours,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600
          )::numeric, 1)                        AS median_hours,
          COUNT(CASE WHEN EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600 <= 24
            THEN 1 END)::int                    AS within_24h
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${slaWhere}
        GROUP BY dt.code, dt.name
        ORDER BY avg_hours ASC`, params),

      db.query(`
        SELECT
          r.platform,
          COUNT(r.id)::int AS total,
          ROUND(AVG(EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600)::numeric, 1)
                           AS avg_hours,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600
          )::numeric, 1)   AS median_hours
        FROM records r ${slaWhere}
        GROUP BY r.platform ORDER BY avg_hours ASC`, params),

      db.query(`
        SELECT
          r.id,
          r.sender_name,
          r.status,
          r.received_at,
          r.platform,
          COALESCE(dt.name, 'Chưa phân loại') AS document_type_name,
          ROUND(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::int AS age_hours
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where} AND r.status IN ('new','reviewed')
        ORDER BY r.received_at ASC
        LIMIT 20`, params),
    ])

    const s            = summary.rows[0]
    const totalResolved = Number(s.total_resolved)
    res.json({
      total_resolved:   totalResolved,
      avg_hours:        s.avg_hours,
      median_hours:     s.median_hours,
      within_24h:       Number(s.within_24h),
      within_48h:       Number(s.within_48h),
      within_24h_pct:   totalResolved ? Math.round(Number(s.within_24h) / totalResolved * 100) : null,
      within_48h_pct:   totalResolved ? Math.round(Number(s.within_48h) / totalResolved * 100) : null,
      backlog_count:    Number(s.backlog_count),
      histogram:        histogram.rows,
      by_document_type: byDocType.rows,
      by_platform:      byPlatform.rows,
      backlog:          backlog.rows,
    })
  } catch (err) {
    console.error('[reports/sla]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/backlog ──────────────────────────────────────────────────
router.get('/backlog', async (req, res) => {
  try {
    const { platform, date_from, date_to, document_type_id } = req.query
    const conditions = [`r.status IN ('new','reviewed')`]
    const params     = []
    if (platform)         conditions.push(`r.platform = $${params.push(platform)}`)
    if (date_from)        conditions.push(`r.received_at::date >= $${params.push(date_from)}::date`)
    if (date_to)          conditions.push(`r.received_at::date <= $${params.push(date_to)}::date`)
    if (document_type_id) conditions.push(`r.document_type_id = $${params.push(document_type_id)}::uuid`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const [summary, ageBuckets, byDocType, bySender, records] = await Promise.all([

      db.query(`
        SELECT
          COUNT(*)::int                                                                AS total_backlog,
          COUNT(CASE WHEN r.status = 'new'      THEN 1 END)::int                     AS new_count,
          COUNT(CASE WHEN r.status = 'reviewed' THEN 1 END)::int                     AS reviewed_count,
          MAX(ROUND(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::int)           AS oldest_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::numeric, 1)   AS avg_wait_hours
        FROM records r ${where}`, params),

      db.query(`
        SELECT bucket, COUNT(*)::int AS count
        FROM (
          SELECT
            CASE
              WHEN hrs < 24  THEN '< 24 giờ'
              WHEN hrs < 72  THEN '1 – 3 ngày'
              WHEN hrs < 168 THEN '3 – 7 ngày'
              ELSE '> 7 ngày'
            END AS bucket,
            CASE
              WHEN hrs < 24  THEN 0
              WHEN hrs < 72  THEN 1
              WHEN hrs < 168 THEN 2
              ELSE 3
            END AS ord
          FROM (
            SELECT EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600 AS hrs
            FROM records r ${where}
          ) t
        ) b GROUP BY bucket, ord ORDER BY ord`, params),

      db.query(`
        SELECT
          COALESCE(dt.code,'—')              AS code,
          COALESCE(dt.name,'Chưa phân loại') AS name,
          COUNT(r.id)::int                   AS count,
          MAX(ROUND(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::int) AS oldest_hours,
          COUNT(CASE WHEN r.status = 'reviewed' THEN 1 END)::int            AS reviewed_count
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where}
        GROUP BY dt.code, dt.name ORDER BY count DESC LIMIT 10`, params),

      db.query(`
        SELECT
          r.sender_name,
          COUNT(r.id)::int AS count,
          MAX(ROUND(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::int) AS oldest_hours
        FROM records r ${where}
          AND r.sender_name IS NOT NULL AND r.sender_name != ''
        GROUP BY r.sender_name ORDER BY count DESC LIMIT 10`, params),

      db.query(`
        SELECT
          r.id, r.sender_name, r.status, r.received_at, r.platform,
          COALESCE(dt.name,'Chưa phân loại')                                AS document_type_name,
          ROUND(EXTRACT(EPOCH FROM (NOW() - r.received_at))/3600)::int     AS age_hours
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where}
        ORDER BY r.received_at ASC LIMIT 50`, params),
    ])

    const s = summary.rows[0]
    res.json({
      total_backlog:    Number(s.total_backlog),
      new_count:        Number(s.new_count),
      reviewed_count:   Number(s.reviewed_count),
      oldest_hours:     Number(s.oldest_hours),
      avg_wait_hours:   s.avg_wait_hours,
      age_buckets:      ageBuckets.rows,
      by_document_type: byDocType.rows,
      by_sender:        bySender.rows,
      records:          records.rows,
    })
  } catch (err) {
    console.error('[reports/backlog]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/doc-trend ────────────────────────────────────────────────
router.get('/doc-trend', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    const where = `WHERE ${conditions.join(' AND ')}`

    const [byDocType, timeline] = await Promise.all([

      db.query(`
        SELECT
          COALESCE(dt.code,'other')              AS code,
          COALESCE(dt.name,'Chưa phân loại')     AS name,
          COUNT(r.id)::int                       AS total,
          COUNT(CASE WHEN r.status = 'approved' THEN 1 END)::int  AS approved,
          COUNT(CASE WHEN r.status = 'flagged'  THEN 1 END)::int  AS flagged,
          ROUND(COUNT(CASE WHEN r.status = 'approved' THEN 1 END)*100.0
            / NULLIF(COUNT(r.id),0), 1)          AS approval_rate
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where}
        GROUP BY dt.code, dt.name ORDER BY total DESC LIMIT 8`, params),

      db.query(`
        WITH top_types AS (
          SELECT COALESCE(dt.code,'other') AS code
          FROM records r
          LEFT JOIN document_types dt ON r.document_type_id = dt.id
          ${where}
          GROUP BY COALESCE(dt.code,'other')
          ORDER BY COUNT(*) DESC LIMIT 5
        )
        SELECT
          r.received_at::date::text              AS date,
          COALESCE(dt.code,'other')              AS code,
          COALESCE(dt.name,'Chưa phân loại')     AS name,
          COUNT(r.id)::int                       AS count
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        ${where}
          AND COALESCE(dt.code,'other') IN (SELECT code FROM top_types)
        GROUP BY 1, dt.code, dt.name ORDER BY 1, dt.code`, params),
    ])

    res.json({ by_document_type: byDocType.rows, timeline: timeline.rows })
  } catch (err) {
    console.error('[reports/doc-trend]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/audit ────────────────────────────────────────────────────
router.get('/audit', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { date_from, date_to, user_id } = req.query
    const conditions = []
    const params     = []

    if (date_from) conditions.push(`al.created_at::date >= $${params.push(date_from)}::date`)
    if (date_to)   conditions.push(`al.created_at::date <= $${params.push(date_to)}::date`)
    if (user_id)   conditions.push(`al.user_id = $${params.push(user_id)}::uuid`)

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [summary, byAction, byUser, timeline, recentLogs] = await Promise.all([

      db.query(`
        SELECT
          COUNT(*)::int                                                     AS total_logs,
          COUNT(DISTINCT al.user_id)::int                                   AS unique_users,
          COUNT(CASE WHEN al.action IN ('delete','flag') THEN 1 END)::int   AS sensitive_count,
          MIN(al.created_at)                                                AS oldest_log,
          MAX(al.created_at)                                                AS newest_log
        FROM audit_logs al ${where}`, params),

      db.query(`
        SELECT
          al.action,
          COUNT(*)::int AS count
        FROM audit_logs al ${where}
        GROUP BY al.action ORDER BY count DESC`, params),

      db.query(`
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.role,
          COUNT(al.id)::int                 AS total_actions,
          COUNT(CASE WHEN al.action IN ('delete','flag') THEN 1 END)::int AS sensitive_count,
          MAX(al.created_at)                AS last_action_at
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
        GROUP BY u.id, u.name, u.username, u.role
        ORDER BY total_actions DESC LIMIT 20`, params),

      db.query(`
        SELECT
          al.created_at::date::text AS date,
          COUNT(*)::int             AS count
        FROM audit_logs al ${where}
        GROUP BY 1 ORDER BY 1`, params),

      db.query(`
        SELECT
          al.id,
          al.action,
          al.resource,
          al.resource_id,
          al.ip_address,
          al.created_at,
          COALESCE(u.name, u.username, 'Hệ thống') AS user_name,
          u.role                                         AS user_role
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
        ORDER BY al.created_at DESC LIMIT 100`, params),
    ])

    res.json({
      summary:     summary.rows[0],
      by_action:   byAction.rows,
      by_user:     byUser.rows,
      timeline:    timeline.rows,
      recent_logs: recentLogs.rows,
    })
  } catch (err) {
    console.error('[reports/audit]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/reports/audit/archive (admin-only) ──────────────────────────────
router.post('/audit/archive', requireRole('admin'), async (req, res) => {
  try {
    const months = Math.max(1, Math.min(60, Number(req.query.months ?? req.body?.months ?? 12)))
    const result = await db.query(`
      WITH moved AS (
        DELETE FROM audit_logs
        WHERE created_at < NOW() - ($1 || ' months')::interval
        RETURNING *
      )
      INSERT INTO audit_logs_archive
        (id, user_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent, created_at)
      SELECT id, user_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent, created_at
      FROM moved
      RETURNING id`, [months])

    clearAll()
    logAudit({
      userId: req.user.sub,
      action: 'audit_archived',
      resource: 'audit_logs',
      newData: { archived: result.rowCount, cutoff_months: months },
      req,
    })

    res.json({ archived: result.rowCount, cutoff_months: months })
  } catch (err) {
    console.error('[reports/audit/archive]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/export ───────────────────────────────────────────────────
const ExcelJS = require('exceljs')

const VALID_RECORD_EXPORT_STATUSES = ['new', 'reviewed', 'approved', 'flagged', 'deleted']

function _splitList(value) {
  return value ? String(value).split(',').map(v => v.trim()).filter(Boolean) : []
}

function _buildExportFvCondition(fieldKey, op, rawVal, params, documentTypeIds = []) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null
  if (!/^[a-zA-Z0-9_]+$/.test(fieldKey)) return null

  let col, castVal, sqlOp
  if (op === 'gte' || op === 'lte') {
    const n = parseFloat(rawVal)
    if (Number.isNaN(n)) return null
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
  } else {
    const n = parseFloat(rawVal)
    if (!Number.isNaN(n) && String(rawVal).trim() !== '') {
      col = 'rfv_fv.value_number'
      castVal = n
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawVal)) {
      col = 'rfv_fv.value_date'
      castVal = rawVal
    } else {
      col = 'rfv_fv.value_text'
      castVal = rawVal
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

  return `EXISTS (
    SELECT 1 FROM record_field_values rfv_fv
    WHERE rfv_fv.record_id = r.id
      AND rfv_fv.field_id IN (SELECT id FROM document_type_fields WHERE field_key = $${keyN}${typeScope})
      AND ${col} ${sqlOp} $${valN}
  )`
}

function _buildRecordExportWhere(query) {
  const {
    status, platform, sender_id, category_id,
    document_type_id, extraction_status,
    search, sender_name,
    date_from, date_to,
  } = query

  const conditions = []
  const params = []

  const statuses = _splitList(status).filter(s => VALID_RECORD_EXPORT_STATUSES.includes(s))
  if (statuses.length > 0) conditions.push(`r.status::text = ANY($${params.push(statuses)}::text[])`)
  else conditions.push(`r.status != 'deleted'`)

  const platforms = _splitList(platform)
  if (platforms.length > 0) conditions.push(`r.platform = ANY($${params.push(platforms)}::text[])`)

  const categoryIds = _splitList(category_id)
  if (categoryIds.length > 0) conditions.push(`r.category_id = ANY($${params.push(categoryIds)}::uuid[])`)

  const senderNames = _splitList(sender_name)
  if (senderNames.length > 0) conditions.push(`r.sender_name = ANY($${params.push(senderNames)}::text[])`)

  if (search?.trim()) {
    conditions.push(
      `to_tsvector('simple', coalesce(r.note,'') || ' ' || coalesce(r.ocr_text,'') || ' ' || coalesce(r.sender_name,'')) @@ plainto_tsquery('simple', $${params.push(search.trim())})`
    )
  }

  if (sender_id) conditions.push(`r.sender_id = $${params.push(sender_id)}::uuid`)

  const documentTypeIds = _splitList(document_type_id)
  if (documentTypeIds.length > 0) conditions.push(`r.document_type_id = ANY($${params.push(documentTypeIds)}::uuid[])`)

  if (extraction_status) conditions.push(`r.extraction_status = $${params.push(extraction_status)}`)
  if (date_from) conditions.push(`r.received_at::date >= $${params.push(date_from)}::date`)
  if (date_to) conditions.push(`r.received_at::date <= $${params.push(date_to)}::date`)

  const fvFilters = query.fv
  if (fvFilters && typeof fvFilters === 'object') {
    for (const [fieldKey, ops] of Object.entries(fvFilters)) {
      if (!ops || typeof ops !== 'object') continue
      for (const [op, rawVal] of Object.entries(ops)) {
        const cond = _buildExportFvCondition(fieldKey, op, rawVal, params, documentTypeIds)
        if (cond) conditions.push(cond)
      }
    }
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params, documentTypeIds }
}

const EXPORT_TYPE_LABELS = {
  records:   'Danh sách tài liệu',
  summary:   'Tổng hợp',
  financial: 'Tài chính',
  staff:     'Nhân viên',
  audit:     'Audit logs',
}

function _addInfoSheet(wb, { title, type, format, dateFrom, dateTo, filters = {}, rowCount = null } = {}) {
  const ws = wb.addWorksheet('Thông tin')
  ws.columns = [
    { key: 'label', width: 24 },
    { key: 'value', width: 54 },
  ]

  ws.mergeCells('A1:B1')
  const titleCell = ws.getCell('A1')
  titleCell.value = title || 'Báo cáo BBOTECH'
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F7A43' } }
  titleCell.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26

  const lines = [
    ['Loại báo cáo', EXPORT_TYPE_LABELS[type] || type],
    ['Định dạng', String(format || 'xlsx').toUpperCase()],
    ['Từ ngày', dateFrom || 'Không giới hạn'],
    ['Đến ngày', dateTo || 'Không giới hạn'],
    ['Nền tảng', filters.platform || 'Tất cả'],
    ['Trạng thái', filters.status || 'Tất cả'],
    ['Số dòng dữ liệu', rowCount == null ? 'Nhiều sheet' : rowCount],
    ['Xuất lúc', new Date()],
  ]

  lines.forEach(([label, value], idx) => {
    const row = ws.getRow(idx + 3)
    row.values = [label, value]
    row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } }
    row.getCell(2).font = { color: { argb: 'FF0F172A' } }
    row.getCell(2).alignment = { wrapText: true }
    if (value instanceof Date) row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm'
  })

  ws.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return
    row.height = 22
    row.eachCell(cell => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })

  return ws
}

function _addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name)
  ws.columns = columns.map(c => ({ key: c.key, header: c.header, width: c.width || 16 }))

  const hRow = ws.getRow(1)
  hRow.height = 28
  hRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    if (ci > columns.length) return
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A43' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border    = {
      top:    { style: 'thin',   color: { argb: 'FF155B32' } },
      left:   { style: 'thin',   color: { argb: 'FF155B32' } },
      bottom: { style: 'medium', color: { argb: 'FF155B32' } },
      right:  { style: 'thin',   color: { argb: 'FF155B32' } },
    }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  rows.forEach((rowData, i) => {
    const vals = columns.map(c => {
      const v = rowData[c.key]
      if (v == null) return ''
      if (c.isDate && v) return new Date(v)
      return v
    })
    const wsRow = ws.addRow(vals)
    wsRow.height = 22
    columns.forEach((c, ci) => {
      const cell = wsRow.getCell(ci + 1)
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      if (c.isDate) cell.numFmt = 'dd/mm/yyyy hh:mm'
      if (c.numFmt) cell.numFmt = c.numFmt
      if (c.align) cell.alignment = { ...cell.alignment, horizontal: c.align }
    })
    if (i % 2 === 1) {
      wsRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }
      })
    }
  })
  return ws
}

function _toCsv(columns, rows) {
  const header = columns.map(c => `"${c.header}"`).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const v = row[c.key]
      if (v == null) return '""'
      if (c.isDate && v) return `"${new Date(v).toLocaleString('vi-VN')}"`
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\r\n')
  return '\ufeff' + header + '\r\n' + body
}

async function _sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
  await wb.xlsx.write(res)
  return res.end()
}

router.get('/export', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { type = 'records', format = 'xlsx', status: statusFilter } = req.query
    const supportedTypes = new Set(['records', 'summary', 'financial', 'staff', 'audit'])
    const supportedFormats = new Set(['xlsx', 'csv'])
    if (!supportedTypes.has(type)) return res.status(400).json({ error: `Unknown export type: ${type}` })
    if (!supportedFormats.has(format)) return res.status(400).json({ error: `Unsupported export format: ${format}` })
    if (type === 'summary' && format !== 'xlsx') {
      return res.status(400).json({ error: 'Summary export chỉ hỗ trợ Excel (.xlsx)' })
    }

    const dateStr  = new Date().toISOString().slice(0, 10)
    const filename = `BBOTECH_${type}_${dateStr}`
    const { date_from: exportDateFrom, date_to: exportDateTo, platform } = req.query

    // ── Audit: uses audit_logs table, handled separately ─────────────────────
    if (type === 'audit') {
      const ac = [], ap = []
      const { date_from, date_to } = req.query
      if (date_from) ac.push(`al.created_at::date >= $${ap.push(date_from)}::date`)
      if (date_to)   ac.push(`al.created_at::date <= $${ap.push(date_to)}::date`)
      const aw = ac.length ? `WHERE ${ac.join(' AND ')}` : ''

      const { rows } = await db.query(`
        SELECT
          al.created_at,
          COALESCE(u.name, u.username, 'Hệ thống') AS user_name,
          u.role,
          al.action,
          al.resource,
          al.resource_id::text  AS resource_id,
          al.ip_address::text   AS ip_address
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${aw}
        ORDER BY al.created_at DESC
        LIMIT 100000`, ap)

      const cols = [
        { key: 'created_at',  header: 'Thời gian',    width: 22, isDate: true },
        { key: 'user_name',   header: 'Người dùng',   width: 22 },
        { key: 'role',        header: 'Vai trò',        width: 14 },
        { key: 'action',      header: 'Hành động',      width: 18 },
        { key: 'resource',    header: 'Đối tượng',      width: 16 },
        { key: 'resource_id', header: 'ID đối tượng',  width: 38 },
        { key: 'ip_address',  header: 'IP',             width: 16 },
      ]

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
        return res.send(_toCsv(cols, rows))
      }
      const wb = new ExcelJS.Workbook()
      wb.creator = 'BBOTECH'
      wb.created = new Date()
      _addInfoSheet(wb, {
        title: 'Báo cáo Audit logs',
        type, format,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        rowCount: rows.length,
      })
      _addSheet(wb, 'Audit Logs', cols, rows)
      return _sendWorkbook(res, wb, filename)
    }

    // ── All other types: based on records table ───────────────────────────────
    // ── records ───────────────────────────────────────────────────────────────
    if (type === 'records') {
      const { where, params, documentTypeIds } = _buildRecordExportWhere(req.query)
      const orderDir = req.query.sort_order === 'asc' ? 'ASC' : 'DESC'
      const { rows } = await db.query(`
        SELECT
          r.id,
          COALESCE(('REC-' || RIGHT(REPLACE(r.id::text, '-', ''), 8)), r.id::text) AS record_code,
          r.sender_name,
          r.platform,
          COALESCE(dt.name, 'Chưa phân loại')  AS document_type,
          COALESCE(cat.name, '—')               AS category,
          r.status,
          COALESCE(r.ocr_status::text, '—')     AS ocr_status,
          r.received_at,
          r.approved_at,
          r.note
        FROM records r
        LEFT JOIN document_types dt ON r.document_type_id = dt.id
        LEFT JOIN categories cat    ON r.category_id      = cat.id
        ${where}
        ORDER BY r.received_at ${orderDir}
        LIMIT 50000`, params)

      const cols = [
        { key: 'record_code',   header: 'Mã record',       width: 16 },
        { key: 'sender_name',   header: 'Người gửi',    width: 22 },
        { key: 'platform',      header: 'Nền tảng',      width: 14 },
        { key: 'document_type', header: 'Loại tài liệu', width: 26 },
        { key: 'category',      header: 'Danh mục',      width: 20 },
        { key: 'status',        header: 'Trạng thái',    width: 14 },
        { key: 'ocr_status',    header: 'OCR',           width: 14 },
        { key: 'received_at',   header: 'Nhận lúc',      width: 22, isDate: true },
        { key: 'approved_at',   header: 'Duyệt lúc',     width: 22, isDate: true },
        { key: 'note',          header: 'Ghi chú',       width: 34 },
      ]

      let exportRows = rows
      if (req.query.include_field_values === 'true' && rows.length > 0 && documentTypeIds.length > 0) {
        const fieldKeys = _splitList(req.query.field_keys)
        const fieldParams = []
        const fieldConds = []

        if (documentTypeIds.length > 0) {
          fieldConds.push(`document_type_id = ANY($${fieldParams.push(documentTypeIds)}::uuid[])`)
        }
        if (fieldKeys.length > 0) {
          fieldConds.push(`field_key = ANY($${fieldParams.push(fieldKeys)}::text[])`)
        }
        const fieldWhere = fieldConds.length ? `WHERE ${fieldConds.join(' AND ')}` : ''
        const { rows: fieldDefs } = await db.query(
          `SELECT field_key, label, data_type, unit
           FROM document_type_fields
           ${fieldWhere}
           ORDER BY display_order, field_key
           LIMIT 80`,
          fieldParams
        )

        if (fieldDefs.length > 0) {
          const fvMap = await rfvService.getForRecords(rows.map(r => r.id))
          exportRows = rows.map(row => {
            const next = { ...row }
            for (const f of fieldDefs) {
              next[`fv_${f.field_key}`] = fvMap[row.id]?.[f.field_key]?.value ?? ''
            }
            return next
          })
          cols.push(...fieldDefs.map(f => ({
            key: `fv_${f.field_key}`,
            header: f.unit ? `${f.label} (${f.unit})` : f.label,
            width: 20,
          })))
        }
      }

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
        return res.send(_toCsv(cols, exportRows))
      }
      const wb = new ExcelJS.Workbook()
      wb.creator = 'BBOTECH'
      wb.created = new Date()
      _addInfoSheet(wb, {
        title: 'Báo cáo danh sách tài liệu',
        type, format,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        filters: { platform, status: statusFilter },
        rowCount: exportRows.length,
      })
      _addSheet(wb, 'Danh sách tài liệu', cols, exportRows)
      return _sendWorkbook(res, wb, filename)
    }

    // ── summary (multi-sheet XLSX only) ───────────────────────────────────────
    const { conditions, params } = buildFilters(req.query)
    conditions.push(`r.status != 'deleted'`)
    if (statusFilter) conditions.push(`r.status = $${params.push(statusFilter)}`)
    const where = `WHERE ${conditions.join(' AND ')}`

    if (type === 'summary') {
      const [byStatus, byPlatform, byDocType, timeline] = await Promise.all([
        db.query(`
          SELECT status, COUNT(*)::int AS count
          FROM records r ${where}
          GROUP BY status ORDER BY count DESC`, params),
        db.query(`
          SELECT platform, COUNT(*)::int AS count
          FROM records r ${where}
          GROUP BY platform ORDER BY count DESC`, params),
        db.query(`
          SELECT
            COALESCE(dt.name, 'Chưa phân loại') AS name,
            COUNT(r.id)::int                     AS total,
            COUNT(CASE WHEN r.status='approved' THEN 1 END)::int AS approved,
            COUNT(CASE WHEN r.status='flagged'  THEN 1 END)::int AS flagged,
            ROUND(COUNT(CASE WHEN r.status='approved' THEN 1 END)*100.0
              / NULLIF(COUNT(r.id),0), 1)         AS approval_rate
          FROM records r
          LEFT JOIN document_types dt ON r.document_type_id = dt.id
          ${where}
          GROUP BY dt.name ORDER BY total DESC`, params),
        db.query(`
          SELECT r.received_at::date::text AS date, COUNT(*)::int AS count
          FROM records r ${where}
          GROUP BY 1 ORDER BY 1`, params),
      ])

      const wb = new ExcelJS.Workbook()
      wb.creator = 'BBOTECH'
      wb.created = new Date()
      _addInfoSheet(wb, {
        title: 'Báo cáo tổng hợp',
        type, format,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        rowCount: null,
      })
      _addSheet(wb, 'Theo trạng thái', [
        { key: 'status', header: 'Trạng thái', width: 18 },
        { key: 'count',  header: 'Số lượng',   width: 14 },
      ], byStatus.rows)
      _addSheet(wb, 'Theo nền tảng', [
        { key: 'platform', header: 'Nền tảng',  width: 18 },
        { key: 'count',    header: 'Số lượng',  width: 14 },
      ], byPlatform.rows)
      _addSheet(wb, 'Theo loại tài liệu', [
        { key: 'name',          header: 'Loại tài liệu',  width: 28 },
        { key: 'total',         header: 'Tổng',            width: 12 },
        { key: 'approved',      header: 'Đã duyệt',        width: 14 },
        { key: 'flagged',       header: 'Flagged',          width: 12 },
        { key: 'approval_rate', header: 'Tỷ lệ duyệt (%)', width: 18 },
      ], byDocType.rows)
      _addSheet(wb, 'Xu hướng theo ngày', [
        { key: 'date',  header: 'Ngày',     width: 14 },
        { key: 'count', header: 'Số lượng', width: 14 },
      ], timeline.rows)

      return _sendWorkbook(res, wb, filename)
    }

    // ── financial ─────────────────────────────────────────────────────────────
    if (type === 'financial') {
      const fc = [...conditions, `r.status = 'approved'`]
      const fw = `WHERE ${fc.join(' AND ')}`

      const { rows } = await db.query(`
        SELECT
          COALESCE(dt.name, 'Chưa phân loại')        AS document_type,
          dtf.label                                    AS field_name,
          COUNT(rfv.id)::int                           AS record_count,
          ROUND(SUM(rfv.value_number)::numeric, 2)    AS total,
          ROUND(AVG(rfv.value_number)::numeric, 2)    AS average,
          ROUND(MIN(rfv.value_number)::numeric, 2)    AS min_value,
          ROUND(MAX(rfv.value_number)::numeric, 2)    AS max_value
        FROM records r
        LEFT JOIN document_types dt       ON r.document_type_id = dt.id
        JOIN record_field_values rfv      ON rfv.record_id      = r.id
          AND rfv.value_number IS NOT NULL
        JOIN document_type_fields dtf     ON dtf.id             = rfv.field_id
          AND dtf.aggregation_type = 'sum'
        ${fw}
        GROUP BY dt.name, dtf.label
        ORDER BY dt.name, total DESC`, params)

      const cols = [
        { key: 'document_type', header: 'Loại tài liệu', width: 26 },
        { key: 'field_name',    header: 'Trường',          width: 22 },
        { key: 'record_count',  header: 'Số records',      width: 14 },
        { key: 'total',         header: 'Tổng cộng',       width: 18 },
        { key: 'average',       header: 'Trung bình',      width: 16 },
        { key: 'min_value',     header: 'Min',             width: 14 },
        { key: 'max_value',     header: 'Max',             width: 14 },
      ]

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
        return res.send(_toCsv(cols, rows))
      }
      const wb = new ExcelJS.Workbook()
      wb.creator = 'BBOTECH'
      wb.created = new Date()
      _addInfoSheet(wb, {
        title: 'Báo cáo tài chính',
        type, format,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        filters: { platform },
        rowCount: rows.length,
      })
      _addSheet(wb, 'Tổng hợp tài chính', cols, rows)
      return _sendWorkbook(res, wb, filename)
    }

    // ── staff ─────────────────────────────────────────────────────────────────
    if (type === 'staff') {
      const sw = `${where} AND r.sender_name IS NOT NULL AND r.sender_name != ''`

      const { rows } = await db.query(`
        SELECT
          r.sender_name                                                           AS name,
          r.platform,
          COUNT(r.id)::int                                                        AS total,
          COUNT(CASE WHEN r.status = 'approved'              THEN 1 END)::int    AS approved,
          COUNT(CASE WHEN r.status = 'flagged'               THEN 1 END)::int    AS flagged,
          COUNT(CASE WHEN r.status IN ('new','reviewed')     THEN 1 END)::int    AS pending,
          ROUND(COUNT(CASE WHEN r.status='approved' THEN 1 END)*100.0
            / NULLIF(COUNT(r.id),0), 1)                                          AS approval_rate,
          ROUND((AVG(EXTRACT(EPOCH FROM (r.approved_at - r.received_at))/3600)
            FILTER (WHERE r.approved_at IS NOT NULL AND r.approved_at > r.received_at))::numeric, 1) AS avg_hours
        FROM records r
        ${sw}
        GROUP BY r.sender_name, r.platform
        ORDER BY total DESC
        LIMIT 10000`, params)

      const cols = [
        { key: 'name',          header: 'Người gửi',       width: 22 },
        { key: 'platform',      header: 'Nền tảng',         width: 14 },
        { key: 'total',         header: 'Tổng records',     width: 16 },
        { key: 'approved',      header: 'Đã duyệt',         width: 14 },
        { key: 'flagged',       header: 'Flagged',           width: 12 },
        { key: 'pending',       header: 'Đang chờ',         width: 14 },
        { key: 'approval_rate', header: 'Tỷ lệ duyệt (%)', width: 18 },
        { key: 'avg_hours',     header: 'TB xử lý (giờ)',  width: 18 },
      ]

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
        return res.send(_toCsv(cols, rows))
      }
      const wb = new ExcelJS.Workbook()
      wb.creator = 'BBOTECH'
      wb.created = new Date()
      _addInfoSheet(wb, {
        title: 'Báo cáo nhân viên',
        type, format,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        filters: { platform },
        rowCount: rows.length,
      })
      _addSheet(wb, 'Nhân viên', cols, rows)
      return _sendWorkbook(res, wb, filename)
    }

    res.status(400).json({ error: `Unknown export type: ${type}` })
  } catch (err) {
    console.error('[reports/export]', err.message)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reports/audit/logs (admin only) ─────────────────────────────────
router.get('/audit/logs', requireRole('admin'), async (req, res) => {
  try {
    const {
      date_from, date_to, user_id, resource,
      action,   // comma-separated: approve,flag,delete
      search,   // tìm trong user name
      page  = 1,
      limit = 50,
    } = req.query

    const conditions = []
    const filterParams = []

    if (date_from) conditions.push(`al.created_at::date >= $${filterParams.push(date_from)}::date`)
    if (date_to)   conditions.push(`al.created_at::date <= $${filterParams.push(date_to)}::date`)
    if (user_id)   conditions.push(`al.user_id = $${filterParams.push(user_id)}::uuid`)
    if (resource)  conditions.push(`al.resource = $${filterParams.push(resource)}`)

    if (action) {
      const actions = action.split(',').map(a => a.trim()).filter(Boolean)
      if (actions.length) {
        const placeholders = actions.map(a => `$${filterParams.push(a)}`).join(', ')
        conditions.push(`al.action IN (${placeholders})`)
      }
    }

    if (search) {
      conditions.push(`u.name ILIKE $${filterParams.push(`%${search}%`)}`)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const lim    = Math.max(1, Math.min(200, Number(limit)))
    const offset = (Math.max(1, Number(page)) - 1) * lim

    const baseSQL = `FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${where}`

    const [dataRes, countRes] = await Promise.all([
      db.query(
        `SELECT
           al.id, al.user_id,
           u.name  AS user_name,
           u.role  AS user_role,
           al.action, al.resource, al.resource_id,
           al.old_data, al.new_data,
           al.ip_address, al.created_at
         ${baseSQL}
         ORDER BY al.created_at DESC
         LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
        [...filterParams, lim, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total ${baseSQL}`,
        filterParams
      ),
    ])

    const total = countRes.rows[0]?.total ?? 0
    res.json({
      data:        dataRes.rows,
      total,
      page:        Number(page),
      total_pages: Math.ceil(total / lim),
    })
  } catch (err) {
    console.error('[reports/audit/logs]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Keep old stubs so any existing integrations don't break with 404
router.post('/generate',    (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.get('/:id/download', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
