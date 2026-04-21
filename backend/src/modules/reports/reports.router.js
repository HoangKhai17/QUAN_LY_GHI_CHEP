const router = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')

// TODO Phase 8: implement reports
router.use(requireAuth)

router.get('/',                   (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.post('/generate',          (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.get('/:id/download',       (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
