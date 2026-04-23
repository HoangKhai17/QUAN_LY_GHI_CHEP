/**
 * MessageProcessor — xử lý NormalizedMessage từ bất kỳ platform nào.
 *
 * Pipeline:
 *   NormalizedMessage
 *     → duplicate check
 *     → upsert user
 *     → download & upload image
 *     → OCR  (Gemini — trả classification + fields)
 *     → normalize extraction (map codes → DB ids, type field values)
 *     → insert record (với document_type_id, extracted_data, …)
 *     → upsert record_field_values
 *     → emit WebSocket event
 *     → (on error) notify user via platform
 */

const db              = require('../../config/db')
const logger          = require('../../config/logger')
const ocrService      = require('../../services/ocr.service')
const storageService  = require('../../services/storage.service')
const normalizer      = require('../../services/extraction-normalizer.service')
const rfvService      = require('../../services/record-field-value.service')

const MESSAGES = {
  image_failed:
    '⚠️ Hệ thống không tải được ảnh từ tin nhắn của bạn.\n' +
    'Ghi chú đã được lưu, nhưng ảnh chưa xử lý được.\n' +
    'Vui lòng gửi lại ảnh nếu cần.',
  process_failed:
    '⚠️ Hệ thống chưa nhận diện được tin nhắn của bạn.\n' +
    'Vui lòng gửi lại sau ít phút.',
}

async function process(normalizedMsg, connector, io) {
  const {
    platform, platform_message_id, platform_user_id, sender_name,
    source_chat_id, source_chat_type, message_type,
    image_file_id, image_url, text_note, received_at,
  } = normalizedMsg

  const start = Date.now()
  logger.info('message.process.start', { platform, message_type, sender_name, source_chat_id })

  async function notifyUser(text) {
    try {
      await connector.reply(source_chat_id, text)
    } catch (replyErr) {
      logger.warn('message.process.notify_failed', { error: replyErr.message, platform, source_chat_id })
    }
  }

  try {
    // ── 1. Duplicate check ────────────────────────────────────────────────────
    const dup = await db.query(
      'SELECT id FROM records WHERE platform = $1 AND platform_message_id = $2',
      [platform, platform_message_id]
    )
    if (dup.rows.length > 0) {
      logger.info('message.process.duplicate', { platform, platform_message_id })
      return
    }

    // ── 2. Upsert user ────────────────────────────────────────────────────────
    const { rows: [{ id: senderId }] } = await db.query(
      `INSERT INTO users (platform, platform_user_id, name, role)
       VALUES ($1, $2, $3, 'staff')
       ON CONFLICT (platform, platform_user_id)
         WHERE platform_user_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`,
      [platform, platform_user_id, sender_name]
    )

    // ── 3. Download & upload image ────────────────────────────────────────────
    let storedImageUrl     = null
    let storedThumbnailUrl = null
    let ocrText            = null
    let ocrStatus          = 'pending'
    let ocrConfidence      = null
    let extraction         = null   // NormalizedExtraction from normalizer

    if (message_type !== 'text_only') {
      try {
        const buffer   = await connector.downloadImage(image_file_id || image_url)
        const filename = `${platform}_${platform_message_id}_${Date.now()}.jpg`
        const uploaded = await storageService.uploadImage(buffer, filename)
        storedImageUrl     = uploaded.image_url
        storedThumbnailUrl = uploaded.thumbnail_url

        // ── 4. OCR + normalize ──────────────────────────────────────────────
        if (storedImageUrl) {
          try {
            const ocrResult = await ocrService.extractText(storedImageUrl)
            ocrText       = ocrResult.text
            ocrStatus     = ocrResult.status
            ocrConfidence = ocrResult.confidence

            // Normalize only when OCR succeeded; errors here must not block ingest
            if (ocrResult.status === 'success') {
              try {
                extraction = await normalizer.normalize(ocrResult)
              } catch (normErr) {
                logger.warn('message.process.normalize_error', { error: normErr.message, platform })
                // extraction stays null — record still saved without document schema
              }
            }
          } catch (ocrErr) {
            logger.warn('message.process.ocr_error', { error: ocrErr.message, platform })
            ocrStatus = 'failed'
          }
        }
      } catch (imgErr) {
        logger.warn('message.process.image_error', { error: imgErr.message, platform, platform_message_id })
        ocrStatus = 'failed'
        await notifyUser(MESSAGES.image_failed)
      }
    } else {
      ocrStatus = 'success'
    }

    // ── 5. Insert record ──────────────────────────────────────────────────────
    const { rows: [{ id: recordId }] } = await db.query(
      `INSERT INTO records (
         platform, platform_message_id, sender_id, sender_name,
         source_chat_id, source_chat_type,
         image_url, image_thumbnail, ocr_text, note,
         ocr_status, ocr_confidence, status,
         document_type_id, suggested_category_id, classification_confidence,
         extraction_status, extracted_data, schema_version,
         received_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,'new',
         $13,$14,$15,$16,$17::jsonb,1,
         $18
       )
       RETURNING id`,
      [
        platform, platform_message_id, senderId, sender_name,
        source_chat_id, source_chat_type,
        storedImageUrl, storedThumbnailUrl, ocrText, text_note,
        ocrStatus, ocrConfidence,
        extraction?.document_type_id          ?? null,
        extraction?.suggested_category_id     ?? null,
        extraction?.classification_confidence ?? null,
        extraction?.extraction_status         ?? (ocrStatus === 'failed' ? 'failed' : 'pending'),
        extraction?.extracted_data != null ? JSON.stringify(extraction.extracted_data) : null,
        received_at,
      ]
    )

    // ── 6. Upsert field values (fire-and-forget style — never blocks ingest) ──
    if (extraction?.fieldEntries?.length) {
      rfvService.upsertMany(recordId, extraction.fieldEntries).catch(err => {
        logger.warn('message.process.rfv_error', { recordId, error: err.message })
      })
    }

    logger.info('message.process.done', {
      recordId,
      platform,
      documentType: extraction?.document_type_id ?? null,
      extractionStatus: extraction?.extraction_status ?? null,
      processing_ms: Date.now() - start,
    })

    // ── 7. Emit WebSocket ─────────────────────────────────────────────────────
    if (io) {
      io.emit('new_record', {
        record: { id: recordId, sender_name, platform, received_at, status: 'new' },
      })
    }

  } catch (err) {
    logger.error('message.process.failed', { error: err.message, platform, platform_message_id })
    await notifyUser(MESSAGES.process_failed)
    throw err
  }
}

module.exports = { process }
