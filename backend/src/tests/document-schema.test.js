/**
 * Tests: Document Schema — extraction-normalizer + record-field-value
 *
 * These are unit tests. DB and services are mocked so tests run offline.
 * Integration tests (real DB) should be run in a staging environment.
 *
 * Run: npm test
 */

const {
  normalizeAmount,
  normalizeDate,
  mapValueToColumn,
  normalize,
} = require('../services/extraction-normalizer.service')

// ── Mock document-types service ───────────────────────────────────────────────
jest.mock('../services/document-types.service', () => ({
  getByCode: jest.fn(),
  mapCategoryCode: jest.fn(),
}))

const docTypeSvc = require('../services/document-types.service')

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BANK_TRANSFER_TYPE = {
  id:   'uuid-bank',
  code: 'bank_transfer',
  name: 'Chuyển khoản ngân hàng',
  default_category_id: 'uuid-cat-invoice',
  fields: [
    { id: 'fid-amount',       field_key: 'amount',        data_type: 'money'  },
    { id: 'fid-date',         field_key: 'transfer_date', data_type: 'date'   },
    { id: 'fid-bank',         field_key: 'bank_name',     data_type: 'text'   },
    { id: 'fid-content',      field_key: 'transfer_content', data_type: 'text' },
    { id: 'fid-payer',        field_key: 'payer_name',    data_type: 'text'   },
  ],
}

const WEIGHING_TYPE = {
  id:   'uuid-weighing',
  code: 'weighing_slip',
  name: 'Phiếu cân xe',
  default_category_id: 'uuid-cat-inventory',
  fields: [
    { id: 'fid-vehicle',  field_key: 'vehicle_number', data_type: 'text'   },
    { id: 'fid-net',      field_key: 'net_weight',     data_type: 'number' },
    { id: 'fid-wdate',    field_key: 'weighing_date',  data_type: 'date'   },
  ],
}

const WORK_REPORT_TYPE = {
  id:   'uuid-work',
  code: 'work_report',
  name: 'Báo cáo công việc',
  default_category_id: 'uuid-cat-work',
  fields: [
    { id: 'fid-rdate',   field_key: 'report_date', data_type: 'date' },
    { id: 'fid-title',   field_key: 'title',       data_type: 'text' },
    { id: 'fid-summary', field_key: 'summary',     data_type: 'text' },
  ],
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. normalizeAmount
// ═════════════════════════════════════════════════════════════════════════════
describe('normalizeAmount', () => {
  test('integer passthrough', () => {
    expect(normalizeAmount(500000)).toBe(500000)
  })

  test('Vietnamese dot-separated thousands', () => {
    expect(normalizeAmount('1.500.000')).toBe(1500000)
  })

  test('comma-separated thousands (US style)', () => {
    expect(normalizeAmount('1,500,000')).toBe(1500000)
  })

  test('plain string number', () => {
    expect(normalizeAmount('500000')).toBe(500000)
  })

  test('null returns null', () => {
    expect(normalizeAmount(null)).toBeNull()
  })

  test('empty string returns null', () => {
    expect(normalizeAmount('')).toBeNull()
  })

  test('mixed currency text stripped', () => {
    // "500.000 VND" — non-numeric chars removed first
    expect(normalizeAmount('500.000 VND')).toBe(500000)
  })

  test('decimal rounded to integer', () => {
    expect(normalizeAmount('1500000.99')).toBe(1500001)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. normalizeDate
// ═════════════════════════════════════════════════════════════════════════════
describe('normalizeDate', () => {
  test('ISO passthrough', () => {
    expect(normalizeDate('2026-04-23')).toBe('2026-04-23')
  })

  test('DD/MM/YYYY', () => {
    expect(normalizeDate('23/04/2026')).toBe('2026-04-23')
  })

  test('DD-MM-YYYY', () => {
    expect(normalizeDate('23-04-2026')).toBe('2026-04-23')
  })

  test('Vietnamese date string', () => {
    expect(normalizeDate('23 tháng 4 năm 2026')).toBe('2026-04-23')
  })

  test('null returns null', () => {
    expect(normalizeDate(null)).toBeNull()
  })

  test('empty string returns null', () => {
    expect(normalizeDate('')).toBeNull()
  })

  test('single digit day/month padded', () => {
    expect(normalizeDate('3/4/2026')).toBe('2026-04-03')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. mapValueToColumn
// ═════════════════════════════════════════════════════════════════════════════
describe('mapValueToColumn', () => {
  test('money → value_number', () => {
    const r = mapValueToColumn('money', '1.500.000')
    expect(r.value_number).toBe(1500000)
    expect(r.value_text).toBeNull()
  })

  test('date → value_date', () => {
    const r = mapValueToColumn('date', '23/04/2026')
    expect(r.value_date).toBe('2026-04-23')
    expect(r.value_number).toBeNull()
  })

  test('text → value_text', () => {
    const r = mapValueToColumn('text', 'Vietcombank')
    expect(r.value_text).toBe('Vietcombank')
  })

  test('boolean true variants', () => {
    expect(mapValueToColumn('boolean', true).value_boolean).toBe(true)
    expect(mapValueToColumn('boolean', 'yes').value_boolean).toBe(true)
    expect(mapValueToColumn('boolean', 'có').value_boolean).toBe(true)
  })

  test('json object passthrough', () => {
    const items = [{ name: 'Pho', qty: 2, price: 60000 }]
    const r = mapValueToColumn('json', items)
    expect(r.value_json).toEqual(items)
  })

  test('null raw value → all null columns', () => {
    const r = mapValueToColumn('money', null)
    expect(Object.values(r).every(v => v === null)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. normalize — bank_transfer ingest
// ═════════════════════════════════════════════════════════════════════════════
describe('normalize — bank_transfer', () => {
  beforeEach(() => {
    docTypeSvc.getByCode.mockResolvedValue(BANK_TRANSFER_TYPE)
    docTypeSvc.mapCategoryCode.mockResolvedValue('uuid-cat-invoice')
  })

  afterEach(() => jest.clearAllMocks())

  test('maps document_type_id and suggested_category_id', async () => {
    const ocrResult = {
      status: 'success',
      confidence: 0.90,
      classification: {
        document_type_code: 'bank_transfer',
        category_code: 'invoice',
        confidence: 0.92,
      },
      fields: {
        amount: '1.500.000',
        transfer_date: '23/04/2026',
        bank_name: 'Vietcombank',
        transfer_content: 'Thanh toan dich vu',
        payer_name: 'Nguyen Van A',
      },
      raw_structured_data: {},
    }

    const result = await normalize(ocrResult)

    expect(result.document_type_id).toBe('uuid-bank')
    expect(result.suggested_category_id).toBe('uuid-cat-invoice')
    expect(result.extraction_status).toBe('done')
    expect(result.classification_confidence).toBeCloseTo(0.92)
  })

  test('produces correct field entries', async () => {
    const ocrResult = {
      status: 'success',
      confidence: 0.88,
      classification: {
        document_type_code: 'bank_transfer',
        category_code: 'invoice',
        confidence: 0.88,
      },
      fields: {
        amount: '500000',
        transfer_date: '2026-04-23',
        bank_name: 'Techcombank',
      },
      raw_structured_data: {},
    }

    const result = await normalize(ocrResult)

    const amountEntry = result.fieldEntries.find(e => e.field_id === 'fid-amount')
    expect(amountEntry).toBeDefined()
    expect(amountEntry.value_number).toBe(500000)
    expect(amountEntry.source).toBe('ai')

    const dateEntry = result.fieldEntries.find(e => e.field_id === 'fid-date')
    expect(dateEntry.value_date).toBe('2026-04-23')

    const bankEntry = result.fieldEntries.find(e => e.field_id === 'fid-bank')
    expect(bankEntry.value_text).toBe('Techcombank')
  })

  test('low confidence → extraction_status needs_review', async () => {
    const ocrResult = {
      status: 'success',
      confidence: 0.40,
      classification: {
        document_type_code: 'bank_transfer',
        category_code: 'invoice',
        confidence: 0.45,
      },
      fields: { amount: '100000' },
      raw_structured_data: {},
    }

    const result = await normalize(ocrResult)
    expect(result.extraction_status).toBe('needs_review')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. normalize — weighing_slip
// ═════════════════════════════════════════════════════════════════════════════
describe('normalize — weighing_slip', () => {
  beforeEach(() => {
    docTypeSvc.getByCode.mockResolvedValue(WEIGHING_TYPE)
    docTypeSvc.mapCategoryCode.mockResolvedValue('uuid-cat-inventory')
  })

  afterEach(() => jest.clearAllMocks())

  test('net_weight stored as number', async () => {
    const ocrResult = {
      status: 'success',
      confidence: 0.85,
      classification: {
        document_type_code: 'weighing_slip',
        category_code: 'inventory',
        confidence: 0.80,
      },
      fields: {
        vehicle_number: '51A-12345',
        net_weight: 14500,
        weighing_date: '2026-04-23',
      },
      raw_structured_data: {},
    }

    const result = await normalize(ocrResult)

    const netEntry = result.fieldEntries.find(e => e.field_id === 'fid-net')
    expect(netEntry.value_number).toBe(14500)

    const dateEntry = result.fieldEntries.find(e => e.field_id === 'fid-wdate')
    expect(dateEntry.value_date).toBe('2026-04-23')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. normalize — work_report (no amount → no financial aggregation)
// ═════════════════════════════════════════════════════════════════════════════
describe('normalize — work_report (count-only)', () => {
  beforeEach(() => {
    docTypeSvc.getByCode.mockResolvedValue(WORK_REPORT_TYPE)
    docTypeSvc.mapCategoryCode.mockResolvedValue('uuid-cat-work')
  })

  afterEach(() => jest.clearAllMocks())

  test('no numeric fields extracted', async () => {
    const ocrResult = {
      status: 'success',
      confidence: 0.82,
      classification: {
        document_type_code: 'work_report',
        category_code: 'work_report',
        confidence: 0.80,
      },
      fields: {
        report_date: '23/04/2026',
        title: 'Báo cáo tuần 17',
        summary: 'Hoàn thành module đăng nhập',
      },
      raw_structured_data: {},
    }

    const result = await normalize(ocrResult)

    // No value_number in any entry
    const hasNumber = result.fieldEntries.some(e => e.value_number !== null && e.value_number !== undefined)
    expect(hasNumber).toBe(false)
    expect(result.document_type_id).toBe('uuid-work')
    expect(result.extraction_status).toBe('done')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. normalize — OCR failed
// ═════════════════════════════════════════════════════════════════════════════
describe('normalize — OCR failure paths', () => {
  test('failed OCR returns extraction_status=failed', async () => {
    const result = await normalize({ status: 'failed', confidence: 0, text: null })
    expect(result.extraction_status).toBe('failed')
    expect(result.fieldEntries).toHaveLength(0)
    expect(result.document_type_id).toBeNull()
  })

  test('null ocrResult returns extraction_status=failed', async () => {
    const result = await normalize(null)
    expect(result.extraction_status).toBe('failed')
  })

  test('missing classification → needs_review', async () => {
    const result = await normalize({
      status: 'success',
      confidence: 0.70,
      classification: null,
      fields: {},
      raw_structured_data: {},
    })
    expect(result.extraction_status).toBe('needs_review')
    expect(result.document_type_id).toBeNull()
  })

  test('unknown document_type_code → no field entries but not crash', async () => {
    docTypeSvc.getByCode.mockResolvedValue(null)
    docTypeSvc.mapCategoryCode.mockResolvedValue(null)

    const result = await normalize({
      status: 'success',
      confidence: 0.75,
      classification: {
        document_type_code: 'nonexistent_type',
        category_code: 'other',
        confidence: 0.70,
      },
      fields: { amount: 500000 },
      raw_structured_data: {},
    })

    expect(result.document_type_id).toBeNull()
    expect(result.fieldEntries).toHaveLength(0)
    // But extracted_data is still saved for debugging
    expect(result.extracted_data).not.toBeNull()
  })
})
