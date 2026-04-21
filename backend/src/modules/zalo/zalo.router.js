const router = require('express').Router()
const { verifyZaloSignature } = require('../../middlewares/zaloSignature')
const logger = require('../../config/logger')

// TODO Phase 1: implement full Zalo message processing
router.post('/zalo', verifyZaloSignature, async (req, res) => {
  logger.info('zalo.webhook.received', { event: req.body?.event_name })
  // Trả về 200 ngay để Zalo không retry
  res.json({ error: 0, message: 'ok' })
})

module.exports = router
