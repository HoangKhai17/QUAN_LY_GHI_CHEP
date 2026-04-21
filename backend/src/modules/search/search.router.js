const router = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')

// TODO Phase 7: implement search
router.get('/', requireAuth, (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
