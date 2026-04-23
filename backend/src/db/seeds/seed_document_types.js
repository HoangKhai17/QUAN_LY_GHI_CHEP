/**
 * Seed: Document Types & Field Definitions
 *
 * Idempotent — safe to re-run. Uses ON CONFLICT DO UPDATE so existing
 * rows are updated in place (no duplicates, no data loss).
 *
 * Usage:
 *   node src/db/seeds/seed_document_types.js
 *   npm run seed:document-types
 */

require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// ── Category code → Vietnamese name (matches migration 002 seed) ─────────────
const CATEGORY_NAMES = {
  general:     'Chung',
  invoice:     'Hóa đơn',
  work_report: 'Báo cáo công việc',
  inventory:   'Kiểm kê',
  other:       'Khác',
}

// ── Document type definitions ─────────────────────────────────────────────────
// fields[].aggregation_type: 'sum' → included in financial reports
// fields[].is_reportable: true → surfaced in report queries
// fields[].is_filterable: true → available as filter param in GET /records
const DOCUMENT_TYPES = [
  {
    code: 'bank_transfer',
    name: 'Chuyển khoản ngân hàng',
    description: 'Biên lai / chứng từ chuyển khoản ngân hàng điện tử hoặc bản in',
    category: 'invoice',
    fields: [
      { key: 'amount',           label: 'Số tiền',             data_type: 'money',  is_required: true,  is_reportable: true,  aggregation_type: 'sum',  display_order: 1 },
      { key: 'transfer_date',    label: 'Ngày chuyển khoản',   data_type: 'date',   is_required: true,  is_filterable: true,  display_order: 2 },
      { key: 'reference_number', label: 'Số tham chiếu',       data_type: 'text',                                             display_order: 3 },
      { key: 'transaction_code', label: 'Mã giao dịch',        data_type: 'text',                                             display_order: 4 },
      { key: 'bank_name',        label: 'Ngân hàng',           data_type: 'text',   is_filterable: true,                      display_order: 5 },
      { key: 'account_number',   label: 'Số tài khoản',        data_type: 'text',                                             display_order: 6 },
      { key: 'account_holder',   label: 'Chủ tài khoản',       data_type: 'text',                                             display_order: 7 },
      { key: 'transfer_content', label: 'Nội dung chuyển',     data_type: 'text',                                             display_order: 8 },
      { key: 'payer_name',       label: 'Người chuyển',        data_type: 'text',   is_filterable: true,                      display_order: 9 },
    ],
  },
  {
    code: 'weighing_slip',
    name: 'Phiếu cân xe',
    description: 'Phiếu cân xe vào/ra, ghi nhận trọng lượng hàng hóa',
    category: 'inventory',
    fields: [
      { key: 'vehicle_number', label: 'Biển số xe',       data_type: 'text',   is_required: true,  is_filterable: true,  display_order: 1 },
      { key: 'ticket_number',  label: 'Số phiếu cân',     data_type: 'text',                                             display_order: 2 },
      { key: 'customer_name',  label: 'Khách hàng',       data_type: 'text',   is_filterable: true,                      display_order: 3 },
      { key: 'item_name',      label: 'Mặt hàng',         data_type: 'text',   is_filterable: true,                      display_order: 4 },
      { key: 'gross_weight',   label: 'Trọng lượng cả bì', data_type: 'number', unit: 'kg',         is_reportable: true,  display_order: 5 },
      { key: 'empty_weight',   label: 'Trọng lượng bì',   data_type: 'number', unit: 'kg',                               display_order: 6 },
      { key: 'net_weight',     label: 'Trọng lượng hàng', data_type: 'number', unit: 'kg',          is_required: true, is_reportable: true, aggregation_type: 'sum', display_order: 7 },
      { key: 'weighing_type',  label: 'Loại cân',         data_type: 'text',   config: { options: ['in','out'] },        display_order: 8 },
      { key: 'weighing_date',  label: 'Ngày cân',         data_type: 'date',   is_required: true,  is_filterable: true,  display_order: 9 },
      { key: 'time_in',        label: 'Giờ vào',          data_type: 'text',                                             display_order: 10 },
      { key: 'time_out',       label: 'Giờ ra',           data_type: 'text',                                             display_order: 11 },
    ],
  },
  {
    code: 'restaurant_receipt',
    name: 'Hóa đơn ăn uống',
    description: 'Hóa đơn / bill nhà hàng, quán ăn, cà phê',
    category: 'invoice',
    fields: [
      { key: 'restaurant_name', label: 'Tên nhà hàng / quán', data_type: 'text',   is_filterable: true,                      display_order: 1 },
      { key: 'receipt_number',  label: 'Số hóa đơn',          data_type: 'text',                                             display_order: 2 },
      { key: 'receipt_date',    label: 'Ngày',                 data_type: 'date',   is_required: true,  is_filterable: true,  display_order: 3 },
      { key: 'items',           label: 'Danh sách món',        data_type: 'json',                                             display_order: 4 },
      { key: 'subtotal',        label: 'Tạm tính',             data_type: 'money',  is_reportable: true,                      display_order: 5 },
      { key: 'discount',        label: 'Giảm giá',             data_type: 'money',                                            display_order: 6 },
      { key: 'tax',             label: 'Thuế / VAT',           data_type: 'money',                                            display_order: 7 },
      { key: 'total_amount',    label: 'Tổng tiền',            data_type: 'money',  is_required: true,  is_reportable: true,  aggregation_type: 'sum', display_order: 8 },
    ],
  },
  {
    code: 'expense_receipt',
    name: 'Phiếu chi',
    description: 'Phiếu chi nội bộ — ghi nhận khoản tiền chi ra',
    category: 'invoice',
    fields: [
      { key: 'receipt_number',  label: 'Số phiếu chi',   data_type: 'text',                                             display_order: 1 },
      { key: 'receipt_date',    label: 'Ngày chi',        data_type: 'date',   is_required: true,  is_filterable: true,  display_order: 2 },
      { key: 'payee_name',      label: 'Người nhận',      data_type: 'text',   is_required: true,  is_filterable: true,  display_order: 3 },
      { key: 'amount',          label: 'Số tiền',         data_type: 'money',  is_required: true,  is_reportable: true,  aggregation_type: 'sum', display_order: 4 },
      { key: 'description',     label: 'Nội dung chi',    data_type: 'text',                                             display_order: 5 },
      { key: 'payment_method',  label: 'Hình thức thanh toán', data_type: 'text', config: { options: ['cash','transfer','other'] }, display_order: 6 },
      { key: 'approved_by',     label: 'Người duyệt',     data_type: 'text',                                             display_order: 7 },
    ],
  },
  {
    code: 'income_receipt',
    name: 'Phiếu thu',
    description: 'Phiếu thu nội bộ — ghi nhận khoản tiền thu vào',
    category: 'invoice',
    fields: [
      { key: 'receipt_number',  label: 'Số phiếu thu',   data_type: 'text',                                             display_order: 1 },
      { key: 'receipt_date',    label: 'Ngày thu',        data_type: 'date',   is_required: true,  is_filterable: true,  display_order: 2 },
      { key: 'payer_name',      label: 'Người nộp',       data_type: 'text',   is_required: true,  is_filterable: true,  display_order: 3 },
      { key: 'amount',          label: 'Số tiền',         data_type: 'money',  is_required: true,  is_reportable: true,  aggregation_type: 'sum', display_order: 4 },
      { key: 'description',     label: 'Nội dung thu',    data_type: 'text',                                             display_order: 5 },
      { key: 'payment_method',  label: 'Hình thức',       data_type: 'text',   config: { options: ['cash','transfer','other'] }, display_order: 6 },
    ],
  },
  {
    code: 'work_report',
    name: 'Báo cáo công việc',
    description: 'Báo cáo tiến độ, biên bản họp, nhật ký công việc',
    category: 'work_report',
    fields: [
      { key: 'report_date',    label: 'Ngày báo cáo',  data_type: 'date',  is_required: true, is_filterable: true, display_order: 1 },
      { key: 'title',          label: 'Tiêu đề',        data_type: 'text',  is_required: true,                     display_order: 2 },
      { key: 'assignee_name',  label: 'Người thực hiện',data_type: 'text',  is_filterable: true,                   display_order: 3 },
      { key: 'summary',        label: 'Tóm tắt',        data_type: 'text',                                         display_order: 4 },
      { key: 'status_report',  label: 'Trạng thái',     data_type: 'text',  config: { options: ['complete','in_progress','blocked'] }, display_order: 5 },
    ],
  },
  {
    code: 'inspection_report',
    name: 'Phiếu kiểm tra / kiểm nghiệm',
    description: 'Biên bản kiểm tra chất lượng, kiểm nghiệm sản phẩm, nghiệm thu',
    category: 'inventory',
    fields: [
      { key: 'inspection_date',  label: 'Ngày kiểm tra',  data_type: 'date',  is_required: true, is_filterable: true, display_order: 1 },
      { key: 'inspector_name',   label: 'Người kiểm tra', data_type: 'text',  is_filterable: true,                    display_order: 2 },
      { key: 'location',         label: 'Địa điểm',       data_type: 'text',                                          display_order: 3 },
      { key: 'result',           label: 'Kết quả',        data_type: 'text',  is_reportable: true, config: { options: ['pass','fail','conditional'] }, display_order: 4 },
      { key: 'notes',            label: 'Ghi chú',        data_type: 'text',                                          display_order: 5 },
    ],
  },
  {
    code: 'other',
    name: 'Chứng từ khác',
    description: 'Loại chứng từ không thuộc các danh mục trên',
    category: 'other',
    fields: [
      { key: 'document_date', label: 'Ngày chứng từ', data_type: 'date',  is_filterable: true, display_order: 1 },
      { key: 'description',   label: 'Nội dung',       data_type: 'text',                       display_order: 2 },
      { key: 'amount',        label: 'Số tiền (nếu có)', data_type: 'money',                    display_order: 3 },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldRow(typeId, f) {
  return [
    typeId,
    f.key,
    f.label,
    f.data_type,
    f.unit       ?? null,
    f.is_required    ?? false,
    f.is_filterable  ?? false,
    f.is_reportable  ?? false,
    f.aggregation_type ?? 'none',
    f.display_order ?? 0,
    JSON.stringify(f.config ?? {}),
  ]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Build category name → id map
    const { rows: catRows } = await client.query('SELECT id, name FROM categories')
    const catByName = Object.fromEntries(catRows.map(r => [r.name, r.id]))

    let typesInserted = 0
    let fieldsInserted = 0

    for (const def of DOCUMENT_TYPES) {
      const defaultCatId = catByName[CATEGORY_NAMES[def.category]] ?? null

      const { rows: [dt] } = await client.query(
        `INSERT INTO document_types (code, name, description, default_category_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET name                = EXCLUDED.name,
               description         = EXCLUDED.description,
               default_category_id = EXCLUDED.default_category_id
         RETURNING id`,
        [def.code, def.name, def.description, defaultCatId]
      )
      typesInserted++

      for (const f of def.fields) {
        await client.query(
          `INSERT INTO document_type_fields
             (document_type_id, field_key, label, data_type, unit,
              is_required, is_filterable, is_reportable,
              aggregation_type, display_order, config)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
           ON CONFLICT (document_type_id, field_key) DO UPDATE
             SET label            = EXCLUDED.label,
                 data_type        = EXCLUDED.data_type,
                 unit             = EXCLUDED.unit,
                 is_required      = EXCLUDED.is_required,
                 is_filterable    = EXCLUDED.is_filterable,
                 is_reportable    = EXCLUDED.is_reportable,
                 aggregation_type = EXCLUDED.aggregation_type,
                 display_order    = EXCLUDED.display_order,
                 config           = EXCLUDED.config`,
          fieldRow(dt.id, f)
        )
        fieldsInserted++
      }

      console.log(`  [ok] ${def.code} (${def.fields.length} fields)`)
    }

    await client.query('COMMIT')
    console.log(`\nSeed complete. Types: ${typesInserted}, Fields: ${fieldsInserted}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
