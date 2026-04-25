/**
 * Seed: Bulk Data — 100,000 records phân bổ đều 8 năm (2019–2026)
 *
 * Usage:
 *   node src/db/seeds/seed_bulk_data.js
 *   npm run seed:bulk
 *
 * Idempotent: ON CONFLICT DO NOTHING — an toàn khi chạy lại.
 * Tối ưu: bulk insert cả records lẫn field values theo từng batch.
 */

require('dotenv').config()
const { Pool } = require('pg')
const crypto   = require('crypto')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// ── Config ─────────────────────────────────────────────────────────────────────

const TARGET     = 100_000
const BATCH_SIZE = 500          // records mỗi lần insert
const YEARS      = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

// ── Helpers ────────────────────────────────────────────────────────────────────

const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick  = arr => arr[rand(0, arr.length - 1)]
const uuid  = () => crypto.randomUUID()
const pad2  = n => String(n).padStart(2, '0')

/** Ngày random trong một năm cụ thể, phân bổ đồng đều qua 12 tháng */
function randDateInYear(year) {
  const month = rand(1, 12)
  const maxDay = new Date(year, month, 0).getDate()
  const day    = rand(1, maxDay)
  const hour   = rand(0, 23)
  const min    = rand(0, 59)
  const sec    = rand(0, 59)
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(min)}:${pad2(sec)}+07:00`)
}

function toISO(d)  { return d.toISOString() }
function toDate(d) { return d.toISOString().split('T')[0] }

// ── Dữ liệu mẫu Việt Nam ──────────────────────────────────────────────────────

const VIET_NAMES = [
  'Nguyễn Văn An',   'Trần Thị Bình',  'Lê Văn Chiến',   'Phạm Thị Dung',
  'Hoàng Văn Em',    'Vũ Thị Phương',  'Đặng Văn Giang',  'Bùi Thị Hoa',
  'Ngô Văn Hùng',    'Dương Thị Lan',  'Đinh Văn Minh',   'Lý Thị Ngọc',
  'Phan Văn Phúc',   'Tô Thị Quyên',  'Hà Văn Sơn',      'Mai Thị Thanh',
  'Tạ Văn Tuấn',     'Cao Thị Uyên',  'Trịnh Văn Vinh',  'Lương Thị Xuân',
  'Nguyễn Thị Hồng', 'Trần Văn Long', 'Lê Thị Mai',       'Phạm Văn Nam',
  'Võ Thị Hạnh',     'Đỗ Văn Khoa',   'Huỳnh Thị Linh',  'Bùi Văn Đức',
  'Đinh Thị Thu',    'Lưu Văn Tài',   'Trương Thị Yến',  'Nguyễn Văn Bình',
]

const SENDER_NAMES = [
  '@HoangKhai_BBO', '@BaoPhuc_BBO', '@ThanhLiem_BBO', '@MinhTuan_BBO',
  '@QuocBao_BBO',   '@ThuHuong_BBO','@VanAnh_BBO',    '@DucManh_BBO',
  '@KimCuong_BBO',  '@AnhTuan_BBO', '@ThuyLinh_BBO',  '@MinhDuc_BBO',
  'Hoàng Khải', 'Bảo Phúc', 'Thành Liêm', 'Minh Tuấn',
  'Quốc Bảo',  'Thu Hương','Văn Anh',    'Đức Mạnh',
]

const BANKS = [
  'Vietcombank','Techcombank','BIDV','VietinBank','Agribank',
  'MBBank','ACB','SHB','TPBank','VPBank','HDBank','OCB',
  'SeABank','LPBank','BacABank','MSB','Sacombank','NamABank',
]

const PLATFORMS = ['telegram','telegram','telegram','zalo','zalo','manual']

// Trọng số loại tài liệu
const DOC_POOL = [
  ...Array(28).fill('bank_transfer'),
  ...Array(22).fill('expense_receipt'),
  ...Array(18).fill('restaurant_receipt'),
  ...Array(10).fill('weighing_slip'),
  ...Array(10).fill('income_receipt'),
  ...Array(6).fill('work_report'),
  ...Array(4).fill('inspection_report'),
  ...Array(2).fill('other'),
]

// Status theo tuổi record (tính bằng năm)
function statusForYear(year) {
  const age  = 2026 - year
  const r    = Math.random()
  if (age === 0) {
    // năm hiện tại: nhiều new hơn
    if (r < 0.20) return 'new'
    if (r < 0.38) return 'reviewed'
    if (r < 0.92) return 'approved'
    return 'flagged'
  }
  if (age <= 2) {
    if (r < 0.06) return 'new'
    if (r < 0.14) return 'reviewed'
    if (r < 0.93) return 'approved'
    return 'flagged'
  }
  // records cũ: hầu hết đã approved
  if (r < 0.02) return 'new'
  if (r < 0.05) return 'reviewed'
  if (r < 0.94) return 'approved'
  return 'flagged'
}

const NOTES_BY_TYPE = {
  bank_transfer:     ['Chuyển tiền mua hàng','CK thanh toán hóa đơn','Chuyển khoản công nợ','Thanh toán đơn hàng','CK lương nhân công','Trả tiền nhà cung cấp','Thanh toán dịch vụ tháng','Hoàn ứng tạm ứng','CK tiền cọc hợp đồng'],
  expense_receipt:   ['Chi mua văn phòng phẩm','Phiếu chi vận chuyển','Chi phí điện nước','Mua nguyên vật liệu','Chi sửa chữa thiết bị','Phiếu chi công tác phí','Chi phí tiếp khách','Chi bảo trì máy móc','Phiếu chi nội bộ'],
  restaurant_receipt:['Hóa đơn ăn uống team','Tiếp khách hàng','Ăn uống hội họp','Chi phí tiếp đãi','Hóa đơn nhà hàng','Ăn trưa nhóm','Tiệc cuối năm','Chiêu đãi đối tác','Ăn uống công tác'],
  weighing_slip:     ['Phiếu cân nhập kho','Phiếu cân xuất hàng','Cân xe tải vào','Cân xe ra cổng','Kiểm tra trọng tải','Phiếu cân hàng hóa','Cân nông sản','Cân vật tư xây dựng'],
  income_receipt:    ['Thu tiền hàng','Thu công nợ khách','Thu tiền đặt cọc','Thu phí dịch vụ','Phiếu thu tháng','Thu tiền bán hàng','Thu hoa hồng đại lý','Thu tiền thanh lý'],
  work_report:       ['Báo cáo công việc tuần','Tổng kết tháng','Cập nhật tiến độ','Báo cáo kinh doanh','Kết quả dự án','Báo cáo quý','Tổng kết năm','Đánh giá hiệu suất'],
  inspection_report: ['Kiểm tra chất lượng','Kiểm nghiệm sản phẩm','Biên bản kiểm tra','Phiếu nghiệm thu','Báo cáo kiểm định','Kiểm tra định kỳ','Kiểm soát chất lượng'],
  other:             ['Chứng từ khác','Tài liệu nội bộ','Biên bản xác nhận','Phiếu giao nhận','Văn bản tham khảo','Hồ sơ lưu trữ'],
}

// ── Field value generators ─────────────────────────────────────────────────────

function genFieldValues(docTypeCode, fieldDefs, year) {
  const refDate = toDate(randDateInYear(year))
  const v = {}

  switch (docTypeCode) {
    case 'bank_transfer': {
      const amount = rand(200_000, 100_000_000)
      v.amount           = amount
      v.transfer_date    = refDate
      v.reference_number = `REF${rand(100000, 999999)}`
      v.transaction_code = `FT${rand(10000000, 99999999)}`
      v.bank_name        = pick(BANKS)
      v.account_number   = String(rand(1000000000, 9999999999))
      v.account_holder   = pick(VIET_NAMES)
      v.transfer_content = pick(['Thanh toán hàng hóa','Trả tiền dịch vụ','CK mua hàng','Thanh toán công nợ','Ứng tiền công tác','Hoàn ứng','Lương tháng','Thưởng doanh số'])
      v.payer_name       = pick(VIET_NAMES)
      break
    }
    case 'weighing_slip': {
      const gross = +(rand(5000, 40000) / 100).toFixed(2)
      const empty = +(rand(100, 3000)  / 100).toFixed(2)
      const net   = +(Math.max(gross - empty, 0.1)).toFixed(2)
      const prov  = pick(['51','52','53','61','62','72','74','79','92','43','30','29','01','14'])
      v.vehicle_number = `${prov}${pick(['A','B','C','D','E','F','G','H','K'])}-${rand(10000,99999)}`
      v.ticket_number  = `PC${rand(1000, 9999)}`
      v.customer_name  = pick(VIET_NAMES)
      v.item_name      = pick(['Gạo trắng','Ngô hạt','Đậu nành','Cà phê nhân','Sắn lát','Phân bón NPK','Thức ăn gia súc','Lúa mì','Bắp','Tiêu','Điều nhân','Mì hạt'])
      v.gross_weight   = gross
      v.empty_weight   = empty
      v.net_weight     = net
      v.weighing_type  = pick(['vào','ra'])
      v.weighing_date  = refDate
      v.time_in        = `${pad2(rand(5,11))}:${pad2(rand(0,59))}`
      v.time_out       = `${pad2(rand(12,19))}:${pad2(rand(0,59))}`
      break
    }
    case 'restaurant_receipt': {
      const sub  = rand(80_000, 10_000_000)
      const disc = Math.random() > 0.55 ? rand(10_000, Math.floor(sub * 0.15)) : 0
      const tax  = Math.floor((sub - disc) * 0.08)
      v.restaurant_name = pick(['Nhà hàng Phố Cổ','Quán Hương Quê','Biển Xanh Restaurant','Quán Cơm Tấm Phúc','Nhà hàng Miền Tây','Lẩu Sài Gòn 68','Nhà hàng Bốn Mùa','Phở Hà Nội Xưa','Quán Bếp Việt','Nhà hàng Hải Sản Tươi'])
      v.receipt_number  = `HĐ-${rand(10000, 99999)}`
      v.receipt_date    = refDate
      v.subtotal        = sub
      v.discount        = disc
      v.tax             = tax
      v.total_amount    = sub - disc + tax
      break
    }
    case 'expense_receipt': {
      v.receipt_number  = `PC-${rand(1000, 9999)}`
      v.receipt_date    = refDate
      v.payee_name      = pick(VIET_NAMES)
      v.amount          = rand(50_000, 30_000_000)
      v.description     = pick(['Mua văn phòng phẩm','Chi phí vận chuyển','Tiền điện nước','Mua nguyên vật liệu','Chi sửa chữa thiết bị','Phí bảo trì','Chi phí in ấn','Mua thiết bị VP','Chi quảng cáo','Phí thuê mặt bằng'])
      v.payment_method  = pick(['Tiền mặt','Chuyển khoản','Thẻ ngân hàng'])
      v.approved_by     = pick(VIET_NAMES)
      break
    }
    case 'income_receipt': {
      v.receipt_number  = `PT-${rand(1000, 9999)}`
      v.receipt_date    = refDate
      v.payer_name      = pick(VIET_NAMES)
      v.amount          = rand(200_000, 80_000_000)
      v.description     = pick(['Thu tiền hàng hóa','Thu công nợ khách hàng','Thu tiền dịch vụ','Thu tiền đặt cọc','Thu phí vận chuyển','Thu tiền bán hàng','Thu hoa hồng'])
      v.payment_method  = pick(['Tiền mặt','Chuyển khoản','Thẻ ngân hàng'])
      break
    }
    case 'work_report': {
      const q = Math.ceil(new Date(refDate).getMonth() / 3) || 1
      v.report_date    = refDate
      v.title          = pick([`Báo cáo Q${q}/${year}`,`Tổng kết tháng ${rand(1,12)}/${year}`,`Tiến độ dự án ${rand(1,20)}`,`KPI tháng ${rand(1,12)}`,`Kết quả kinh doanh ${year}`])
      v.assignee_name  = pick(VIET_NAMES)
      v.summary        = pick(['Hoàn thành đúng tiến độ, không phát sinh vấn đề','Đang trong tiến trình theo kế hoạch','Gặp khó khăn, cần hỗ trợ thêm','Hoàn thành sớm hơn 2 ngày','Trễ nhẹ do nguyên nhân khách quan','Vượt chỉ tiêu đề ra'])
      v.status_report  = pick(['complete','complete','in_progress','in_progress','blocked'])
      break
    }
    case 'inspection_report': {
      v.inspection_date = refDate
      v.inspector_name  = pick(VIET_NAMES)
      v.location        = pick(['Kho A - Tầng 1','Kho B - Tầng 2','Xưởng sản xuất chính','Văn phòng tầng 3','Chi nhánh Quận 1','Chi nhánh Quận 7','Kho hàng Bình Dương','Nhà máy Long An','Kho Đà Nẵng','Chi nhánh Cần Thơ'])
      v.result          = pick(['pass','pass','pass','conditional','fail'])
      v.notes           = pick(['Đạt tiêu chuẩn, không có điểm bất thường','Cần cải thiện một số điểm, tái kiểm tra sau 30 ngày','Không đạt tiêu chuẩn, yêu cầu xử lý ngay','Tạm chấp nhận, theo dõi thêm 2 tuần','Đạt xuất sắc'])
      break
    }
    case 'other': {
      v.document_date = refDate
      v.description   = pick(['Chứng từ nội bộ phòng kế toán','Hợp đồng phụ lục','Biên bản nghiệm thu','Phiếu nhập kho','Phiếu xuất kho vật tư','Biên bản giao nhận tài sản','Hồ sơ pháp lý'])
      if (Math.random() > 0.35) v.amount = rand(100_000, 20_000_000)
      break
    }
  }

  return fieldDefs
    .filter(f => v[f.field_key] !== undefined && v[f.field_key] !== null)
    .map(f => {
      const val = v[f.field_key]
      return {
        field_id:      f.id,
        value_text:    ['text','boolean'].includes(f.data_type) ? String(val) : (f.data_type === 'money' || f.data_type === 'number' ? null : null),
        value_number:  (f.data_type === 'money' || f.data_type === 'number') ? (typeof val === 'number' ? val : parseFloat(val)) : null,
        value_date:    f.data_type === 'date' ? val : null,
        value_boolean: f.data_type === 'boolean' ? (val === true || val === 'true') : null,
        value_text_actual: f.data_type === 'text' ? String(val) : null,
      }
    })
    .map(r => ({
      field_id:      r.field_id,
      value_text:    r.value_text_actual,
      value_number:  r.value_number,
      value_date:    r.value_date,
      value_boolean: r.value_boolean,
    }))
    .filter(r => r.value_text !== null || r.value_number !== null || r.value_date !== null || r.value_boolean !== null)
}

// ── Bulk insert helpers ────────────────────────────────────────────────────────

/** Bulk insert records, trả về mảng { id, document_type_id, year } */
async function bulkInsertRecords(client, rows) {
  if (rows.length === 0) return []
  const COLS = 14
  const placeholders = rows.map((_, i) => {
    const b = i * COLS
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14})`
  }).join(',')

  const values = rows.flatMap(r => [
    r.id, r.platform, r.platform_message_id, r.sender_id, r.sender_name,
    r.note, r.category_id, r.document_type_id, r.status,
    r.ocr_status, r.extraction_status,
    r.classification_confidence, r.created_at, r.received_at,
  ])

  const { rows: inserted } = await client.query(
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
  return inserted
}

/** Bulk insert field values cho nhiều records cùng lúc */
async function bulkInsertFieldValues(client, fvRows) {
  if (fvRows.length === 0) return
  const COLS = 8
  // Chia thành sub-batches 2000 rows để tránh giới hạn params PostgreSQL
  const SUB = 2000
  for (let i = 0; i < fvRows.length; i += SUB) {
    const sub = fvRows.slice(i, i + SUB)
    const placeholders = sub.map((_, ri) => {
      const b = ri * COLS
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`
    }).join(',')
    const values = sub.flatMap(r => [
      r.record_id, r.field_id,
      r.value_text, r.value_number, r.value_date, r.value_boolean,
      r.source, r.confidence,
    ])
    await client.query(
      `INSERT INTO record_field_values
         (record_id, field_id, value_text, value_number, value_date, value_boolean, source, confidence)
       VALUES ${placeholders}
       ON CONFLICT (record_id, field_id) DO NOTHING`,
      values
    )
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect()
  const startTime = Date.now()
  console.log('✅ Kết nối DB thành công\n')

  try {
    // Load metadata
    console.log('📦 Đang load metadata...')
    const { rows: docTypes } = await client.query(
      `SELECT id, code, default_category_id FROM document_types WHERE is_active = true`
    )
    const docTypeByCode = Object.fromEntries(docTypes.map(d => [d.code, d]))

    const { rows: allFields } = await client.query(
      `SELECT id, document_type_id, field_key, data_type FROM document_type_fields ORDER BY display_order`
    )
    const fieldsByTypeId = {}
    for (const f of allFields) {
      if (!fieldsByTypeId[f.document_type_id]) fieldsByTypeId[f.document_type_id] = []
      fieldsByTypeId[f.document_type_id].push(f)
    }

    const { rows: users } = await client.query(`SELECT id FROM users WHERE is_active = true`)
    const senderIds = users.map(u => u.id)

    // Lọc DOC_POOL theo loại tài liệu thực có trong DB
    const validCodes = new Set(docTypes.map(d => d.code))
    const validPool  = DOC_POOL.filter(c => validCodes.has(c))

    console.log(`   ${docTypes.length} loại tài liệu | ${allFields.length} fields | ${users.length} users`)
    console.log(`   Mục tiêu: ${TARGET.toLocaleString()} records — ${YEARS.length} năm (${YEARS[0]}–${YEARS[YEARS.length-1]})\n`)

    // Phân bổ đều theo năm
    const perYear = Math.ceil(TARGET / YEARS.length)  // ~12,500 / năm

    let totalInserted = 0
    let totalFV       = 0
    const batchCount  = Math.ceil(TARGET / BATCH_SIZE)
    let batchDone     = 0

    for (const year of YEARS) {
      let yearInserted = 0
      const yearTarget = perYear

      while (yearInserted < yearTarget) {
        const batchSize = Math.min(BATCH_SIZE, yearTarget - yearInserted)

        // 1. Tạo records
        const recordRows = []
        for (let i = 0; i < batchSize; i++) {
          const docTypeCode = pick(validPool)
          const docType     = docTypeByCode[docTypeCode]
          if (!docType) continue

          const platform     = pick(PLATFORMS)
          const createdAt    = randDateInYear(year)
          const status       = statusForYear(year)
          const senderName   = pick(SENDER_NAMES)
          const senderId     = senderIds.length > 0 && Math.random() > 0.5
            ? pick(senderIds) : null
          const platformMsgId = platform !== 'manual'
            ? `bulk_${platform}_${uuid().replace(/-/g,'').slice(0,16)}`
            : null

          recordRows.push({
            id:                      uuid(),
            platform,
            platform_message_id:     platformMsgId,
            sender_id:               senderId,
            sender_name:             senderName,
            note:                    pick(NOTES_BY_TYPE[docTypeCode] ?? ['Dữ liệu demo']),
            category_id:             docType.default_category_id,
            document_type_id:        docType.id,
            status,
            ocr_status:              'success',
            extraction_status:       'done',
            classification_confidence: +(rand(75, 99) + Math.random()).toFixed(1),
            created_at:              toISO(createdAt),
            received_at:             toISO(createdAt),
            // metadata để gen field values
            _docTypeCode: docTypeCode,
            _docTypeId:   docType.id,
            _year:        year,
          })
        }

        // 2. Bulk insert records
        const inserted = await bulkInsertRecords(client, recordRows)

        // 3. Collect + bulk insert field values
        const allFvRows = []
        for (const rec of inserted) {
          const rowMeta    = recordRows.find(r => r.id === rec.id)
          if (!rowMeta) continue
          const fieldDefs  = fieldsByTypeId[rec.document_type_id] ?? []
          const fvs        = genFieldValues(rowMeta._docTypeCode, fieldDefs, rowMeta._year)
          const confidence = +(rand(80, 98) + Math.random()).toFixed(1)
          for (const fv of fvs) {
            allFvRows.push({
              record_id:     rec.id,
              field_id:      fv.field_id,
              value_text:    fv.value_text    ?? null,
              value_number:  fv.value_number  ?? null,
              value_date:    fv.value_date    ?? null,
              value_boolean: fv.value_boolean ?? null,
              source:        'ai',
              confidence,
            })
          }
        }
        await bulkInsertFieldValues(client, allFvRows)

        yearInserted  += inserted.length
        totalInserted += inserted.length
        totalFV       += allFvRows.length
        batchDone++

        // Progress
        const pct      = ((totalInserted / TARGET) * 100).toFixed(1)
        const elapsed  = ((Date.now() - startTime) / 1000).toFixed(0)
        const rate     = totalInserted / Math.max(elapsed, 1)
        const eta      = ((TARGET - totalInserted) / Math.max(rate, 1)).toFixed(0)
        process.stdout.write(
          `\r   [${pct}%] ${totalInserted.toLocaleString()}/${TARGET.toLocaleString()} records` +
          ` | ${year} | FV: ${totalFV.toLocaleString()} | ${elapsed}s | ETA: ${eta}s   `
        )
      }
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n\n✅ Hoàn thành trong ${elapsed}s\n`)

    const { rows: [s] } = await client.query(
      `SELECT
         COUNT(*)::int                                      AS total,
         COUNT(*) FILTER (WHERE status='approved')::int    AS approved,
         COUNT(*) FILTER (WHERE status='new')::int         AS new,
         COUNT(*) FILTER (WHERE status='reviewed')::int    AS reviewed,
         COUNT(*) FILTER (WHERE status='flagged')::int     AS flagged,
         MIN(EXTRACT(YEAR FROM created_at)::int)           AS year_min,
         MAX(EXTRACT(YEAR FROM created_at)::int)           AS year_max
       FROM records WHERE status != 'deleted'`
    )
    const { rows: [fvS] } = await client.query(`SELECT COUNT(*)::int AS n FROM record_field_values`)
    const { rows: byYear } = await client.query(
      `SELECT EXTRACT(YEAR FROM created_at)::int AS y, COUNT(*)::int AS n
       FROM records WHERE status != 'deleted'
       GROUP BY y ORDER BY y`
    )

    console.log('📊 Tổng kết database:')
    console.log(`   Records:      ${s.total.toLocaleString()} (${s.year_min}–${s.year_max})`)
    console.log(`   Approved:     ${s.approved.toLocaleString()}`)
    console.log(`   New:          ${s.new.toLocaleString()}`)
    console.log(`   Reviewed:     ${s.reviewed.toLocaleString()}`)
    console.log(`   Flagged:      ${s.flagged.toLocaleString()}`)
    console.log(`   Field values: ${fvS.n.toLocaleString()}`)
    console.log('\n   Phân bổ theo năm:')
    byYear.forEach(r => console.log(`     ${r.y}: ${r.n.toLocaleString().padStart(8)} records`))
    console.log('\n🎉 Xong!')

  } catch (err) {
    console.error('\n\n❌ Lỗi:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
