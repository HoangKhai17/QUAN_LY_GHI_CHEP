/**
 * Storage Service — abstraction layer cho file upload.
 *
 * Provider hiện tại: Cloudinary (mặc định)
 * Để chuyển sang provider khác: đặt STORAGE_PROVIDER=s3 (hoặc r2, local) trong .env
 * và thêm file tương ứng trong src/services/storage/<provider>.provider.js
 *
 * Contract ổn định — business logic KHÔNG cần biết provider đang dùng:
 *   uploadImage(buffer, filename)  → { image_url, thumbnail_url }
 *   getSignedUrl(imageKey, secs)   → string URL
 */

const PROVIDER_NAME = (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase()

const SUPPORTED_PROVIDERS = {
  cloudinary: () => require('./storage/cloudinary.provider'),
  // s3:        () => require('./storage/s3.provider'),
  // r2:        () => require('./storage/r2.provider'),
  // local:     () => require('./storage/local.provider'),
}

function loadProvider() {
  const factory = SUPPORTED_PROVIDERS[PROVIDER_NAME]
  if (!factory) {
    throw new Error(
      `[Storage] STORAGE_PROVIDER '${PROVIDER_NAME}' is not supported. ` +
      `Valid options: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}`
    )
  }
  return factory()
}

// Lazy-load provider một lần duy nhất
let _provider = null
function provider() {
  if (!_provider) _provider = loadProvider()
  return _provider
}

/**
 * Upload ảnh lên storage.
 * @param {Buffer} buffer    - Raw image bytes
 * @param {string} filename  - Tên file (dùng tạo key/public_id ổn định)
 * @returns {Promise<{ image_url: string, thumbnail_url: string }>}
 */
async function uploadImage(buffer, filename) {
  return provider().uploadImage(buffer, filename)
}

/**
 * Lấy URL có thể truy cập để hiển thị ảnh.
 * S3/R2: generate pre-signed URL có thời hạn.
 * Cloudinary free: trả lại URL gốc (public asset).
 *
 * @param {string} imageKey       - URL hoặc key lưu trong DB
 * @param {number} expiresSeconds - Thời hạn URL (giây), áp dụng với S3/R2
 * @returns {Promise<string>}
 */
async function getSignedUrl(imageKey, expiresSeconds = parseInt(process.env.SIGNED_URL_EXPIRES) || 3600) {
  return provider().getSignedUrl(imageKey, expiresSeconds)
}

module.exports = { uploadImage, getSignedUrl }
