/**
 * backup.service.js
 *
 * PostgreSQL backup via pg_dump.
 * Backups are saved as plain SQL to backend/backups/.
 * Max MAX_BACKUPS files kept — oldest auto-deleted on rotation.
 *
 * Requires pg_dump in PATH, or set PG_DUMP_PATH=/path/to/pg_dump in .env
 */

const { spawn }  = require('child_process')
const fs         = require('fs')
const path       = require('path')
const logger     = require('../config/logger')

const BACKUP_DIR  = path.join(__dirname, '../../backups')
const MAX_BACKUPS = 10
const FILENAME_RE = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$/

// Tự tìm pg_dump theo thứ tự ưu tiên
const PG_DUMP_CANDIDATES = [
  process.env.PG_DUMP_PATH,
  'pg_dump',
  'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
].filter(Boolean)

function _resolvePgDump() {
  for (const candidate of PG_DUMP_CANDIDATES) {
    try {
      if (candidate === 'pg_dump') return candidate // thử qua PATH
      if (fs.existsSync(candidate)) return candidate
    } catch { /* skip */ }
  }
  return 'pg_dump' // last resort — sẽ throw ENOENT với message rõ
}

function ensureDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

function fmtSize(bytes) {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtFilename() {
  const now = new Date()
  const p   = n => String(n).padStart(2, '0')
  return `backup_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}.sql`
}

function _meta(filename) {
  const stat = fs.statSync(path.join(BACKUP_DIR, filename))
  return { filename, size_bytes: stat.size, size_label: fmtSize(stat.size), created_at: stat.mtime }
}

// ── Public API ─────────────────────────────────────────────────────────────────

function listBackups() {
  ensureDir()
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => FILENAME_RE.test(f))
    .sort()
    .reverse()
    .map(_meta)
}

function createBackup() {
  ensureDir()
  const filename = fmtFilename()
  const filepath = path.join(BACKUP_DIR, filename)
  const pgDump   = _resolvePgDump()

  const args = [
    '-h', process.env.DB_HOST || 'localhost',
    '-p', String(process.env.DB_PORT || 5432),
    '-U', process.env.DB_USER,
    '-d', process.env.DB_NAME,
    '--no-password',
    '-F', 'p',
    '-f', filepath,
  ]

  const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' }

  logger.info('backup.start', { filename, pgDump })

  return new Promise((resolve, reject) => {
    const proc = spawn(pgDump, args, { env })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', code => {
      if (code !== 0) {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
        logger.error('backup.failed', { code, stderr: stderr.slice(0, 300) })
        return reject(Object.assign(
          new Error(`pg_dump thoát với code ${code}: ${stderr.trim().slice(0, 200)}`),
          { status: 500 }
        ))
      }

      // Rotate — xóa bản cũ nếu vượt MAX_BACKUPS
      const all = fs.readdirSync(BACKUP_DIR).filter(f => FILENAME_RE.test(f)).sort()
      while (all.length > MAX_BACKUPS) {
        fs.unlinkSync(path.join(BACKUP_DIR, all.shift()))
      }

      const meta = _meta(filename)
      logger.info('backup.success', { filename, size: meta.size_label })
      resolve(meta)
    })

    proc.on('error', err => {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      logger.error('backup.spawn_error', { error: err.message })
      reject(Object.assign(
        new Error(
          `Không tìm thấy pg_dump. Thêm thư mục bin PostgreSQL vào PATH hoặc đặt PG_DUMP_PATH trong .env. (${err.message})`
        ),
        { status: 500 }
      ))
    })
  })
}

function getBackupPath(filename) {
  if (!FILENAME_RE.test(filename)) {
    throw Object.assign(new Error('Tên file backup không hợp lệ'), { status: 400 })
  }
  const fp = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(fp)) {
    throw Object.assign(new Error('Backup không tồn tại'), { status: 404 })
  }
  return fp
}

function deleteBackup(filename) {
  const fp = getBackupPath(filename)
  fs.unlinkSync(fp)
  logger.info('backup.deleted', { filename })
}

module.exports = { listBackups, createBackup, getBackupPath, deleteBackup }
