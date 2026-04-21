/**
 * MessageProcessor — xử lý NormalizedMessage từ bất kỳ platform nào.
 *
 * Pipeline:
 *   NormalizedMessage
 *     → upsert user
 *     → download & upload image (nếu có)
 *     → OCR (nếu có ảnh)
 *     → insert record vào DB
 *     → emit WebSocket event
 */
const db = require('../../config/db')
const logger = require('../../config/logger')
const ocrService = require('../../services/ocr.service')
const storageService = require('../../services/storage.service')

async function process(normalizedMsg, connector, io) {
  const {
    platform,
    platform_message_id,
    platform_user_id,
    sender_name,
    source_chat_id,
    source_chat_type,
    message_type,
    image_file_id,
    image_url,
    text_note,
    received_at,
  } = normalizedMsg

  const start = Date.now()
  logger.info('message.process.start', { platform, message_type, sender_name })

  try {
    // ── 1. Kiểm tra duplicate ──────────────────────────────────────
    const dup = await db.query(
      'SELECT id FROM records WHERE platform = $1 AND platform_message_id = $2',
      [platform, platform_message_id]
    )
    if (dup.rows.length > 0) {
      logger.info('message.process.duplicate', { platform, platform_message_id })
      return
    }

    // ── 2. Upsert user ────────────────────────────────────────────
    const userResult = await db.query(
      `INSERT INTO users (platform, platform_user_id, name, role)
       VALUES ($1, $2, $3, 'staff')
       ON CONFLICT (platform, platform_user_id)
         WHERE platform_user_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`,
      [platform, platform_user_id, sender_name]
    )
    const senderId = userResult.rows[0]?.id

    // ── 3. Download & upload ảnh ──────────────────────────────────
    let storedImageUrl = null
    let storedThumbnailUrl = null
    let ocrText = null
    let ocrStatus = 'pending'
    let ocrConfidence = null

    if (message_type !== 'text_only') {
      try {
        const buffer = await connector.downloadImage(image_file_id || image_url)
        const filename = `${platform}_${platform_message_id}_${Date.now()}.jpg`
        const uploaded = await storageService.uploadImage(buffer, filename)
        storedImageUrl = uploaded.image_url
        storedThumbnailUrl = uploaded.thumbnail_url

        // ── 4. OCR ────────────────────────────────────────────────
        if (storedImageUrl) {
          const ocrResult = await ocrService.extractText(storedImageUrl)
          ocrText = ocrResult.text
          ocrStatus = ocrResult.status
          ocrConfidence = ocrResult.confidence
        }
      } catch (err) {
        logger.warn('message.process.image_error', { error: err.message, platform })
        ocrStatus = 'failed'
      }
    } else {
      ocrStatus = 'success'
    }

    // ── 5. Insert record ──────────────────────────────────────────
    const { rows } = await db.query(
      `INSERT INTO records (
        platform, platform_message_id, sender_id, sender_name,
        source_chat_id, source_chat_type,
        image_url, image_thumbnail, ocr_text, note,
        ocr_status, ocr_confidence,
        status, received_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'new',$13)
      RETURNING id`,
      [
        platform, platform_message_id, senderId, sender_name,
        source_chat_id, source_chat_type,
        storedImageUrl, storedThumbnailUrl, ocrText, text_note,
        ocrStatus, ocrConfidence,
        received_at,
      ]
    )
    const recordId = rows[0].id

    const processingMs = Date.now() - start
    logger.info('message.process.done', { recordId, platform, processing_ms: processingMs })

    // ── 6. Emit WebSocket ─────────────────────────────────────────
    if (io) {
      io.emit('new_record', {
        record: { id: recordId, sender_name, platform, received_at, status: 'new' },
      })
    }
  } catch (err) {
    logger.error('message.process.failed', {
      error: err.message,
      platform,
      platform_message_id,
    })
    throw err
  }
}

module.exports = { process }
