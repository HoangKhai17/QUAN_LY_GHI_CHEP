const db = require('../config/db')

async function logAudit({ userId, action, resource, resourceId, oldData, newData, req }) {
  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId || null,
      action,
      resource || null,
      resourceId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      req?.ip || null,
      req?.headers?.['user-agent'] || null,
    ]
  )
}

module.exports = { logAudit }
