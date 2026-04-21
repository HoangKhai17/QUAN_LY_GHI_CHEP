const router = require('express').Router()
const { getConnector, listPlatforms } = require('../../connectors')
const processor = require('./message.processor')
const logger = require('../../config/logger')

/**
 * POST /webhook/:platform
 *
 * Route chung xử lý webhook từ mọi platform.
 * Thêm platform mới chỉ cần: đăng ký connector trong connectors/index.js
 */
router.post('/:platform', async (req, res) => {
  const { platform } = req.params
  const connector = getConnector(platform)

  if (!connector) {
    logger.warn('webhook.unknown_platform', { platform, known: listPlatforms() })
    return res.status(404).json({ error: `Platform '${platform}' not supported` })
  }

  // Trả về 200 ngay cho Telegram/Zalo (tránh retry)
  res.json({ ok: true })

  // Xác thực chữ ký
  if (!connector.verify(req)) {
    logger.warn('webhook.verify_failed', { platform, ip: req.ip })
    return
  }

  const io = req.app.get('io')

  try {
    const messages = connector.parse(req.body)
    logger.info('webhook.received', { platform, count: messages.length })

    for (const msg of messages) {
      await processor.process(msg, connector, io)
    }
  } catch (err) {
    logger.error('webhook.process_error', { platform, error: err.message })
  }
})

/**
 * GET /webhook/platforms
 * Danh sách platform đang được hỗ trợ (dùng cho admin UI)
 */
router.get('/platforms', (req, res) => {
  res.json({ platforms: listPlatforms() })
})

module.exports = router
