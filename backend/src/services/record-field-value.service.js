/**
 * Record Field Value Service
 *
 * CRUD operations for record_field_values.
 * All writes accept an optional pg client so callers can wrap them
 * in an outer transaction (e.g. message.processor).
 */

const db = require('../config/db')
const logger = require('../config/logger')

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Batch-upsert field values for a record.
 *
 * @param {string} recordId UUID
 * @param {Array<{
 *   field_id: string,
 *   value_text?, value_number?, value_date?,
 *   value_datetime?, value_boolean?, value_json?,
 *   confidence?: number,
 *   source?: 'ai'|'human'|'rule'
 * }>} entries
 * @param {object} [client] — optional pg pool client (for outer transaction)
 */
async function upsertMany(recordId, entries, client = null) {
  if (!entries?.length) return

  const exec = client
    ? (sql, params) => client.query(sql, params)
    : (sql, params) => db.query(sql, params)

  for (const e of entries) {
    await exec(
      `INSERT INTO record_field_values
         (record_id, field_id,
          value_text, value_number, value_date, value_datetime,
          value_boolean, value_json,
          confidence, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (record_id, field_id) DO UPDATE
         SET value_text     = EXCLUDED.value_text,
             value_number   = EXCLUDED.value_number,
             value_date     = EXCLUDED.value_date,
             value_datetime = EXCLUDED.value_datetime,
             value_boolean  = EXCLUDED.value_boolean,
             value_json     = EXCLUDED.value_json,
             confidence     = EXCLUDED.confidence,
             source         = EXCLUDED.source,
             updated_at     = NOW()`,
      [
        recordId,
        e.field_id,
        e.value_text     ?? null,
        e.value_number   ?? null,
        e.value_date     ?? null,
        e.value_datetime ?? null,
        e.value_boolean  ?? null,
        e.value_json     != null ? JSON.stringify(e.value_json) : null,
        e.confidence     ?? null,
        e.source         ?? 'ai',
      ]
    )
  }

  logger.info('rfv.upsertMany.done', { recordId, count: entries.length })
}

/**
 * Update a single field value (human edit path).
 * Logs the old value to edit_logs.
 *
 * @param {string} recordId
 * @param {string} fieldId       — document_type_fields.id
 * @param {string} fieldKey      — for edit_log field_name
 * @param {object} typedValue    — { value_text?, value_number?, … }
 * @param {string} editedBy      — user UUID
 * @param {object} [client]
 */
async function updateSingle(recordId, fieldId, fieldKey, typedValue, editedBy, client = null) {
  const exec = client
    ? (sql, params) => client.query(sql, params)
    : (sql, params) => db.query(sql, params)

  // Fetch old value for audit
  const { rows: [old] } = await exec(
    `SELECT value_text, value_number, value_date, value_datetime,
            value_boolean, value_json
     FROM record_field_values
     WHERE record_id = $1 AND field_id = $2`,
    [recordId, fieldId]
  )

  await exec(
    `INSERT INTO record_field_values
       (record_id, field_id,
        value_text, value_number, value_date, value_datetime,
        value_boolean, value_json,
        confidence, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,'human')
     ON CONFLICT (record_id, field_id) DO UPDATE
       SET value_text     = EXCLUDED.value_text,
           value_number   = EXCLUDED.value_number,
           value_date     = EXCLUDED.value_date,
           value_datetime = EXCLUDED.value_datetime,
           value_boolean  = EXCLUDED.value_boolean,
           value_json     = EXCLUDED.value_json,
           confidence     = NULL,
           source         = 'human',
           updated_at     = NOW()`,
    [
      recordId, fieldId,
      typedValue.value_text     ?? null,
      typedValue.value_number   ?? null,
      typedValue.value_date     ?? null,
      typedValue.value_datetime ?? null,
      typedValue.value_boolean  ?? null,
      typedValue.value_json     != null ? JSON.stringify(typedValue.value_json) : null,
    ]
  )

  // Write edit_log entry
  const oldStr = _serializeValue(old)
  const newStr = _serializeValue(typedValue)

  await exec(
    `INSERT INTO edit_logs (record_id, edited_by, field_name, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)`,
    [recordId, editedBy, `field:${fieldKey}`, oldStr, newStr]
  )
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Returns all field values for a record, joined with their field definitions.
 * Result is an object keyed by field_key for easy frontend consumption.
 *
 * @param {string} recordId
 * @returns {Promise<object>} { field_key: { label, data_type, value, source, confidence } }
 */
async function getForRecord(recordId) {
  const { rows } = await db.query(
    `SELECT
       dtf.field_key,
       dtf.label,
       dtf.data_type,
       dtf.unit,
       dtf.is_reportable,
       dtf.aggregation_type,
       dtf.display_order,
       dtf.config,
       rfv.value_text,
       rfv.value_number,
       rfv.value_date,
       rfv.value_datetime,
       rfv.value_boolean,
       rfv.value_json,
       rfv.confidence,
       rfv.source,
       rfv.updated_at
     FROM record_field_values rfv
     JOIN document_type_fields dtf ON dtf.id = rfv.field_id
     WHERE rfv.record_id = $1
     ORDER BY dtf.display_order`,
    [recordId]
  )

  const result = {}
  for (const row of rows) {
    result[row.field_key] = {
      label:            row.label,
      data_type:        row.data_type,
      unit:             row.unit,
      is_reportable:    row.is_reportable,
      aggregation_type: row.aggregation_type,
      display_order:    row.display_order,
      config:           row.config,
      value:            _resolveValue(row),
      source:           row.source,
      confidence:       row.confidence ? parseFloat(row.confidence) : null,
      updated_at:       row.updated_at,
    }
  }
  return result
}

/**
 * Returns raw rows for report aggregation (not keyed).
 */
async function getReportableForRecords(recordIds) {
  if (!recordIds?.length) return []
  const { rows } = await db.query(
    `SELECT
       rfv.record_id,
       dtf.field_key,
       dtf.data_type,
       dtf.aggregation_type,
       dtf.is_reportable,
       rfv.value_number,
       rfv.value_text,
       rfv.value_date
     FROM record_field_values rfv
     JOIN document_type_fields dtf ON dtf.id = rfv.field_id
     WHERE rfv.record_id = ANY($1::uuid[])
       AND dtf.is_reportable = TRUE`,
    [recordIds]
  )
  return rows
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _resolveValue(row) {
  if (row.value_number   !== null) return parseFloat(row.value_number)
  if (row.value_date     !== null) return row.value_date
  if (row.value_datetime !== null) return row.value_datetime
  if (row.value_boolean  !== null) return row.value_boolean
  if (row.value_json     !== null) return row.value_json
  return row.value_text ?? null
}

function _serializeValue(v) {
  if (!v) return null
  const val = _resolveValue(v)
  return val !== null ? String(val) : null
}

/**
 * Batch-fetch field values for multiple records.
 * Returns { [record_id]: { [field_key]: { label, data_type, unit, value, source, confidence } } }
 */
async function getForRecords(recordIds) {
  if (!recordIds?.length) return {}
  const { rows } = await db.query(
    `SELECT
       rfv.record_id,
       dtf.field_key,
       dtf.label,
       dtf.data_type,
       dtf.unit,
       rfv.value_text, rfv.value_number, rfv.value_date,
       rfv.value_datetime, rfv.value_boolean, rfv.value_json,
       rfv.source, rfv.confidence
     FROM record_field_values rfv
     JOIN document_type_fields dtf ON dtf.id = rfv.field_id
     WHERE rfv.record_id = ANY($1::uuid[])
     ORDER BY dtf.display_order`,
    [recordIds]
  )
  const result = {}
  for (const row of rows) {
    if (!result[row.record_id]) result[row.record_id] = {}
    result[row.record_id][row.field_key] = {
      label:      row.label,
      data_type:  row.data_type,
      unit:       row.unit,
      value:      _resolveValue(row),
      source:     row.source,
      confidence: row.confidence ? parseFloat(row.confidence) : null,
    }
  }
  return result
}

module.exports = { upsertMany, updateSingle, getForRecord, getForRecords, getReportableForRecords }
