const router = require('express').Router()
const db = require('../../config/db')
const { requireAuth } = require('../../middlewares/auth.middleware')

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req, res) => {
  const [todayResult, weekResult, pendingResult, flaggedResult] = await Promise.all([
    // Thống kê hôm nay theo từng trạng thái
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
    // Thống kê tuần này — cả tổng lẫn số đã duyệt
    db.query(
      `SELECT
         COUNT(*)                                              AS total,
         COUNT(*) FILTER (WHERE status = 'approved')          AS approved
       FROM records
       WHERE received_at >= date_trunc('week', NOW())
         AND status != 'deleted'`
    ),
    // Tổng records status='new' đang chờ rà soát (toàn bộ, không giới hạn hôm nay)
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM records WHERE status = 'new'`
    ),
    // Tổng records status='flagged' đang cần xử lý (toàn bộ)
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM records WHERE status = 'flagged'`
    ),
  ])

  const today = todayResult.rows[0]
  const week  = weekResult.rows[0]
  res.json({
    today: {
      total:    parseInt(today.total),
      new:      parseInt(today.new),
      reviewed: parseInt(today.reviewed),
      approved: parseInt(today.approved),
      flagged:  parseInt(today.flagged),
    },
    this_week: {
      total:    parseInt(week.total),
      approved: parseInt(week.approved),   // ← mới: records đã duyệt trong tuần
    },
    pending_review: pendingResult.rows[0].count,   // tổng đang chờ rà soát
    total_flagged:  flaggedResult.rows[0].count,   // tổng đang bị flag
  })
})

module.exports = router
