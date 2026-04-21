const logger = require('../config/logger')

// TODO Phase 1: integrate Google Vision API hoặc Tesseract.js
async function extractText(imageUrl) {
  try {
    // Placeholder — sẽ implement Phase 1
    logger.info('ocr.extract.start', { imageUrl: imageUrl?.slice(0, 80) })
    return { text: null, confidence: 0, status: 'pending' }
  } catch (err) {
    logger.error('ocr.extract.failed', { error: err.message })
    return { text: null, confidence: 0, status: 'failed', error: err.message }
  }
}

module.exports = { extractText }
