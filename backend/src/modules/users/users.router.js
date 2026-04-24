/**
 * Users Router — admin/manager quản lý tài khoản nội bộ.
 *
 * Không có public self-register.
 * Chỉ admin/manager tạo được user mới.
 * Chỉ admin reset password, deactivate, đổi role.
 */

const router = require('express').Router()
const db = require('../../config/db')
const authService = require('../../services/auth.service')
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const logger = require('../../config/logger')
const { logAudit } = require('../../services/audit.service')

const VALID_ROLES = ['staff', 'manager', 'admin']

// POST /api/users — admin hoặc manager tạo user nội bộ
router.post('/', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { username, name, role = 'staff', password } = req.body || {}

  if (!username || !name) {
    return res.status(400).json({ error: 'username and name are required' })
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'username must be 3–50 characters' })
  }
  // manager không được tạo admin
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can create admin accounts' })
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` })
  }
  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const tempPw = password || authService.generateTempPassword()
  const hash = await authService.hashPassword(tempPw)
  const safeUsername = username.trim().toLowerCase()

  try {
    const { rows } = await db.query(
      `INSERT INTO users (platform, username, password_hash, name, role, must_change_pw)
       VALUES ('web', $1, $2, $3, $4, TRUE)
       RETURNING id, username, name, role, is_active, created_at`,
      [safeUsername, hash, name.trim(), role]
    )
    logger.info('user.created', { by: req.user.sub, newUserId: rows[0].id, role })
    logAudit({ userId: req.user.sub, action: 'user_created', resource: 'users', resourceId: rows[0].id, newData: { username: safeUsername, role }, req })
    // temp_password chỉ trả về 1 lần, không lưu trong DB
    res.status(201).json({
      ...rows[0],
      temp_password: password ? undefined : tempPw,
    })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' })
    }
    throw err
  }
})

// GET /api/users/list — tất cả user đã login xem được, dùng cho dropdown chọn người gửi
router.get('/list', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, username, role FROM users WHERE is_active = TRUE ORDER BY name`
  )
  res.json({ data: rows })
})

// GET /api/users — admin hoặc manager xem danh sách
router.get('/', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { role, is_active, page = 1, limit = 20 } = req.query
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit))

  const conditions = []
  const params = []

  if (role) conditions.push(`role = $${params.push(role)}`)
  if (is_active !== undefined) conditions.push(`is_active = $${params.push(is_active === 'true')}`)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countParams = [...params]
  params.push(Math.min(100, parseInt(limit)))
  params.push(offset)

  const { rows } = await db.query(
    `SELECT id, username, name, role, is_active, last_login_at, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*)::int FROM users ${where}`,
    countParams
  )

  res.json({ data: rows, total: count, page: parseInt(page) })
})

// GET /api/users/:id — admin/manager HOẶC chính user đó
router.get('/:id', requireAuth, async (req, res) => {
  const isSelf = req.user.sub === req.params.id
  const isPrivileged = ['admin', 'manager'].includes(req.user.role)

  if (!isSelf && !isPrivileged) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { rows } = await db.query(
    `SELECT id, username, name, role, is_active,
            must_change_pw, last_login_at, created_at
     FROM users WHERE id = $1`,
    [req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json(rows[0])
})

// PATCH /api/users/:id/activate — chỉ admin
router.patch('/:id/activate', requireAuth, requireRole('admin'), async (req, res) => {
  const { is_active } = req.body || {}
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be boolean' })
  }
  if (req.user.sub === req.params.id && !is_active) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' })
  }

  const { rowCount } = await db.query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
    [is_active, req.params.id]
  )
  if (!rowCount) return res.status(404).json({ error: 'User not found' })

  if (!is_active) {
    await authService.logoutAll(req.params.id)
  }

  logger.info('user.activate_changed', { by: req.user.sub, target: req.params.id, is_active })
  logAudit({ userId: req.user.sub, action: is_active ? 'user_activated' : 'user_deactivated', resource: 'users', resourceId: req.params.id, req })
  res.json({ success: true })
})

// POST /api/users/:id/reset-password — chỉ admin
router.post('/:id/reset-password', requireAuth, requireRole('admin'), async (req, res) => {
  const tempPw = authService.generateTempPassword()
  const hash = await authService.hashPassword(tempPw)

  const { rowCount } = await db.query(
    `UPDATE users
     SET password_hash = $1, must_change_pw = TRUE,
         password_changed_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [hash, req.params.id]
  )
  if (!rowCount) return res.status(404).json({ error: 'User not found' })

  await authService.logoutAll(req.params.id)

  logger.info('user.password_reset', { by: req.user.sub, target: req.params.id })
  logAudit({ userId: req.user.sub, action: 'password_reset', resource: 'users', resourceId: req.params.id, req })
  res.json({ temp_password: tempPw })
})

// PATCH /api/users/:id/role — chỉ admin
router.patch('/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const { role } = req.body || {}
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` })
  }
  if (req.user.sub === req.params.id) {
    return res.status(400).json({ error: 'Cannot change your own role' })
  }

  const { rowCount } = await db.query(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
    [role, req.params.id]
  )
  if (!rowCount) return res.status(404).json({ error: 'User not found' })

  logger.info('user.role_changed', { by: req.user.sub, target: req.params.id, newRole: role })
  logAudit({ userId: req.user.sub, action: 'role_changed', resource: 'users', resourceId: req.params.id, newData: { role }, req })
  res.json({ success: true })
})

module.exports = router
