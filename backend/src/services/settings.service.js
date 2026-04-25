/**
 * settings.service.js
 *
 * Read/write system_settings with AES-256-GCM encryption for secrets.
 * 60-second TTL in-process cache to avoid DB round-trips on every webhook/OCR call.
 *
 * Priority order for reads: DB value → .env fallback → null
 *
 * Env required for secret storage:
 *   SETTINGS_ENCRYPTION_KEY  — 64-char hex (32 bytes)
 *   Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require('crypto')
const db     = require('../config/db')
const logger = require('../config/logger')

const ALGO   = 'aes-256-gcm'
const TTL_MS = 60_000

// in-process TTL cache { key → { val, exp } }
const _cache = new Map()

function _encKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY || ''
  if (!hex) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY is not set in .env — generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return buf
}

function _encrypt(plaintext) {
  const key    = _encKey()
  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc    = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return {
    value_enc: enc.toString('hex'),
    value_iv:  iv.toString('hex'),
    value_tag: tag.toString('hex'),
  }
}

function _decrypt(value_enc, value_iv, value_tag) {
  try {
    const key      = _encKey()
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(value_iv, 'hex'))
    decipher.setAuthTag(Buffer.from(value_tag, 'hex'))
    const dec = Buffer.concat([
      decipher.update(Buffer.from(value_enc, 'hex')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  } catch {
    logger.error('settings.decrypt.failed')
    return null
  }
}

function _cacheGet(key) {
  const e = _cache.get(key)
  if (!e || Date.now() > e.exp) return undefined
  return e.val
}
function _cacheSet(key, val) { _cache.set(key, { val, exp: Date.now() + TTL_MS }) }
function _cacheInvalidate(key) { _cache.delete(key) }

// Mapping: setting key → env var name (fallback when DB has no value)
const ENV_MAP = {
  telegram_bot_token:      'TELEGRAM_BOT_TOKEN',
  telegram_webhook_secret: 'TELEGRAM_WEBHOOK_SECRET',
  zalo_oa_token:           'ZALO_OA_TOKEN',
  zalo_webhook_secret:     'ZALO_WEBHOOK_SECRET',
  gemini_api_key_primary:  'GEMINI_API_KEY',
  gemini_api_key_fallback: 'GEMINI_API_KEY_FALLBACK',
  gemini_model:            'GEMINI_MODEL',
  ai_fallback_enabled:     'AI_FALLBACK_ENABLED',
}

/**
 * Get a single decrypted setting value.
 * Returns null if not set in DB or env.
 */
async function getSetting(key) {
  const cached = _cacheGet(key)
  if (cached !== undefined) return cached

  try {
    const { rows } = await db.query(
      'SELECT value_plain, value_enc, value_iv, value_tag, is_secret FROM system_settings WHERE key = $1',
      [key]
    )
    const row = rows[0]
    let value = null

    if (row) {
      if (row.is_secret && row.value_enc) {
        value = _decrypt(row.value_enc, row.value_iv, row.value_tag)
      } else if (!row.is_secret && row.value_plain !== null) {
        value = row.value_plain
      }
    }

    if (value === null && ENV_MAP[key]) {
      value = process.env[ENV_MAP[key]] || null
    }

    _cacheSet(key, value)
    return value
  } catch (err) {
    logger.warn('settings.getSetting.failed', { key, error: err.message })
    // Fallback to env on DB error
    return process.env[ENV_MAP[key]] || null
  }
}

/**
 * Get all settings for admin display.
 * Secrets are masked ('●●●●●') if set — actual values never sent to frontend.
 */
async function getAllSettings() {
  const { rows } = await db.query('SELECT * FROM system_settings ORDER BY key')
  const result = {}

  for (const row of rows) {
    const envName = ENV_MAP[row.key]
    const inDb    = row.is_secret ? !!row.value_enc : row.value_plain !== null
    const inEnv   = !!(envName && process.env[envName])

    let displayValue = ''
    let source = 'none'

    if (inDb) {
      source = 'db'
      displayValue = row.is_secret ? '●●●●●' : row.value_plain
    } else if (inEnv) {
      source = 'env'
      displayValue = row.is_secret ? '●●●●●' : process.env[envName]
    }

    result[row.key] = {
      value:       displayValue,
      is_set:      inDb || inEnv,
      is_secret:   row.is_secret,
      source,
      description: row.description,
      updated_at:  row.updated_at,
    }
  }
  return result
}

/**
 * Set a setting value. Encrypts secrets automatically.
 * Throws { status: 400 } if key is not a known setting.
 */
async function setSetting(key, value, updatedBy) {
  const { rows } = await db.query(
    'SELECT is_secret FROM system_settings WHERE key = $1',
    [key]
  )
  if (!rows[0]) {
    const err = new Error(`Unknown setting key: ${key}`)
    err.status = 400
    throw err
  }

  if (rows[0].is_secret) {
    const { value_enc, value_iv, value_tag } = _encrypt(value)
    await db.query(
      `UPDATE system_settings
       SET value_enc = $1, value_iv = $2, value_tag = $3,
           value_plain = NULL, updated_by = $4, updated_at = NOW()
       WHERE key = $5`,
      [value_enc, value_iv, value_tag, updatedBy, key]
    )
  } else {
    await db.query(
      `UPDATE system_settings
       SET value_plain = $1, value_enc = NULL, value_iv = NULL, value_tag = NULL,
           updated_by = $2, updated_at = NOW()
       WHERE key = $3`,
      [value, updatedBy, key]
    )
  }

  _cacheInvalidate(key)
  logger.info('settings.set', { key, by: updatedBy })
}

/**
 * Clear a DB-stored setting value (reverts to .env fallback or null).
 */
async function clearSetting(key, updatedBy) {
  await db.query(
    `UPDATE system_settings
     SET value_plain = NULL, value_enc = NULL, value_iv = NULL, value_tag = NULL,
         updated_by = $1, updated_at = NOW()
     WHERE key = $2`,
    [updatedBy, key]
  )
  _cacheInvalidate(key)
  logger.info('settings.cleared', { key, by: updatedBy })
}

module.exports = { getSetting, getAllSettings, setSetting, clearSetting }
