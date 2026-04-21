const logger = require('../config/logger')
const env = require('../config/env')

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  logger.error('request.error', {
    status,
    message,
    path: req.path,
    method: req.method,
    stack: env.nodeEnv !== 'production' ? err.stack : undefined,
  })

  res.status(status).json({
    error: message,
    ...(env.nodeEnv !== 'production' && { stack: err.stack }),
  })
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
}

module.exports = { errorHandler, notFound }
