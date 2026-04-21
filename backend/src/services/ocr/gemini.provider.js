/**
 * Gemini Document Extraction Provider
 *
 * Dùng Google Gemini multimodal model để đọc ảnh chứng từ/tài liệu.
 * Không phải OCR thuần — model hiểu ngữ cảnh và trích xuất có cấu trúc.
 *
 * Cấu hình .env:
 *   GEMINI_API_KEY=  ← lấy từ aistudio.google.com
 *   GEMINI_MODEL=gemini-2.5-flash  ← hoặc gemini-2.5-pro
 */

const { GoogleGenerativeAI } = require('@google/generative-ai')
const axios = require('axios')
const logger = require('../../config/logger')

// ── Config validation (fail fast) ─────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY || ''
if (!API_KEY) {
  throw new Error('[OCR] GEMINI_API_KEY is not set. Add it to .env')
}

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const genAI = new GoogleGenerativeAI(API_KEY)

// ── Prompt ────────────────────────────────────────────────────────────────
// Thiết kế cho chứng từ kế toán/tài liệu nội bộ doanh nghiệp Việt Nam.
// Ưu tiên đọc đúng hơn đọc nhiều — không suy diễn nếu không rõ.
const EXTRACTION_PROMPT = `Bạn là AI chuyên đọc và trích xuất dữ liệu từ ảnh chứng từ, hóa đơn, biên bản, báo cáo của doanh nghiệp Việt Nam.

Hãy phân tích ảnh và trả về JSON theo đúng format sau (không bọc trong markdown code fence):

{
  "document_type": "loại chứng từ: hóa_đơn | phiếu_chi | phiếu_thu | biên_bản | báo_cáo | hợp_đồng | khác",
  "date": "ngày trên chứng từ theo định dạng YYYY-MM-DD, hoặc null nếu không có",
  "amount": "số tiền (chỉ số, không kèm đơn vị), hoặc null",
  "currency": "đơn vị tiền tệ: VND | USD | EUR, hoặc null",
  "document_number": "số chứng từ / số hóa đơn nếu có, hoặc null",
  "description": "nội dung / mô tả chính của chứng từ (1-3 câu)",
  "parties": "tên các đơn vị, cá nhân liên quan (người mua, bán, ký tên...)",
  "notes": "thông tin bổ sung đáng chú ý, hoặc null",
  "raw_text": "TOÀN BỘ text đọc được từ ảnh, giữ nguyên xuống dòng, không lược bỏ"
}

Nguyên tắc quan trọng:
- Chỉ trả JSON thuần, không có text trước/sau
- raw_text phải chứa TẤT CẢ nội dung text trong ảnh
- Nếu trường nào không đọc được hoặc không có, để null (không bịa)
- Không tự suy diễn số liệu nếu ảnh không rõ
- Nếu ảnh mờ, vẫn đọc hết những gì có thể nhìn thấy`

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Download ảnh từ URL về buffer, trả về { base64, mimeType }.
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'QuantLyGhiChep-OCR/1.0' },
  })
  const mimeType = response.headers['content-type']?.split(';')[0] || 'image/jpeg'
  const base64 = Buffer.from(response.data).toString('base64')
  return { base64, mimeType }
}

/**
 * Làm sạch output của model: bỏ markdown code fence nếu có.
 */
function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()
}

/**
 * Parse JSON từ response model, trả null nếu lỗi.
 */
function safeParseJson(text) {
  try {
    return JSON.parse(stripCodeFence(text))
  } catch {
    // Model đôi khi trả plain text — cố gắng lấy raw_text từ toàn bộ response
    logger.warn('ocr.gemini.json_parse_failed', { preview: text?.slice(0, 200) })
    return null
  }
}

/**
 * Ước tính confidence từ structured data.
 * Gemini không trả confidence score — ta derive từ chất lượng output.
 */
function estimateConfidence(parsed) {
  if (!parsed) return 0
  const hasText = parsed.raw_text && parsed.raw_text.trim().length > 10
  const hasStructure = !!(parsed.document_type || parsed.description)
  if (hasText && hasStructure) return 0.90
  if (hasText) return 0.70
  return 0.40
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Trích xuất nội dung từ ảnh chứng từ bằng Gemini.
 *
 * @param {string} imageUrl - Public URL ảnh (Cloudinary secure_url)
 * @returns {{
 *   text: string|null,
 *   confidence: number,
 *   status: 'success'|'failed',
 *   provider: string,
 *   structured_data: object|null
 * }}
 *
 * structured_data được trả ra nhưng chưa lưu DB (chỉ lưu ocr_text hiện tại).
 * Future: thêm cột structured_data JSONB vào bảng records để lưu toàn bộ.
 */
async function extractText(imageUrl) {
  logger.info('ocr.extract.start', { provider: 'gemini', model: MODEL_NAME, url: imageUrl?.slice(0, 80) })

  try {
    // 1. Download ảnh → base64
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl)

    // 2. Gọi Gemini
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      { inlineData: { data: base64, mimeType } },
    ])

    const rawOutput = result.response.text()

    // 3. Parse JSON từ model output
    const parsed = safeParseJson(rawOutput)

    // 4. Map về contract của service
    const text = parsed?.raw_text || (parsed ? null : rawOutput?.slice(0, 2000))
    const confidence = estimateConfidence(parsed)

    logger.info('ocr.extract.success', {
      provider: 'gemini',
      model: MODEL_NAME,
      textLength: text?.length ?? 0,
      documentType: parsed?.document_type,
      confidence,
    })

    return {
      text:            text ?? null,
      confidence,
      status:          'success',
      provider:        'gemini',
      structured_data: parsed ?? null,  // Future: lưu vào records.structured_data (JSONB)
    }
  } catch (err) {
    logger.error('ocr.extract.failed', { provider: 'gemini', error: err.message })
    return {
      text:            null,
      confidence:      0,
      status:          'failed',
      provider:        'gemini',
      structured_data: null,
    }
  }
}

module.exports = { extractText }
