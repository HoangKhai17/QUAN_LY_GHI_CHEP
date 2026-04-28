const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const db = require('../../config/db')
const authService = require('../../services/auth.service')
const { requireAuth } = require('../../middlewares/auth.middleware')
const logger = require('../../config/logger')
const { logAudit } = require('../../services/audit.service')

// 10 attempts per 15 min per IP — brute-force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  skipSuccessfulRequests: true,
})

function deviceHint(req) {
  return req.headers['user-agent']?.slice(0, 200) || null
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  const { username, password } = req.body || {}
  try {
    const result = await authService.login(username, password, deviceHint(req))
    logger.info('auth.login.success', { username, ip: req.ip })
    logAudit({ userId: result.user.id, action: 'login_success', resource: 'auth', req })
    res.json(result)
  } catch (err) {
    logger.warn('auth.login.failed', { username, ip: req.ip, status: err.status })
    logAudit({ action: err.status === 423 ? 'login_locked' : 'login_failed', resource: 'auth', newData: { username }, req })
    res.status(err.status || 500).json({ error: err.message || 'Login failed' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body || {}
  try {
    const tokens = await authService.refresh(refresh_token, deviceHint(req))
    res.json(tokens)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /api/auth/logout  (cần access token để biết revoke của user nào)
router.post('/logout', requireAuth, async (req, res) => {
  const { refresh_token } = req.body || {}
  try {
    await authService.logout(req.user.sub, refresh_token)
    logAudit({ userId: req.user.sub, action: 'logout', resource: 'auth', req })
    res.json({ success: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// POST /api/auth/logout-all  — kick tất cả thiết bị
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await authService.logoutAll(req.user.sub)
    res.json({ success: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, name, role, is_active,
              must_change_pw, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.sub]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Internal error' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {}
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' })
  }
  try {
    await authService.changePassword(req.user.sub, current_password, new_password)
    logger.info('auth.password_changed', { userId: req.user.sub })
    logAudit({ userId: req.user.sub, action: 'password_changed', resource: 'auth', req })
    res.json({ success: true })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

module.exports = router
