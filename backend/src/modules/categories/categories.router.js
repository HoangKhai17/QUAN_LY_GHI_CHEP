const router = require('express').Router()
const db = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const { requireUUID } = require('../../middlewares/validators')

// GET /api/categories — tất cả user có thể xem (để chọn khi edit record)
router.get('/', requireAuth, async (req, res) => {
  const { include_inactive } = req.query
  const showAll = include_inactive === 'true' && ['admin', 'manager'].includes(req.user.role)

  const { rows } = await db.query(
    `SELECT id, name, description, color, is_active, created_at
     FROM categories
     ${showAll ? '' : 'WHERE is_active = TRUE'}
     ORDER BY name ASC`
  )
  res.json({ data: rows })
})

// POST /api/categories — admin/manager
router.post('/', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { name, description, color = '#1890ff' } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

  try {
    const { rows } = await db.query(
      `INSERT INTO categories (name, description, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, color, is_active, created_at`,
      [name.trim(), description?.trim() || null, color]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists' })
    throw err
  }
})

// PUT /api/categories/:id — admin/manager
router.put('/:id', requireAuth, requireUUID('id'), requireRole('admin', 'manager'), async (req, res) => {
  const { name, description, color, is_active } = req.body || {}

  const setClauses = []
  const params     = []

  if (name       !== undefined) setClauses.push(`name = $${params.push(name.trim())}`)
  if (description !== undefined) setClauses.push(`description = $${params.push(description?.trim() || null)}`)
  if (color      !== undefined) setClauses.push(`color = $${params.push(color)}`)
  if (is_active  !== undefined) setClauses.push(`is_active = $${params.push(Boolean(is_active))}`)

  if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' })

  params.push(req.params.id)
  const { rows, rowCount } = await db.query(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, description, color, is_active`,
    params
  )
  if (!rowCount) return res.status(404).json({ error: 'Category not found' })
  res.json(rows[0])
})

module.exports = router
