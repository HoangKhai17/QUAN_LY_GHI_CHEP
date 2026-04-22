const router = require('express').Router()
const db = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req, res) => {
  const [todayResult, weekResult, pendingResult] = await Promise.all([
    // Thống kê hôm nay
    db.query(
      `SELECT
         COUNT(*)                                              AS total,
         COUNT(*) FILTER (WHERE status = 'new')               AS "new",
         COUNT(*) FILTER (WHERE status = 'reviewed')          AS reviewed,
         COUNT(*) FILTER (WHERE status = 'approved')          AS approved,
         COUNT(*) FILTER (WHERE status = 'flagged')           AS flagged
       FROM records
       WHERE received_at >= CURRENT_DATE
         AND received_at <  CURRENT_DATE + INTERVAL '1 day'
         AND status != 'deleted'`
    ),
    // Tổng tuần này (thứ Hai → hiện tại)
    db.query(
      `SELECT COUNT(*) AS total
       FROM records
       WHERE received_at >= date_trunc('week', NOW())
         AND status != 'deleted'`
    ),
    // Số records status='new' chờ xem
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM records WHERE status = 'new'`
    ),
  ])

  const today = todayResult.rows[0]
  res.json({
    today: {
      total:    parseInt(today.total),
      new:      parseInt(today.new),
      reviewed: parseInt(today.reviewed),
      approved: parseInt(today.approved),
      flagged:  parseInt(today.flagged),
    },
    this_week:      { total: parseInt(weekResult.rows[0].total) },
    pending_review: pendingResult.rows[0].count,
  })
})

module.exports = router
