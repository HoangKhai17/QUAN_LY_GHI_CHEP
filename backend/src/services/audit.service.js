/**
 * Audit Service — ghi lại mọi action quan trọng vào audit_logs.
 *
 * Fire-and-forget: không await DB query để không block business logic.
 * Nếu insert lỗi → log warning, KHÔNG throw để tránh hỏng request.
 *
 * Không log: password, raw token, refresh_token, password_hash.
 */

const db = require('../config/db')
const logger = require('../config/logger')

const SENSITIVE_FIELDS = new Set([
  'password', 'password_hash', 'refresh_token', 'access_token',
  'token_hash', 'current_password', 'new_password',
])

function sanitize(data) {
  if (!data || typeof data !== 'object') return data
  const clean = {}
  for (const [k, v] of Object.entries(data)) {
    clean[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : v
  }
  return clean
}

/**
 * Ghi audit log — fire-and-forget, không throw.
 *
 * @param {string|null}  opts.userId
 * @param {string}       opts.action     - login_success | approve | flag | edit | delete | ...
 * @param {string|null}  opts.resource   - record | user | auth
 * @param {string|null}  opts.resourceId
 * @param {object|null}  opts.oldData
 * @param {object|null}  opts.newData
 * @param {object|null}  opts.req        - Express request (ip + user-agent)
 */
function logAudit({ userId = null, action, resource = null, resourceId = null, oldData = null, newData = null, req = null } = {}) {
  db.query(
    `INSERT INTO audit_logs
       (user_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      action,
      resource,
      resourceId || null,
      oldData ? JSON.stringify(sanitize(oldData)) : null,
      newData ? JSON.stringify(sanitize(newData)) : null,
      req?.ip || null,
      req?.headers?.['user-agent']?.slice(0, 500) || null,
    ]
  ).catch(err => logger.warn('audit.log_failed', { action, resource, error: err.message }))
}

module.exports = { logAudit }
