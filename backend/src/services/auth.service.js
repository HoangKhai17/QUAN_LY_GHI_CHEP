/**
 * Auth Service — business logic cho toàn bộ authentication flow.
 *
 * Không chứa HTTP logic (req/res). Router gọi vào đây.
 *
 * Token model:
 *   access_token  — JWT ngắn hạn (15m), stateless
 *   refresh_token — opaque random 48 bytes, lưu sha256 hash trong DB
 *
 * Refresh token rotation:
 *   - Mỗi lần /refresh: token cũ bị revoke, token mới cùng family_id được cấp
 *   - Nếu token đã revoke bị dùng lại → revoke cả family (token theft detection)
 */

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const logger = require('../config/logger')
const env = require('../config/env')

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  )
}

function parseExpiryMs(expiresIn) {
  const match = String(expiresIn).match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 86400 * 1000
  const [, num, unit] = match
  const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return parseInt(num) * ms[unit]
}

async function issueTokenPair(user, familyId = null, deviceHint = null) {
  const rawRefresh = crypto.randomBytes(48).toString('hex')
  const tokenHash = hashToken(rawRefresh)
  const fid = familyId || uuidv4()
  const expiresAt = new Date(Date.now() + parseExpiryMs(env.jwt.refreshExpiresIn))

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, device_hint)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, fid, expiresAt, deviceHint]
  )

  return {
    access_token: generateAccessToken(user),
    refresh_token: rawRefresh,
  }
}

function err(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

// ── Public API ────────────────────────────────────────────────────────────────

async function login(username, password, deviceHint = null) {
  if (!username || !password) throw err(401, 'Invalid credentials')

  const { rows } = await db.query(
    `SELECT id, username, password_hash, name, role,
            is_active, login_attempts, locked_until, must_change_pw
     FROM users
     WHERE username = $1`,
    [username.trim().toLowerCase()]
  )

  const user = rows[0]

  // Constant-time: always run bcrypt even if user not found
  const hashForCompare = user?.password_hash || '$2a$10$invalidhashpadding.to.prevent.timing.attack.12345'
  const valid = await bcrypt.compare(password, hashForCompare)

  if (!user || !user.password_hash) throw err(401, 'Invalid credentials')

  if (!user.is_active) throw err(403, 'Account disabled')

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - Date.now()) / 60_000)
    throw err(423, `Account locked. Try again in ${minutesLeft} minute(s).`)
  }

  if (!valid) {
    const attempts = user.login_attempts + 1
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await db.query(
        `UPDATE users SET login_attempts = 0,
          locked_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'
         WHERE id = $1`,
        [user.id]
      )
      logger.warn('auth.login.locked', { userId: user.id })
    } else {
      await db.query('UPDATE users SET login_attempts = $1 WHERE id = $2', [attempts, user.id])
    }
    throw err(401, 'Invalid credentials')
  }

  // Success
  await db.query(
    `UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = NOW()
     WHERE id = $1`,
    [user.id]
  )

  const tokens = await issueTokenPair(user, null, deviceHint)

  return {
    ...tokens,
    user: { id: user.id, name: user.name, role: user.role, must_change_pw: user.must_change_pw },
  }
}

async function refresh(rawRefreshToken, deviceHint = null) {
  if (!rawRefreshToken) throw err(401, 'No refresh token provided')

  const tokenHash = hashToken(rawRefreshToken)

  const { rows } = await db.query(
    `SELECT rt.id, rt.family_id, rt.revoked_at, rt.expires_at,
            u.id AS uid, u.name, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  )

  const record = rows[0]
  if (!record) throw err(401, 'Invalid refresh token')

  // Reuse detection — token already revoked → possible theft
  if (record.revoked_at) {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [record.family_id]
    )
    logger.warn('auth.refresh.reuse_detected', { userId: record.uid, familyId: record.family_id })
    throw err(401, 'Session invalidated. Please login again.')
  }

  if (new Date(record.expires_at) < new Date()) throw err(401, 'Refresh token expired')

  if (!record.is_active) throw err(403, 'Account disabled')

  // Rotation: revoke old, issue new in same family
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id])

  const user = { id: record.uid, name: record.name, role: record.role }
  return issueTokenPair(user, record.family_id, deviceHint)
}

async function logout(userId, rawRefreshToken) {
  if (!rawRefreshToken) return
  const tokenHash = hashToken(rawRefreshToken)
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenHash, userId]
  )
}

async function logoutAll(userId) {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  )
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw err(400, 'Password must be at least 8 characters')
  }

  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  if (!rows[0]) throw err(404, 'User not found')

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash)
  if (!valid) throw err(401, 'Current password is incorrect')

  if (currentPassword === newPassword) {
    throw err(400, 'New password must differ from current password')
  }

  const newHash = await hashPassword(newPassword)
  await db.query(
    `UPDATE users
     SET password_hash = $1, password_changed_at = NOW(), must_change_pw = FALSE, updated_at = NOW()
     WHERE id = $2`,
    [newHash, userId]
  )

  await logoutAll(userId)
}

function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

module.exports = {
  login,
  refresh,
  logout,
  logoutAll,
  hashPassword,
  changePassword,
  generateTempPassword,
}
