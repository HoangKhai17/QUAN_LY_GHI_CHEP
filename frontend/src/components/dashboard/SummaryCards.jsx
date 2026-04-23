import './SummaryCards.css'

const CARDS = [
  {
    key:    'today_total',
    label:  'Record mới hôm nay',
    accent: 'primary',
    hint:   'tổng nhận trong ngày',
    // today.total = tất cả records nhận hôm nay (mọi trạng thái)
    getValue: s => s?.today?.total ?? 0,
    // Delta: bao nhiêu đang còn chờ xử lý trong số đó
    getDelta: s => {
      const pending = s?.today?.new
      return pending != null ? `${pending} chưa xử lý` : null
    },
    deltaUp: false,
  },
  {
    key:    'pending',
    label:  'Đang chờ rà soát',
    accent: 'warning',
    hint:   'tổng chưa được xử lý',
    // pending_review = tổng records status='new' (toàn bộ, không giới hạn hôm nay)
    getValue: s => s?.pending_review ?? 0,
    getDelta: () => null,
    deltaUp: false,
  },
  {
    key:    'approved',
    label:  'Đã duyệt',
    accent: 'lime',
    hint:   'đã duyệt trong tuần này',
    // this_week.approved = records được approve trong tuần (không phải tổng tuần)
    getValue: s => s?.this_week?.approved ?? 0,
    // Delta: bao nhiêu đã duyệt hôm nay
    getDelta: s => {
      const todayApproved = s?.today?.approved
      return todayApproved != null ? `${todayApproved} hôm nay` : null
    },
    deltaUp: true,
  },
  {
    key:    'flagged',
    label:  'Bị flag / lỗi',
    accent: 'danger',
    hint:   'tổng đang cần kiểm tra',
    // total_flagged = tổng records status='flagged' (toàn bộ, không giới hạn hôm nay)
    getValue: s => s?.total_flagged ?? 0,
    // Delta: bao nhiêu bị flag hôm nay
    getDelta: s => {
      const todayFlagged = s?.today?.flagged
      return todayFlagged > 0 ? `${todayFlagged} hôm nay` : null
    },
    deltaUp: false,
  },
]

export default function SummaryCards({ summary, loading }) {
  return (
    <div className="summaryCards">
      {CARDS.map(card => (
        <StatCard key={card.key} card={card} summary={summary} loading={loading} />
      ))}
    </div>
  )
}

function StatCard({ card, summary, loading }) {
  const value = card.getValue(summary)
  const delta = card.getDelta(summary)

  return (
    <div className="stat-card summaryCard">
      <div className={`stat-accent stat-accent--${card.accent}`} />
      <div className="stat-label">{card.label}</div>
      <div className="stat-value-row">
        {loading ? (
          <div className="skeleton" style={{ width: 72, height: 38, borderRadius: 6 }} />
        ) : (
          <span className="stat-value">{value}</span>
        )}
        {!loading && delta && (
          <span className={card.deltaUp ? 'stat-delta-up' : 'stat-delta-neutral'}>
            {delta}
          </span>
        )}
      </div>
      <div className="stat-hint">{card.hint}</div>
    </div>
  )
}
