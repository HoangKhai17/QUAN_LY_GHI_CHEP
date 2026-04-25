/**
 * Gemini Document Extraction Provider
 *
 * Returns a unified extraction result including:
 *   - classification (document_type_code, category_code, confidence)
 *   - fields (keyed by field_key matching document_type_fields schema)
 *   - raw_structured_data (original AI output for debugging)
 *   - text / confidence / status / provider (backward-compatible)
 *
 * Env:
 *   GEMINI_API_KEY   ← aistudio.google.com
 *   GEMINI_MODEL     ← default: gemini-2.5-flash
 */

const { GoogleGenerativeAI } = require('@google/generative-ai')
const axios = require('axios')
const logger = require('../../config/logger')

// ── Dynamic config (60s TTL cache, reads from DB via settingsService) ─────────

let _cfgCache  = null
let _cfgExpiry = 0

async function _getConfig() {
  if (_cfgCache && Date.now() < _cfgExpiry) return _cfgCache
  const { getSetting } = require('../settings.service')
  const [primaryKey, fallbackKey, model, fallbackEnabled] = await Promise.all([
    getSetting('gemini_api_key_primary'),
    getSetting('gemini_api_key_fallback'),
    getSetting('gemini_model'),
    getSetting('ai_fallback_enabled'),
  ])
  _cfgCache = {
    primaryKey:      primaryKey  || '',
    fallbackKey:     fallbackKey || '',
    model:           model       || 'gemini-2.5-flash',
    fallbackEnabled: fallbackEnabled === 'true' || fallbackEnabled === '1',
  }
  _cfgExpiry = Date.now() + 60_000
  return _cfgCache
}

// ── Prompt ────────────────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `Bạn là AI chuyên đọc và trích xuất dữ liệu từ ảnh chứng từ doanh nghiệp Việt Nam.

Phân tích ảnh và trả về JSON theo đúng format sau (không bọc trong markdown code fence):

{
  "classification": {
    "document_type_code": "<một trong các code bên dưới>",
    "category_code": "<general | invoice | work_report | inventory | other>",
    "confidence": <số thực 0.0–1.0>,
    "reasoning": "<lý do ngắn gọn tại sao chọn loại này>"
  },
  "fields": {
    "<field_key>": <giá trị, null nếu không có>
  },
  "raw_text": "<TOÀN BỘ text đọc được từ ảnh, giữ nguyên xuống dòng>"
}

── Các loại chứng từ (document_type_code) và field tương ứng ──────────────────

bank_transfer — Chuyển khoản ngân hàng
  amount(số VND), transfer_date(YYYY-MM-DD), reference_number, transaction_code,
  bank_name, account_number, account_holder, transfer_content, payer_name

weighing_slip — Phiếu cân xe
  vehicle_number, ticket_number, customer_name, item_name,
  gross_weight(số kg), empty_weight(số kg), net_weight(số kg),
  weighing_type("in" hoặc "out"), weighing_date(YYYY-MM-DD), time_in, time_out

restaurant_receipt — Hóa đơn ăn uống / nhà hàng
  restaurant_name, receipt_number, receipt_date(YYYY-MM-DD),
  items([{"name":"...","qty":1,"price":0}]),
  subtotal(số VND), discount(số VND), tax(số VND), total_amount(số VND)

expense_receipt — Phiếu chi
  receipt_number, receipt_date(YYYY-MM-DD), payee_name,
  amount(số VND), description, payment_method("cash"|"transfer"|"other"), approved_by

income_receipt — Phiếu thu
  receipt_number, receipt_date(YYYY-MM-DD), payer_name,
  amount(số VND), description, payment_method("cash"|"transfer"|"other")

work_report — Báo cáo công việc / biên bản họp
  report_date(YYYY-MM-DD), title, assignee_name, summary,
  status_report("complete"|"in_progress"|"blocked")

inspection_report — Phiếu kiểm tra / kiểm nghiệm / nghiệm thu
  inspection_date(YYYY-MM-DD), inspector_name, location,
  result("pass"|"fail"|"conditional"), notes

other — Chứng từ không thuộc các loại trên
  document_date(YYYY-MM-DD), description, amount(số VND nếu có)

── Quy tắc bắt buộc ──────────────────────────────────────────────────────────
- Chỉ trả JSON thuần, không có text trước/sau, không markdown
- Số tiền: chỉ số nguyên (VND), không có dấu phân cách. Ví dụ: 1500000
- Ngày: luôn dùng YYYY-MM-DD. Nếu chỉ có tháng/năm thì dùng ngày 01
- Nếu trường nào không đọc được hoặc không có → để null
- confidence: 0.9=rất rõ ràng, 0.7=tương đối rõ, 0.5=có thể đoán, 0.3=rất mờ
- Không tự bịa số liệu nếu ảnh không rõ`

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchImageAsBase64(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'QuantLyGhiChep-OCR/1.0' },
  })
  const mimeType = response.headers['content-type']?.split(';')[0] || 'image/jpeg'
  const base64   = Buffer.from(response.data).toString('base64')
  return { base64, mimeType }
}

function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()
}

function safeParseJson(text) {
  try {
    return JSON.parse(stripCodeFence(text))
  } catch {
    logger.warn('ocr.gemini.json_parse_failed', { preview: text?.slice(0, 200) })
    return null
  }
}

function estimateConfidence(parsed) {
  if (!parsed) return 0
  const hasText = parsed.raw_text?.trim().length > 10
  const hasClassification = !!parsed.classification?.document_type_code
  if (hasText && hasClassification) return parsed.classification?.confidence ?? 0.85
  if (hasText) return 0.55
  return 0.30
}

// ── Public API ────────────────────────────────────────────────────────────────

const _failResult = {
  text: null, confidence: 0, status: 'failed', provider: 'gemini',
  classification: null, fields: null, raw_structured_data: null, structured_data: null,
}

async function _doExtract(imageUrl, apiKey, model) {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl)
  const genAI  = new GoogleGenerativeAI(apiKey)
  const mdl    = genAI.getGenerativeModel({ model })
  const result = await mdl.generateContent([
    EXTRACTION_PROMPT,
    { inlineData: { data: base64, mimeType } },
  ])
  const rawOutput  = result.response.text()
  const parsed     = safeParseJson(rawOutput)
  const text       = parsed?.raw_text || (parsed ? null : rawOutput?.slice(0, 2000))
  const confidence = estimateConfidence(parsed)

  logger.info('ocr.extract.success', {
    provider: 'gemini', model,
    textLength:   text?.length ?? 0,
    documentType: parsed?.classification?.document_type_code,
    confidence,
  })
  return {
    text, confidence, status: 'success', provider: 'gemini',
    classification:      parsed?.classification ?? null,
    fields:              parsed?.fields          ?? null,
    raw_structured_data: parsed                  ?? null,
    structured_data:     parsed                  ?? null,
  }
}

/**
 * @param {string} imageUrl  Public image URL (Cloudinary)
 * @returns {{ text, confidence, status, provider, classification, fields, raw_structured_data }}
 */
async function extractText(imageUrl) {
  const cfg = await _getConfig()
  logger.info('ocr.extract.start', { provider: 'gemini', model: cfg.model, url: imageUrl?.slice(0, 80) })

  if (!cfg.primaryKey) {
    logger.error('ocr.gemini.no_key', { reason: 'Gemini API key not configured' })
    return { ..._failResult }
  }

  try {
    return await _doExtract(imageUrl, cfg.primaryKey, cfg.model)
  } catch (err) {
    logger.error('ocr.extract.failed', { provider: 'gemini', model: cfg.model, error: err.message })

    if (cfg.fallbackEnabled && cfg.fallbackKey) {
      logger.warn('ocr.gemini.switching_to_fallback', { primaryError: err.message })
      _cfgCache = null // force refresh so fallback key re-reads on next call
      try {
        return await _doExtract(imageUrl, cfg.fallbackKey, cfg.model)
      } catch (err2) {
        logger.error('ocr.extract.fallback_failed', { error: err2.message })
      }
    }

    return { ..._failResult }
  }
}

module.exports = { extractText }
