/**
 * OCR / AI Document Extraction Service — abstraction layer.
 *
 * Provider hiện tại: Gemini (Google multimodal AI)
 * Để chuyển provider: đặt AI_PROVIDER=<name> trong .env
 * và thêm file tương ứng trong src/services/ocr/<name>.provider.js
 *
 * Contract ổn định — business logic KHÔNG cần biết provider đang dùng:
 *   extractText(imageUrl) → { text, confidence, status, provider, structured_data }
 */

const PROVIDER_NAME = (process.env.AI_PROVIDER || 'gemini').toLowerCase()

const SUPPORTED_PROVIDERS = {
  gemini: () => require('./ocr/gemini.provider'),
  // vision: () => require('./ocr/vision.provider'),   // Google Vision API
  // tesseract: () => require('./ocr/tesseract.provider'),
}

function loadProvider() {
  const factory = SUPPORTED_PROVIDERS[PROVIDER_NAME]
  if (!factory) {
    throw new Error(
      `[OCR] AI_PROVIDER '${PROVIDER_NAME}' is not supported. ` +
      `Valid options: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}`
    )
  }
  return factory()
}

let _provider = null
function provider() {
  if (!_provider) _provider = loadProvider()
  return _provider
}

/**
 * Trích xuất nội dung từ ảnh chứng từ.
 *
 * @param {string} imageUrl - Public URL ảnh (Cloudinary secure_url)
 * @returns {Promise<{
 *   text: string|null,
 *   confidence: number,
 *   status: 'success'|'failed'|'pending',
 *   provider: string,
 *   structured_data: object|null
 * }>}
 */
async function extractText(imageUrl) {
  return provider().extractText(imageUrl)
}

module.exports = { extractText }
