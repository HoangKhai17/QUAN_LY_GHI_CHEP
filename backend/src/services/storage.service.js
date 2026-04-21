const logger = require('../config/logger')

// TODO Phase 1: integrate Cloudinary hoặc AWS S3
async function uploadImage(buffer, filename) {
  logger.info('storage.upload.start', { filename })
  // Placeholder
  return { image_url: null, thumbnail_url: null }
}

async function getSignedUrl(imageKey, expiresSeconds = 3600) {
  // Placeholder — trả về URL với expiry
  return imageKey
}

module.exports = { uploadImage, getSignedUrl }
