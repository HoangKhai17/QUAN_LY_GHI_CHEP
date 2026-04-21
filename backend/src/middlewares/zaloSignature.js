const crypto = require('crypto')
const env = require('../config/env')
const logger = require('../config/logger')

function verifyZaloSignature(req, res, next) {
  const signature = req.headers['x-zalo-signature']

  if (!env.zalo.webhookSecret) {
    logger.warn('zalo.signature.skip', { reason: 'ZALO_WEBHOOK_SECRET not set' })
    return next()
  }

  if (!signature) {
    return res.status(403).json({ error: 'Missing Zalo signature' })
  }

  const body = JSON.stringify(req.body)
  const expected = crypto
    .createHmac('sha256', env.zalo.webhookSecret)
    .update(body)
    .digest('hex')

  let isValid = false
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    isValid = false
  }

  if (!isValid) {
    logger.warn('zalo.signature.invalid', { ip: req.ip })
    return res.status(403).json({ error: 'Invalid Zalo signature' })
  }

  next()
}

module.exports = { verifyZaloSignature }
