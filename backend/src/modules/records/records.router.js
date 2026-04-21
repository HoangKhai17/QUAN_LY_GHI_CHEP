const router = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')

// TODO Phase 2: implement records CRUD
router.use(requireAuth)

router.get('/',          (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.get('/:id',       (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.patch('/:id',     (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.patch('/:id/status', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.delete('/:id',    (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
