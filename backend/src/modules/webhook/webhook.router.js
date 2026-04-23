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

  // Xác thực chữ ký TRƯỚC — verify() là synchronous nên không delay response
  let verified = false
  try {
    verified = connector.verify(req)
  } catch (err) {
    logger.error('webhook.verify_error', { platform, error: err.message })
    return res.status(403).json({ error: 'Verification error' })
  }
  if (!verified) {
    logger.warn('webhook.verify_failed', { platform, ip: req.ip })
    return res.status(403).json({ error: 'Invalid signature' })
  }

  // Trả về 200 ngay, không cache (tránh platform retry + tránh ETag 304)
  res.set('Cache-Control', 'no-store')
  res.json({ ok: true })

  const io = req.app.get('io')

  try {
    const messages = connector.parse(req.body)

    // Log chi tiết để debug group messages
    const updateKeys = Object.keys(req.body).filter(k => k !== 'update_id')
    logger.info('webhook.received', {
      platform,
      update_id: req.body.update_id,
      update_type: updateKeys[0] ?? 'unknown',
      chat_type: req.body.message?.chat?.type ?? req.body.channel_post?.chat?.type ?? 'n/a',
      parsed_count: messages.length,
    })

    if (messages.length === 0) {
      logger.warn('webhook.no_messages_parsed', {
        platform,
        update_type: updateKeys[0],
        note: 'Có thể do update type không phải image/text, hoặc bot privacy mode đang bật trong group',
      })
    }

    for (const msg of messages) {
      await processor.process(msg, connector, io)
    }
  } catch (err) {
    logger.error('webhook.process_error', { platform, error: err.message, stack: err.stack })
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
