const Sentry = require('@sentry/node')
const logger = require('../config/logger')
const env = require('../config/env')

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const internalMessage = err.message || 'Internal server error'

  logger.error('request.error', {
    status,
    message: internalMessage,
    path: req.path,
    method: req.method,
    stack: env.nodeEnv !== 'production' ? err.stack : undefined,
  })

  // Chỉ report lỗi 5xx lên Sentry (4xx là lỗi client, không phải bug)
  if (status >= 500 && process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: { path: req.path, method: req.method, status },
    })
  }

  // 5xx in production: return generic message to avoid leaking DB schema / stack details
  const clientMessage = (status >= 500 && env.nodeEnv === 'production')
    ? 'Internal server error'
    : internalMessage

  res.status(status).json({
    error: clientMessage,
    ...(env.nodeEnv !== 'production' && { stack: err.stack }),
  })
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
}

module.exports = { errorHandler, notFound }
