const router = require('express').Router()

// TODO Phase 2: implement auth
router.post('/login', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.post('/refresh', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.post('/logout', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))
router.get('/me', (req, res) => res.status(501).json({ error: 'Not implemented yet' }))

module.exports = router
