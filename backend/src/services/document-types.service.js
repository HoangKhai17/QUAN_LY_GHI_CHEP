/**
 * Document Types Service
 *
 * In-memory schema cache (5-minute TTL) so every OCR call doesn't need
 * a DB round-trip just to look up a document type code.
 *
 * Cache is invalidated on any write operation (future admin UI).
 */

const db = require('../config/db')
const logger = require('../config/logger')

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

let _cache = null        // { byId, byCode, categoryByCode, categoryById }
let _cacheAt = 0

// ── Internal: build cache from DB ────────────────────────────────────────────

async function _loadCache() {
  const [{ rows: types }, { rows: fields }, { rows: cats }] = await Promise.all([
    db.query('SELECT * FROM document_types ORDER BY code'),
    db.query('SELECT * FROM document_type_fields ORDER BY document_type_id, display_order'),
    db.query('SELECT id, name FROM categories'),
  ])

  const byId   = new Map()
  const byCode = new Map()

  for (const t of types) {
    const entry = { ...t, fields: [] }
    byId.set(t.id, entry)
    byCode.set(t.code, entry)
  }

  for (const f of fields) {
    byId.get(f.document_type_id)?.fields.push(f)
  }

  // Category lookup (for code → id mapping in normalizer)
  const categoryById   = new Map(cats.map(c => [c.id,   c.name]))
  const categoryByName = new Map(cats.map(c => [c.name, c.id]))

  _cache   = { byId, byCode, categoryById, categoryByName }
  _cacheAt = Date.now()
  logger.info('document-types.cache.loaded', { types: types.length, fields: fields.length })
  return _cache
}

async function _getCache() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache
  return _loadCache()
}

function invalidateCache() {
  _cache = null
  _cacheAt = 0
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all active document types (without fields).
 */
async function getAll({ includeInactive = false } = {}) {
  const cache = await _getCache()
  const all = [...cache.byCode.values()]
  return includeInactive ? all : all.filter(t => t.is_active)
}

/**
 * Returns a single document type with its field definitions.
 * @param {string} id UUID
 */
async function getById(id) {
  const cache = await _getCache()
  return cache.byId.get(id) ?? null
}

/**
 * Returns a single document type with its field definitions.
 * @param {string} code e.g. 'bank_transfer'
 */
async function getByCode(code) {
  const cache = await _getCache()
  return cache.byCode.get(code) ?? null
}

/**
 * Returns field definitions for a document type.
 * @param {string} typeId UUID
 * @returns {Array} ordered field definitions
 */
async function getFields(typeId) {
  const t = await getById(typeId)
  return t?.fields ?? []
}

/**
 * Maps an AI-suggested category_code ('invoice', 'general', …)
 * to the matching category row id.
 *
 * Code → Vietnamese name mapping mirrors seed_document_types.js.
 * Falls back to null if not found (safe — category_id is nullable).
 */
async function mapCategoryCode(code) {
  const CATEGORY_NAMES = {
    general:     'Chung',
    invoice:     'Hóa đơn',
    work_report: 'Báo cáo công việc',
    inventory:   'Kiểm kê',
    other:       'Khác',
  }
  const name = CATEGORY_NAMES[code]
  if (!name) return null
  const cache = await _getCache()
  return cache.categoryByName.get(name) ?? null
}

/**
 * Maps a document_type_id UUID to its code string.
 * Useful for display without a full join.
 */
async function getCodeById(id) {
  const t = await getById(id)
  return t?.code ?? null
}

module.exports = {
  getAll,
  getById,
  getByCode,
  getFields,
  mapCategoryCode,
  getCodeById,
  invalidateCache,
}
