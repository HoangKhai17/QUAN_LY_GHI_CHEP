/**
 * Document Types Router
 *
 * GET /api/document-types          — list all active types (staff+)
 * GET /api/document-types/:id      — single type with fields
 * GET /api/document-types/:id/fields — fields only
 *
 * Write endpoints (admin/manager only):
 * POST  /api/document-types        — create type  (future)
 * PATCH /api/document-types/:id    — update type  (future)
 */

const router     = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')
const docTypeSvc = require('../../services/document-types.service')

router.use(requireAuth)

// ── GET /api/document-types ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { include_inactive } = req.query
  const types = await docTypeSvc.getAll({ includeInactive: include_inactive === 'true' })
  // Strip fields array from list view for payload size
  const light = types.map(({ fields: _f, ...t }) => t)
  res.json({ data: light })
})

// ── GET /api/document-types/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const type = await docTypeSvc.getById(req.params.id)
  if (!type) return res.status(404).json({ error: 'Document type not found' })
  res.json(type)
})

// ── GET /api/document-types/:id/fields ───────────────────────────────────────
router.get('/:id/fields', async (req, res) => {
  const type = await docTypeSvc.getById(req.params.id)
  if (!type) return res.status(404).json({ error: 'Document type not found' })
  res.json({ data: type.fields })
})

module.exports = router
