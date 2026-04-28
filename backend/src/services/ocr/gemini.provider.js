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
const documentTypesService = require('../document-types.service')

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

// ── Prompt builder ────────────────────────────────────────────────────────────

const DEFAULT_BUSINESS_PROMPT = `Bạn là AI chuyên đọc và trích xuất dữ liệu từ ảnh chứng từ doanh nghiệp Việt Nam.
Hãy phân loại đúng loại tài liệu dựa trên nội dung ảnh và trích xuất các trường dữ liệu theo schema hệ thống cung cấp.
Ưu tiên dữ liệu nhìn thấy rõ trong ảnh; không tự suy diễn nếu ảnh mờ, thiếu hoặc không chắc chắn.`

const OUTPUT_CONTRACT_PROMPT = `Phân tích ảnh và chỉ trả về JSON thuần theo đúng format sau, không markdown, không text trước/sau:

{
  "classification": {
    "document_type_code": "<một code trong schema document types>",
    "category_code": "<general | invoice | work_report | inventory | other>",
    "confidence": <số thực 0.0-1.0>,
    "reasoning": "<lý do ngắn gọn tại sao chọn loại này>"
  },
  "fields": {
    "<field_key>": <giá trị, null nếu không có>
  },
  "raw_text": "<TOÀN BỘ text đọc được từ ảnh, giữ nguyên xuống dòng>"
}

Quy tắc bắt buộc:
- Chỉ trả JSON thuần, không bọc trong markdown code fence.
- document_type_code phải là một trong các code đang active trong schema. Nếu không khớp loại nào, chọn "other" nếu schema có "other"; nếu không có "other", chọn loại gần nhất và giảm confidence.
- fields chỉ dùng field_key có trong schema của document_type_code đã chọn.
- Với field không đọc được hoặc không có trong ảnh, trả null.
- Số tiền: trả số nguyên VND, không có dấu phân cách. Ví dụ: 1500000.
- Ngày: trả YYYY-MM-DD. Nếu chỉ có tháng/năm thì dùng ngày 01.
- Boolean: trả true/false.
- JSON/list: trả object hoặc array hợp lệ.
- confidence: 0.9=rất rõ ràng, 0.7=tương đối rõ, 0.5=có thể đoán, 0.3=rất mờ.
- Không tự bịa số liệu nếu ảnh không rõ.`

function _compactText(value, max = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function _fieldHint(field) {
  const parts = [field.data_type]
  if (field.unit) parts.push(`unit=${field.unit}`)
  if (field.is_required) parts.push('required')
  const options = Array.isArray(field.config?.options) ? field.config.options : null
  if (options?.length) parts.push(`options=${options.map(o => JSON.stringify(o)).join('|')}`)
  return parts.join(', ')
}

async function _buildDocumentTypesSchemaPrompt() {
  const types = (await documentTypesService.getAll()).filter(t => t.is_active !== false)

  if (!types.length) {
    return 'Không có document type active trong DB. Trả document_type_code=null, fields={}, raw_text vẫn phải đọc nếu có.'
  }

  const lines = ['Schema document types đang active trong hệ thống:']

  for (const type of types) {
    lines.push('')
    lines.push(`${type.code} - ${type.name}${type.description ? ` - ${_compactText(type.description)}` : ''}`)
    if (!type.fields?.length) {
      lines.push('  Không có field cấu hình; trả fields={} nếu chọn loại này.')
      continue
    }
    for (const field of type.fields) {
      lines.push(`  - ${field.field_key}: ${field.label} (${_fieldHint(field)})`)
    }
  }

  return lines.join('\n')
}

async function _buildExtractionPrompt() {
  const { getSetting } = require('../settings.service')
  const [customPrompt, schemaPrompt] = await Promise.all([
    getSetting('ai_extraction_prompt'),
    _buildDocumentTypesSchemaPrompt(),
  ])

  return [
    (customPrompt && customPrompt.trim()) || DEFAULT_BUSINESS_PROMPT,
    schemaPrompt,
    OUTPUT_CONTRACT_PROMPT,
  ].join('\n\n')
}

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
  const extractionPrompt = await _buildExtractionPrompt()
  const genAI  = new GoogleGenerativeAI(apiKey)
  const mdl    = genAI.getGenerativeModel({ model })
  const result = await mdl.generateContent([
    extractionPrompt,
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
