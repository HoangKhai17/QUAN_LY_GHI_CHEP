const jwt = require('jsonwebtoken')
const db = require('../config/db')
const env = require('../config/env')

/**
 * Verify JWT access token + check user is still active in DB.
 * DB hit mỗi request là trade-off chấp nhận được cho internal app traffic thấp.
 * Nếu sau này cần tối ưu: thêm Redis cache với TTL ngắn (30s).
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]
  let payload

  try {
    payload = jwt.verify(token, env.jwt.accessSecret)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const { rows } = await db.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    )
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    if (!rows[0].is_active) return res.status(403).json({ error: 'Account disabled' })

    // Gắn payload + role mới nhất từ DB (role có thể bị đổi sau khi token được cấp)
    req.user = { ...payload, role: rows[0].role }
    next()
  } catch {
    res.status(500).json({ error: 'Auth check failed' })
  }
}

module.exports = { requireAuth }
