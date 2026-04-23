/**
 * Extraction Normalizer Service
 *
 * Takes raw OCR output (new format with classification + fields) and:
 *   1. Normalizes value types  (amounts, dates)
 *   2. Maps document_type_code → document_type_id (DB UUID)
 *   3. Maps category_code     → category_id      (DB UUID)
 *   4. Builds typed field entries ready for record_field_values upsert
 *   5. Decides extraction_status based on confidence thresholds
 *
 * Designed to be safe: every step has a fallback — never throws on
 * bad OCR data so the ingest pipeline keeps running.
 */

const docTypesService = require('./document-types.service')
const logger = require('../config/logger')

// confidence below this → extraction_status = 'needs_review'
const CONFIDENCE_THRESHOLD = 0.65

// ── Value normalizers ─────────────────────────────────────────────────────────

/**
 * Parse Vietnamese money/number strings → integer (VND) or float.
 *
 * Handles:
 *   "1.500.000"  → 1500000
 *   "1,500,000"  → 1500000
 *   "500000"     → 500000
 *   "1.500.000,50" → 1500000  (drop cents for VND)
 *   500000       → 500000     (already a number)
 */
function normalizeAmount(val) {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return Math.round(val)

  const s = String(val).trim().replace(/[^\d.,]/g, '')
  if (!s) return null

  // Detect separator style
  const dotCount   = (s.match(/\./g) || []).length
  const commaCount = (s.match(/,/g)  || []).length

  let clean
  if (dotCount > 1) {
    // "1.500.000" — dots are thousand separators
    clean = s.replace(/\./g, '').replace(/,.*/, '')
  } else if (commaCount > 1) {
    // "1,500,000" — commas are thousand separators
    clean = s.replace(/,/g, '').replace(/\..*/, '')
  } else if (dotCount === 1 && commaCount === 1) {
    // "1.500,00" (EU) or "1,500.00" (US)
    const dotPos   = s.lastIndexOf('.')
    const commaPos = s.lastIndexOf(',')
    if (commaPos > dotPos) {
      // "1.500,00" — dot = thousand, comma = decimal
      clean = s.replace(/\./g, '').replace(',', '.')
    } else {
      // "1,500.00" — comma = thousand, dot = decimal
      clean = s.replace(/,/g, '')
    }
  } else if (dotCount === 1 && commaCount === 0) {
    // "500.000" (VN thousands) vs "500.50" (decimal) — 3 trailing digits → thousands
    const afterDot = s.split('.')[1]
    clean = afterDot && afterDot.length === 3 ? s.replace('.', '') : s
  } else if (dotCount === 0 && commaCount === 1) {
    // "500,000" (thousands) vs "500,50" (decimal)
    const afterComma = s.split(',')[1]
    clean = afterComma && afterComma.length === 3 ? s.replace(',', '') : s.replace(',', '.')
  } else {
    // No separator
    clean = s
  }

  const n = parseFloat(clean)
  return isNaN(n) ? null : Math.round(n)
}

/**
 * Parse various date strings → 'YYYY-MM-DD' string or null.
 *
 * Handles:
 *   "23/04/2026"          → "2026-04-23"
 *   "23-04-2026"          → "2026-04-23"
 *   "2026-04-23"          → "2026-04-23"  (passthrough)
 *   "23 tháng 4 năm 2026" → "2026-04-23"
 *   "April 23, 2026"      → "2026-04-23"
 */
function normalizeDate(val) {
  if (!val) return null
  const s = String(val).trim()

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // "23 tháng 4 năm 2026" or "ngày 23 tháng 04 năm 2026"
  const vi = s.match(/(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[aă]m\s+(\d{4})/i)
  if (vi) {
    const [, d, m, y] = vi
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // Fallback: try native Date parser (handles "April 23, 2026" etc.)
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
  } catch { /* ignore */ }

  return null
}

/**
 * Map a single extracted field value to the correct typed column.
 * Returns { value_text, value_number, value_date, value_datetime,
 *           value_boolean, value_json } — all others null.
 */
function mapValueToColumn(dataType, rawValue) {
  const empty = {
    value_text: null, value_number: null, value_date: null,
    value_datetime: null, value_boolean: null, value_json: null,
  }
  if (rawValue === null || rawValue === undefined) return empty

  switch (dataType) {
    case 'money':
    case 'number':
      return { ...empty, value_number: normalizeAmount(rawValue) }

    case 'date':
      return { ...empty, value_date: normalizeDate(rawValue) }

    case 'datetime': {
      const d = new Date(rawValue)
      return { ...empty, value_datetime: isNaN(d.getTime()) ? null : d.toISOString() }
    }

    case 'boolean':
      if (typeof rawValue === 'boolean') return { ...empty, value_boolean: rawValue }
      return { ...empty, value_boolean: ['true','yes','1','có'].includes(String(rawValue).toLowerCase()) }

    case 'json':
      if (typeof rawValue === 'object') return { ...empty, value_json: rawValue }
      try { return { ...empty, value_json: JSON.parse(rawValue) } }
      catch { return { ...empty, value_text: String(rawValue) } }

    default: // text
      return { ...empty, value_text: String(rawValue) }
  }
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Normalize an OCR result into a structured object ready for DB persistence.
 *
 * @param {object} ocrResult — from gemini.provider.extractText()
 * @returns {Promise<NormalizedExtraction>}
 *
 * NormalizedExtraction:
 * {
 *   document_type_id: UUID | null,
 *   suggested_category_id: UUID | null,
 *   classification_confidence: number | null,
 *   extraction_status: 'done' | 'needs_review' | 'failed' | 'pending',
 *   extracted_data: object,           ← raw JSON to store in records.extracted_data
 *   fieldEntries: [{                  ← ready to upsert into record_field_values
 *     field_id: UUID,
 *     ...value columns,
 *     confidence: number,
 *     source: 'ai',
 *   }]
 * }
 */
async function normalize(ocrResult) {
  // Baseline: nothing extracted
  const base = {
    document_type_id:          null,
    suggested_category_id:     null,
    classification_confidence: null,
    extraction_status:         'pending',
    extracted_data:            null,
    fieldEntries:              [],
  }

  if (!ocrResult || ocrResult.status !== 'success') {
    return { ...base, extraction_status: 'failed' }
  }

  const { classification, fields: rawFields, raw_structured_data } = ocrResult

  // Store everything raw for debugging
  base.extracted_data = {
    classification:    classification   ?? null,
    fields:            rawFields        ?? null,
    raw_structured_data: raw_structured_data ?? null,
    ocr_confidence:    ocrResult.confidence ?? null,
    provider:          ocrResult.provider  ?? null,
  }

  if (!classification?.document_type_code) {
    return { ...base, extraction_status: 'needs_review' }
  }

  const classConf = classification.confidence ?? 0

  // Map document type code → DB id
  let docType = null
  try {
    docType = await docTypesService.getByCode(classification.document_type_code)
  } catch (err) {
    logger.warn('normalizer.getByCode.failed', { code: classification.document_type_code, error: err.message })
  }

  const documentTypeId = docType?.id ?? null

  // Map category code → DB id
  let suggestedCategoryId = null
  try {
    suggestedCategoryId = await docTypesService.mapCategoryCode(classification.category_code)
    // Fallback: use document type's default category
    if (!suggestedCategoryId && docType?.default_category_id) {
      suggestedCategoryId = docType.default_category_id
    }
  } catch (err) {
    logger.warn('normalizer.mapCategory.failed', { code: classification.category_code, error: err.message })
  }

  // Determine extraction_status
  const combinedConf = (classConf + (ocrResult.confidence ?? 0)) / 2
  const extractionStatus = combinedConf >= CONFIDENCE_THRESHOLD ? 'done' : 'needs_review'

  // Build field entries only if we know the document type schema
  const fieldEntries = []
  if (docType?.fields?.length && rawFields) {
    for (const fieldDef of docType.fields) {
      const rawVal = rawFields[fieldDef.field_key]
      if (rawVal === null || rawVal === undefined) continue

      const typed = mapValueToColumn(fieldDef.data_type, rawVal)

      // Skip entries where all typed columns are null (bad value)
      const hasValue = Object.values(typed).some(v => v !== null)
      if (!hasValue) continue

      fieldEntries.push({
        field_id:   fieldDef.id,
        ...typed,
        confidence: classConf,
        source:     'ai',
      })
    }
  }

  return {
    document_type_id:          documentTypeId,
    suggested_category_id:     suggestedCategoryId,
    classification_confidence: classConf || null,
    extraction_status:         extractionStatus,
    extracted_data:            base.extracted_data,
    fieldEntries,
  }
}

module.exports = { normalize, normalizeAmount, normalizeDate, mapValueToColumn }
