const ExcelJS = require('exceljs')
const logger = require('../config/logger')

// TODO Phase 8: implement PDF với pdfkit
async function generateExcel(records, meta) {
  logger.info('report.excel.start', { count: records.length })
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Báo cáo')

  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Người gửi', key: 'sender_name', width: 20 },
    { header: 'Thời gian nhận', key: 'received_at', width: 20 },
    { header: 'Ghi chú', key: 'note', width: 40 },
    { header: 'OCR Text', key: 'ocr_text', width: 40 },
    { header: 'Trạng thái', key: 'status', width: 15 },
    { header: 'Danh mục', key: 'category', width: 15 },
  ]

  records.forEach((r, i) => {
    sheet.addRow({ stt: i + 1, ...r })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

module.exports = { generateExcel }
