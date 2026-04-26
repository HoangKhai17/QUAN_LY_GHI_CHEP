const { Pool } = require('pg')
const env = require('./env')
const logger = require('./logger')

// Timezone áp dụng cho mọi session DB — đọc từ system_settings khi khởi động
let _appTimezone = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh'

const pool = new Pool({
  ...env.db,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => {
  logger.error('pg.pool.error', { error: err.message })
})

// Áp dụng timezone cho mọi connection mới từ pool
pool.on('connect', (client) => {
  client.query(`SET timezone = '${_appTimezone}'`).catch(err => {
    logger.warn('db.timezone.set.failed', { error: err.message })
  })
})

async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (duration > 1000) {
    logger.warn('db.slow_query', { duration_ms: duration, query: text.slice(0, 100) })
  }
  return res
}

/** Đọc timezone từ system_settings khi khởi động server */
async function loadTimezone() {
  try {
    const { rows } = await pool.query(
      "SELECT value_plain FROM system_settings WHERE key = 'app_timezone'"
    )
    if (rows[0]?.value_plain) {
      _appTimezone = rows[0].value_plain
      logger.info('db.timezone.loaded', { timezone: _appTimezone })
    }
  } catch (err) {
    logger.warn('db.timezone.load.failed', { error: err.message, fallback: _appTimezone })
  }
  return _appTimezone
}

/** Cập nhật timezone live (gọi khi admin đổi cài đặt) */
function setTimezone(tz) {
  _appTimezone = tz
  logger.info('db.timezone.updated', { timezone: tz })
}

function getTimezone() { return _appTimezone }

module.exports = { query, pool, loadTimezone, setTimezone, getTimezone }
