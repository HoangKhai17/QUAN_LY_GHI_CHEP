const router = require('express').Router()
const db     = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')

// GET /api/notifications/summary — pending record count for bell badge
router.get('/summary', requireAuth, async (req, res) => {
  const { rows: [{ pending }] } = await db.query(
    `SELECT COUNT(*)::int AS pending FROM records WHERE status = 'new'`
  )
  res.json({ pending })
})

module.exports = router
