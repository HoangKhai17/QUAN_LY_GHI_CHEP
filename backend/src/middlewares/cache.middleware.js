/**
 * In-process TTL response cache.
 *
 * Usage:
 *   const { makeCacheMiddleware } = require('../../middlewares/cache.middleware')
 *   router.use(makeCacheMiddleware({ ttl: 60_000 }))
 *
 * - Key   = req.originalUrl (path + query string → per-filter caching)
 * - Cache is NOT applied to routes that match skipPattern
 * - Evicts all expired entries when store size exceeds maxSize
 */

const store = new Map() // key → { body, status, headers, exp }

function evictExpired() {
  const now = Date.now()
  for (const [k, v] of store) {
    if (v.exp < now) store.delete(k)
  }
}

/**
 * @param {object} opts
 * @param {number}  opts.ttl         TTL in ms (default 60 000)
 * @param {number}  opts.maxSize     Evict expired when size exceeds this (default 200)
 * @param {RegExp}  opts.skipPattern Skip cache for matching URLs (default /\/export/)
 */
function makeCacheMiddleware({ ttl = 60_000, maxSize = 200, skipPattern = /\/export/ } = {}) {
  return function cacheMiddleware(req, res, next) {
    // Only cache GET requests; skip export and non-GET
    if (req.method !== 'GET' || skipPattern.test(req.originalUrl)) {
      return next()
    }

    const key = req.originalUrl
    const hit = store.get(key)

    if (hit && hit.exp > Date.now()) {
      res.set('X-Cache', 'HIT')
      res.set('Content-Type', hit.contentType || 'application/json')
      return res.status(hit.status).send(hit.body)
    }

    // Capture the response
    const originalJson = res.json.bind(res)
    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (store.size >= maxSize) evictExpired()
        store.set(key, {
          body:        JSON.stringify(data),
          status:      res.statusCode,
          contentType: 'application/json; charset=utf-8',
          exp:         Date.now() + ttl,
        })
      }
      res.set('X-Cache', 'MISS')
      return originalJson(data)
    }

    next()
  }
}

/** Manually invalidate all entries whose key starts with a prefix. */
function invalidatePrefix(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/** Clear the entire cache (e.g. after write operations). */
function clearAll() {
  store.clear()
}

module.exports = { makeCacheMiddleware, invalidatePrefix, clearAll }
