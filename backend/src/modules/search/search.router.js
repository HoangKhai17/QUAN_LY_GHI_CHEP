const router = require('express').Router()
const db = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')

// GET /api/search
// Full-text search trên note + ocr_text + sender_name
// Dùng PostgreSQL GIN index đã có: idx_records_fts
router.get('/', requireAuth, async (req, res) => {
  const { q, sender_name, date_from, date_to, status, category_id, page = 1, limit = 20 } = req.query

  const pageNum  = Math.max(1, parseInt(page)  || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset   = (pageNum - 1) * limitNum

  const conditions = [`r.status != 'deleted'`]
  const params     = []

  if (q?.trim()) {
    // plainto_tsquery: tự xử lý dấu cách, không cần người dùng biết cú pháp tsquery
    conditions.push(
      `to_tsvector('simple',
         coalesce(r.note,'') || ' ' || coalesce(r.ocr_text,'') || ' ' || coalesce(r.sender_name,'')
       ) @@ plainto_tsquery('simple', $${params.push(q.trim())})`
    )
  }

  if (sender_name?.trim()) conditions.push(`r.sender_name ILIKE $${params.push('%' + sender_name.trim() + '%')}`)
  if (status)               conditions.push(`r.status = $${params.push(status)}`)
  if (category_id)          conditions.push(`r.category_id = $${params.push(category_id)}::uuid`)
  if (date_from)            conditions.push(`r.received_at >= $${params.push(date_from)}`)
  if (date_to)              conditions.push(`r.received_at <= ($${params.push(date_to)})::date + interval '1 day'`)

  const where       = `WHERE ${conditions.join(' AND ')}`
  const countParams = [...params]
  params.push(limitNum, offset)

  const { rows } = await db.query(
    `SELECT r.id, r.platform, r.sender_name,
            r.image_thumbnail, r.note, r.ocr_text,
            r.status, r.category_id,
            c.name AS category_name, c.color AS category_color,
            r.received_at
     FROM records r
     LEFT JOIN categories c ON r.category_id = c.id
     ${where}
     ORDER BY r.received_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*)::int FROM records r ${where}`,
    countParams
  )

  res.json({ data: rows, total: count, page: pageNum, total_pages: Math.ceil(count / limitNum), query: q || null })
})

module.exports = router
