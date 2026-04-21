const { Pool } = require('pg')
const env = require('./env')
const logger = require('./logger')

const pool = new Pool({
  ...env.db,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => {
  logger.error('pg.pool.error', { error: err.message })
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

module.exports = { query, pool }
