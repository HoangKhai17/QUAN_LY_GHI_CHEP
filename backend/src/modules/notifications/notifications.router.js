const router = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')

// TODO Phase 5: implement notifications
router.get('/summary', requireAuth, (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
