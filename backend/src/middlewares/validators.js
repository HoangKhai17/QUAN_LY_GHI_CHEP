const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUUID(...paramNames) {
  return (req, res, next) => {
    for (const p of paramNames) {
      if (!UUID_RE.test(req.params[p] ?? '')) {
        return res.status(400).json({ error: `Invalid ${p}: must be a UUID` })
      }
    }
    next()
  }
}

module.exports = { requireUUID }
