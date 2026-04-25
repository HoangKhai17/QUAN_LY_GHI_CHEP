/**
 * Seed: Demo Data — 900 records mới + field values cho tất cả records
 *
 * Usage:
 *   node src/db/seeds/seed_demo_data.js
 *
 * Idempotent: bỏ qua record đã tồn tại (ON CONFLICT DO NOTHING),
 * chỉ INSERT field values cho records chưa có.
 */

require('dotenv').config()
const { Pool } = require('pg')
const crypto = require('crypto')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr)       { return arr[rand(0, arr.length - 1)] }
function uuid()          { return crypto.randomUUID() }

/** Ngày random trong khoảng [startDaysAgo, endDaysAgo] tính từ hôm nay */
function randDate(startDaysAgo, endDaysAgo = 0) {
  const ms  = rand(endDaysAgo, startDaysAgo) * 24 * 60 * 60 * 1000
  const d   = new Date(Date.now() - ms)
  return d
}

function toISO(d)  { return d.toISOString() }
function toDate(d) { return d.toISOString().split('T')[0] }

// ── Dữ liệu mẫu Việt Nam ──────────────────────────────────────────────────────

const SENDER_NAMES = [
  '@HoangKhai_BBO', '@BaoPhuc_BBO', '@ThanhLiem_BBO', '@MinhTuan_BBO',
  '@QuocBao_BBO', '@ThuHuong_BBO', '@VanAnh_BBO', '@DucManh_BBO',
  'Hoàng Khải', 'Bảo Phúc', 'Thành Liêm', 'Minh Tuấn',
  'Quốc Bảo', 'Thu Hương', 'Văn Anh', 'Đức Mạnh',
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Chiến', 'Phạm Thị Dung',
]

const VIET_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Chiến', 'Phạm Thị Dung',
  'Hoàng Văn Em', 'Vũ Thị Phương', 'Đặng Văn Giang', 'Bùi Thị Hoa',
  'Ngô Văn Hùng', 'Dương Thị Lan', 'Đinh Văn Minh', 'Lý Thị Ngọc',
  'Phan Văn Phúc', 'Tô Thị Quyên', 'Hà Văn Sơn', 'Mai Thị Thanh',
  'Tạ Văn Tuấn', 'Cao Thị Uyên', 'Trịnh Văn Vinh', 'Lương Thị Xuân',
  'Nguyễn Thị Hồng', 'Trần Văn Long', 'Lê Thị Mai', 'Phạm Văn Nam',
]

const BANKS = [
  'Vietcombank', 'Techcombank', 'BIDV', 'VietinBank', 'Agribank',
  'MBBank', 'ACB', 'SHB', 'TPBank', 'VPBank', 'HDBank', 'OCB',
  'SeABank', 'LPBank', 'BacABank', 'MSB', 'Sacombank',
]

const PLATFORMS = ['telegram', 'telegram', 'telegram', 'zalo', 'zalo', 'manual']

const DOC_TYPE_WEIGHTS = [
  { code: 'bank_transfer',     weight: 28 },
  { code: 'expense_receipt',   weight: 22 },
  { code: 'restaurant_receipt',weight: 18 },
  { code: 'weighing_slip',     weight: 10 },
  { code: 'income_receipt',    weight: 10 },
  { code: 'work_report',       weight:  6 },
  { code: 'inspection_report', weight:  4 },
  { code: 'other',             weight:  2 },
]

// Tạo bảng lookup có trọng số
const DOC_TYPE_POOL = DOC_TYPE_WEIGHTS.flatMap(({ code, weight }) =>
  Array(weight).fill(code)
)

// Phân bố ngày: 40% trong 120 ngày gần đây, 40% trong năm 2025, 20% trong 2024
function randWeightedDate() {
  const r = Math.random()
  if (r < 0.40) return randDate(120, 1)        // 4 tháng gần đây
  if (r < 0.80) return randDate(480, 121)       // ~2025
  return randDate(850, 481)                      // ~2024
}

// Trạng thái phụ thuộc vào ngày (cũ hơn → dễ đã approved hơn)
function statusForAge(daysAgo) {
  const r = Math.random()
  if (daysAgo < 14) {
    if (r < 0.45) return 'new'
    if (r < 0.70) return 'reviewed'
    if (r < 0.92) return 'approved'
    return 'flagged'
  }
  if (daysAgo < 60) {
    if (r < 0.15) return 'new'
    if (r < 0.30) return 'reviewed'
    if (r < 0.93) return 'approved'
    return 'flagged'
  }
  if (r < 0.04) return 'new'
  if (r < 0.08) return 'reviewed'
  if (r < 0.94) return 'approved'
  return 'flagged'
}

const NOTES_BY_TYPE = {
  bank_transfer:     ['Chuyển tiền mua hàng', 'CK thanh toán hóa đơn', 'Chuyển khoản công nợ', 'Thanh toán đơn hàng', 'CK lương nhân công', 'Trả tiền nhà cung cấp'],
  expense_receipt:   ['Chi mua văn phòng phẩm', 'Phiếu chi vận chuyển', 'Chi phí điện nước', 'Mua nguyên vật liệu', 'Chi sửa chữa thiết bị', 'Phiếu chi công tác phí'],
  restaurant_receipt:['Hóa đơn ăn uống team', 'Tiếp khách hàng', 'Ăn uống hội họp', 'Chi phí tiếp đãi', 'Hóa đơn nhà hàng', 'Ăn trưa nhóm'],
  weighing_slip:     ['Phiếu cân nhập kho', 'Phiếu cân xuất hàng', 'Cân xe tải vào', 'Cân xe ra cổng', 'Kiểm tra trọng tải'],
  income_receipt:    ['Thu tiền hàng', 'Thu công nợ khách', 'Thu tiền đặt cọc', 'Thu phí dịch vụ', 'Phiếu thu tháng'],
  work_report:       ['Báo cáo công việc tuần', 'Tổng kết tháng', 'Cập nhật tiến độ', 'Báo cáo kinh doanh', 'Kết quả dự án'],
  inspection_report: ['Kiểm tra chất lượng', 'Kiểm nghiệm sản phẩm', 'Biên bản kiểm tra', 'Phiếu nghiệm thu', 'Báo cáo kiểm định'],
  other:             ['Chứng từ khác', 'Tài liệu nội bộ', 'Biên bản xác nhận', 'Phiếu giao nhận', 'Văn bản tham khảo'],
}

// ── Field value generators theo từng doc type ──────────────────────────────────

function genFieldValues(docTypeCode, fieldDefs) {
  const values = {}

  switch (docTypeCode) {
    case 'bank_transfer': {
      const amount = rand(200000, 80000000)
      const date   = toDate(randWeightedDate())
      values.amount           = amount
      values.transfer_date    = date
      values.reference_number = `REF${rand(100000, 999999)}`
      values.transaction_code = `FT${rand(10000000, 99999999)}`
      values.bank_name        = pick(BANKS)
      values.account_number   = String(rand(1000000000, 9999999999))
      values.account_holder   = pick(VIET_NAMES)
      values.transfer_content = pick(['Thanh toán hàng hóa', 'Trả tiền dịch vụ', 'CK mua hàng', 'Thanh toán công nợ', 'Ứng tiền công tác', 'Hoàn ứng', 'Lương tháng'])
      values.payer_name       = pick(VIET_NAMES)
      break
    }
    case 'weighing_slip': {
      const gross = +(rand(8000, 35000) / 100).toFixed(2)
      const empty = +(rand(200, 2000) / 100).toFixed(2)
      const net   = +(Math.max(gross - empty, 0.1)).toFixed(2)
      const prov  = pick(['51', '52', '53', '61', '62', '72', '74', '79', '92', '43'])
      const plate = `${prov}${pick(['A','B','C','D','E','F','G','H','K'])}-${rand(10000, 99999)}`
      values.vehicle_number = plate
      values.ticket_number  = `PC${rand(1000, 9999)}`
      values.customer_name  = pick(VIET_NAMES)
      values.item_name      = pick(['Gạo trắng', 'Ngô hạt', 'Đậu nành', 'Cà phê nhân', 'Sắn lát', 'Phân bón NPK', 'Thức ăn gia súc', 'Lúa mì', 'Mì hạt', 'Bắp'])
      values.gross_weight   = gross
      values.empty_weight   = empty
      values.net_weight     = net
      values.weighing_type  = pick(['vào', 'ra'])
      values.weighing_date  = toDate(randWeightedDate())
      values.time_in        = `${String(rand(6,11)).padStart(2,'0')}:${String(rand(0,59)).padStart(2,'0')}`
      values.time_out       = `${String(rand(11,18)).padStart(2,'0')}:${String(rand(0,59)).padStart(2,'0')}`
      break
    }
    case 'restaurant_receipt': {
      const subtotal = rand(80000, 8000000)
      const discount = Math.random() > 0.6 ? rand(10000, Math.floor(subtotal * 0.15)) : 0
      const tax      = Math.floor((subtotal - discount) * 0.08)
      values.restaurant_name = pick(['Nhà hàng Phố Cổ', 'Quán Hương Quê', 'Biển Xanh Restaurant', 'Quán Cơm Tấm Phúc', 'Nhà hàng Miền Tây', 'Lẩu Sài Gòn 68', 'Nhà hàng Bốn Mùa', 'Quán Phở Hà Nội'])
      values.receipt_number  = `HĐ-${rand(10000, 99999)}`
      values.receipt_date    = toDate(randWeightedDate())
      values.subtotal        = subtotal
      values.discount        = discount
      values.tax             = tax
      values.total_amount    = subtotal - discount + tax
      break
    }
    case 'expense_receipt': {
      values.receipt_number  = `PC-${rand(1000, 9999)}`
      values.receipt_date    = toDate(randWeightedDate())
      values.payee_name      = pick(VIET_NAMES)
      values.amount          = rand(50000, 25000000)
      values.description     = pick(['Mua văn phòng phẩm', 'Chi phí vận chuyển', 'Tiền điện nước', 'Mua nguyên vật liệu', 'Chi phí sửa chữa', 'Phí dịch vụ bảo trì', 'Chi phí in ấn', 'Mua thiết bị văn phòng'])
      values.payment_method  = pick(['Tiền mặt', 'Chuyển khoản', 'Thẻ ngân hàng'])
      values.approved_by     = pick(VIET_NAMES)
      break
    }
    case 'income_receipt': {
      values.receipt_number  = `PT-${rand(1000, 9999)}`
      values.receipt_date    = toDate(randWeightedDate())
      values.payer_name      = pick(VIET_NAMES)
      values.amount          = rand(200000, 50000000)
      values.description     = pick(['Thu tiền hàng hóa', 'Thu công nợ khách hàng', 'Thu tiền dịch vụ', 'Thu tiền đặt cọc', 'Thu phí vận chuyển', 'Thu tiền bán hàng tháng'])
      values.payment_method  = pick(['Tiền mặt', 'Chuyển khoản', 'Thẻ ngân hàng'])
      break
    }
    case 'work_report': {
      values.report_date   = toDate(randWeightedDate())
      values.title         = pick(['Báo cáo tiến độ dự án Q' + rand(1,4), 'Tổng kết tuần ' + rand(1,52), 'Báo cáo công việc tháng ' + rand(1,12), 'Cập nhật tình hình kinh doanh', 'Kết quả thực hiện kế hoạch'])
      values.assignee_name = pick(VIET_NAMES)
      values.summary       = pick(['Hoàn thành đúng tiến độ, không phát sinh vấn đề', 'Đang trong tiến trình thực hiện theo kế hoạch', 'Gặp một số khó khăn, cần hỗ trợ thêm nguồn lực', 'Hoàn thành sớm hơn kế hoạch 2 ngày', 'Trễ tiến độ do nguyên nhân khách quan'])
      values.status_report = pick(['complete', 'complete', 'in_progress', 'in_progress', 'blocked'])
      break
    }
    case 'inspection_report': {
      values.inspection_date = toDate(randWeightedDate())
      values.inspector_name  = pick(VIET_NAMES)
      values.location        = pick(['Kho A - Tầng 1', 'Kho B - Tầng 2', 'Xưởng sản xuất chính', 'Văn phòng tầng 3', 'Chi nhánh Quận 1', 'Chi nhánh Quận 7', 'Kho hàng Bình Dương', 'Nhà máy Long An'])
      values.result          = pick(['pass', 'pass', 'pass', 'conditional', 'fail'])
      values.notes           = pick(['Đạt tiêu chuẩn, không có điểm bất thường', 'Cần cải thiện một số điểm nhỏ, tái kiểm tra sau 30 ngày', 'Không đạt tiêu chuẩn, yêu cầu xử lý ngay', 'Tạm chấp nhận, theo dõi thêm trong 2 tuần', 'Đạt xuất sắc, không phát sinh vấn đề'])
      break
    }
    case 'other': {
      values.document_date = toDate(randWeightedDate())
      values.description   = pick(['Chứng từ nội bộ phòng kế toán', 'Hợp đồng phụ lục', 'Biên bản nghiệm thu công trình', 'Phiếu nhập kho hàng hóa', 'Phiếu xuất kho vật tư', 'Biên bản giao nhận tài sản'])
      if (Math.random() > 0.4) values.amount = rand(100000, 15000000)
      break
    }
  }

  // Map sang field_id + value column
  return fieldDefs
    .filter(f => values[f.field_key] !== undefined && values[f.field_key] !== null)
    .map(f => {
      const val = values[f.field_key]
      const row = { field_id: f.id }
      switch (f.data_type) {
        case 'money':
        case 'number':  row.value_number = typeof val === 'number' ? val : parseFloat(val); break
        case 'date':    row.value_date   = val; break
        case 'boolean': row.value_boolean = val; break
        default:        row.value_text   = String(val); break
      }
      return row
    })
    .filter(r => Object.keys(r).length > 1)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect()
  console.log('✅ Kết nối DB thành công\n')

  try {
    // 1. Load metadata từ DB
    console.log('📦 Đang load metadata...')

    const { rows: categories } = await client.query(
      `SELECT id, name FROM categories WHERE is_active = true`
    )
    const catByName = Object.fromEntries(categories.map(c => [c.name, c.id]))

    const { rows: docTypes } = await client.query(
      `SELECT id, code, name, default_category_id FROM document_types WHERE is_active = true`
    )
    const docTypeByCode = Object.fromEntries(docTypes.map(d => [d.code, d]))

    const { rows: allFields } = await client.query(
      `SELECT id, document_type_id, field_key, data_type
       FROM document_type_fields
       ORDER BY display_order`
    )
    const fieldsByType = {}
    for (const f of allFields) {
      if (!fieldsByType[f.document_type_id]) fieldsByType[f.document_type_id] = []
      fieldsByType[f.document_type_id].push(f)
    }

    // 2. Load existing sender_ids từ users table
    const { rows: users } = await client.query(
      `SELECT id, name FROM users WHERE is_active = true LIMIT 20`
    )
    const senderIds = users.map(u => u.id)

    console.log(`   ${docTypes.length} loại tài liệu | ${allFields.length} fields | ${users.length} users\n`)

    // 3. Insert 900 records mới
    const TARGET = 900
    const BATCH  = 50
    let inserted = 0

    console.log(`🔄 Đang sinh ${TARGET} records mới...`)

    for (let batch = 0; batch < Math.ceil(TARGET / BATCH); batch++) {
      const batchSize = Math.min(BATCH, TARGET - batch * BATCH)
      const recordRows = []

      for (let i = 0; i < batchSize; i++) {
        const docTypeCode = pick(DOC_TYPE_POOL)
        const docType     = docTypeByCode[docTypeCode]
        if (!docType) continue

        const platform     = pick(PLATFORMS)
        const createdAt    = randWeightedDate()
        const daysAgo      = Math.floor((Date.now() - createdAt) / 86400000)
        const status       = statusForAge(daysAgo)
        const senderName   = pick(SENDER_NAMES)
        const senderId     = senderIds.length > 0 && Math.random() > 0.5
          ? pick(senderIds) : null

        const platformMsgId = platform !== 'manual'
          ? `demo_${platform}_${uuid().replace(/-/g, '').slice(0, 16)}`
          : null

        const notes = NOTES_BY_TYPE[docTypeCode] ?? ['Dữ liệu demo']

        recordRows.push({
          id:                 uuid(),
          platform,
          platform_message_id: platformMsgId,
          sender_id:          senderId,
          sender_name:        senderName,
          note:               pick(notes),
          category_id:        docType.default_category_id,
          document_type_id:   docType.id,
          status,
          ocr_status:         'success',
          extraction_status:  'done',
          classification_confidence: +(rand(75, 98) + Math.random()).toFixed(1),
          created_at:         toISO(createdAt),
          received_at:        toISO(createdAt),
        })
      }

      // Bulk insert records
      const placeholders = recordRows.map((_, ri) => {
        const base = ri * 14
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14})`
      }).join(',')

      const values = recordRows.flatMap(r => [
        r.id, r.platform, r.platform_message_id, r.sender_id, r.sender_name,
        r.note, r.category_id, r.document_type_id, r.status,
        r.ocr_status, r.extraction_status,
        r.classification_confidence, r.created_at, r.received_at,
      ])

      const { rows: insertedRecords } = await client.query(
        `INSERT INTO records
           (id, platform, platform_message_id, sender_id, sender_name,
            note, category_id, document_type_id, status,
            ocr_status, extraction_status,
            classification_confidence, created_at, received_at)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING
         RETURNING id, document_type_id`,
        values
      )

      // Insert field values cho từng record vừa insert thành công
      for (const rec of insertedRecords) {
        const docType = docTypes.find(d => d.id === rec.document_type_id)
        if (!docType) continue
        const fieldDefs = fieldsByType[rec.document_type_id] ?? []
        if (fieldDefs.length === 0) continue

        const fvRows = genFieldValues(docType.code, fieldDefs)
        if (fvRows.length === 0) continue

        for (const fv of fvRows) {
          const col = Object.keys(fv).find(k => k !== 'field_id')
          if (!col) continue
          await client.query(
            `INSERT INTO record_field_values (record_id, field_id, ${col}, source, confidence)
             VALUES ($1, $2, $3, 'ai', $4)
             ON CONFLICT (record_id, field_id) DO NOTHING`,
            [rec.id, fv.field_id, fv[col], +(rand(80, 99) + Math.random()).toFixed(1)]
          )
        }
      }

      inserted += insertedRecords.length
      process.stdout.write(`\r   Đã insert: ${inserted}/${TARGET} records`)
    }

    console.log(`\n✅ Đã thêm ${inserted} records mới\n`)

    // 4. Cập nhật field values cho records cũ chưa có
    console.log('🔄 Đang cập nhật field values cho records cũ...')

    const { rows: oldRecords } = await client.query(
      `SELECT r.id, r.document_type_id
       FROM records r
       WHERE r.document_type_id IS NOT NULL
         AND r.status != 'deleted'
         AND NOT EXISTS (
           SELECT 1 FROM record_field_values rfv WHERE rfv.record_id = r.id
         )`
    )

    console.log(`   Tìm thấy ${oldRecords.length} records cũ chưa có field values`)

    let updated = 0
    for (const rec of oldRecords) {
      const docType = docTypes.find(d => d.id === rec.document_type_id)
      if (!docType) continue
      const fieldDefs = fieldsByType[rec.document_type_id] ?? []
      if (fieldDefs.length === 0) continue

      const fvRows = genFieldValues(docType.code, fieldDefs)
      for (const fv of fvRows) {
        const col = Object.keys(fv).find(k => k !== 'field_id')
        if (!col) continue
        await client.query(
          `INSERT INTO record_field_values (record_id, field_id, ${col}, source, confidence)
           VALUES ($1, $2, $3, 'human', $4)
           ON CONFLICT (record_id, field_id) DO NOTHING`,
          [rec.id, fv.field_id, fv[col], +(rand(85, 99) + Math.random()).toFixed(1)]
        )
      }
      updated++
    }

    console.log(`✅ Đã cập nhật ${updated} records cũ\n`)

    // 5. Summary
    const { rows: [summary] } = await client.query(
      `SELECT
         COUNT(*)::int                                           AS total_records,
         COUNT(*) FILTER (WHERE status = 'approved')::int       AS approved,
         COUNT(*) FILTER (WHERE status = 'new')::int            AS new,
         COUNT(*) FILTER (WHERE status = 'reviewed')::int       AS reviewed,
         COUNT(*) FILTER (WHERE status = 'flagged')::int        AS flagged
       FROM records WHERE status != 'deleted'`
    )
    const { rows: [fvSummary] } = await client.query(
      `SELECT COUNT(*)::int AS total_field_values FROM record_field_values`
    )

    console.log('📊 Tổng kết database:')
    console.log(`   Records:      ${summary.total_records} tổng`)
    console.log(`   Approved:     ${summary.approved}`)
    console.log(`   New:          ${summary.new}`)
    console.log(`   Reviewed:     ${summary.reviewed}`)
    console.log(`   Flagged:      ${summary.flagged}`)
    console.log(`   Field values: ${fvSummary.total_field_values}`)
    console.log('\n🎉 Hoàn thành!')

  } catch (err) {
    console.error('\n❌ Lỗi:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
