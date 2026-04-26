/**
 * Settings Router — system API key and integration config.
 * Admin-only: all endpoints require role=admin.
 *
 * GET  /api/settings        — list all settings (secrets masked)
 * PATCH /api/settings/:key  — set / update a setting value
 * DELETE /api/settings/:key — clear DB value (revert to .env fallback)
 */

const router      = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const settingsSvc = require('../../services/settings.service')
const { logAudit } = require('../../services/audit.service')
const db          = require('../../config/db')

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const data = await settingsSvc.getAllSettings()
  res.json({ data })
})

router.patch('/:key', requireAuth, requireRole('admin'), async (req, res) => {
  const { key } = req.params
  const { value } = req.body || {}

  if (value === undefined || value === null || String(value).trim() === '') {
    return res.status(400).json({ error: 'value is required and cannot be empty' })
  }

  const cleanValue = String(value).trim()
  await settingsSvc.setSetting(key, cleanValue, req.user.sub)

  // Live-reload timezone ngay lập tức khi admin đổi
  if (key === 'app_timezone') db.setTimezone(cleanValue)

  logAudit({ userId: req.user.sub, action: 'setting_updated', resource: 'system_settings', resourceId: key, req })
  res.json({ success: true })
})

router.delete('/:key', requireAuth, requireRole('admin'), async (req, res) => {
  await settingsSvc.clearSetting(req.params.key, req.user.sub)
  logAudit({ userId: req.user.sub, action: 'setting_cleared', resource: 'system_settings', resourceId: req.params.key, req })
  res.json({ success: true })
})

module.exports = router
