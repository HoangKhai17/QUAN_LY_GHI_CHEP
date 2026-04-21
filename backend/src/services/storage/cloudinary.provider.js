/**
 * Cloudinary Storage Provider
 *
 * Cloudinary SDK tự đọc CLOUDINARY_URL từ env:
 *   Format: cloudinary://api_key:api_secret@cloud_name
 *
 * Assets upload xong là public (free plan không có private delivery).
 * getSignedUrl() là passthrough — trả lại secure_url đã lưu trong DB.
 * Khi nâng lên paid plan: đổi thành cloudinary.url(key, { sign_url: true, ... })
 */

const cloudinary = require('cloudinary').v2
const path = require('path')
const logger = require('../../config/logger')

const UPLOAD_FOLDER = 'quan-ly-ghi-chep/uploads'

// Validate config ngay khi module load — fail fast thay vì lỗi ngầm lúc runtime
const cloudinaryUrl = process.env.CLOUDINARY_URL || ''
if (!cloudinaryUrl) {
  throw new Error('[Storage] CLOUDINARY_URL is not set. Add it to .env')
}
if (cloudinaryUrl.includes('api_key') || cloudinaryUrl.includes('api_secret')) {
  throw new Error('[Storage] CLOUDINARY_URL looks like a placeholder. Replace with real credentials.')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Chuyển filename thành Cloudinary public_id hợp lệ.
 * Bỏ extension, replace ký tự đặc biệt bằng underscore, giới hạn 100 ký tự.
 * Ví dụ: "telegram_123_1714567890000.jpg" → "quan-ly-ghi-chep/uploads/telegram_123_1714567890000"
 */
function buildPublicId(filename) {
  const base = path.basename(filename, path.extname(filename))
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
  return `${UPLOAD_FOLDER}/${safe}`
}

/**
 * Upload buffer lên Cloudinary qua upload_stream.
 * Trả về Promise<UploadApiResponse>.
 */
function uploadStream(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
    stream.end(buffer)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload ảnh lên Cloudinary.
 *
 * @param {Buffer} buffer  - Dữ liệu ảnh raw
 * @param {string} filename - Tên file (dùng để tạo public_id ổn định)
 * @returns {{ image_url: string, thumbnail_url: string }}
 */
async function uploadImage(buffer, filename) {
  const publicId = buildPublicId(filename)
  logger.info('storage.upload.start', { filename, publicId })

  try {
    const result = await uploadStream(buffer, {
      public_id:     publicId,
      resource_type: 'image',
      overwrite:     false,     // cùng filename → cùng asset, idempotent
      quality:       'auto:good',
      format:        'jpg',
    })

    // Thumbnail: Cloudinary transformation URL — không cần upload lần 2
    const thumbnailUrl = cloudinary.url(result.public_id, {
      width:        400,
      height:       300,
      crop:         'fill',
      quality:      'auto',
      fetch_format: 'auto',
      secure:       true,
    })

    logger.info('storage.upload.success', {
      publicId: result.public_id,
      bytes:    result.bytes,
      format:   result.format,
      url:      result.secure_url,
    })

    return {
      image_url:     result.secure_url,
      thumbnail_url: thumbnailUrl,
    }
  } catch (err) {
    logger.error('storage.upload.failed', { filename, error: err.message })
    throw new Error(`Storage upload failed: ${err.message}`)
  }
}

/**
 * Trả về URL có thể dùng để hiển thị ảnh.
 *
 * Cloudinary free plan: asset là public → secure_url đã lưu trong DB dùng được trực tiếp.
 * Hàm này là passthrough để giữ contract nhất quán với provider khác (S3 cần generate URL).
 *
 * Khi nâng paid plan / chuyển private delivery:
 *   return cloudinary.url(imageKey, { sign_url: true, type: 'authenticated', expires_at: ... })
 *
 * @param {string} imageKey     - secure_url lưu trong DB (hoặc public_id nếu đổi cách lưu sau)
 * @param {number} expiresSeconds - không dùng cho Cloudinary public assets
 */
async function getSignedUrl(imageKey, expiresSeconds = 3600) {
  return imageKey
}

module.exports = { uploadImage, getSignedUrl }
