import './SummaryCards.css'

const CARDS = [
  {
    key:    'today_total',
    label:  'Tiếp nhận hôm nay',
    accent: 'primary',
    hint:   'tổng record nhận trong ngày',
    getValue: s => s?.today?.total ?? 0,
    getDelta: s => {
      const pending = s?.today?.new
      return pending != null ? `${pending} chưa xử lý` : null
    },
    deltaUp: false,
  },
  {
    key:    'pending',
    label:  'Đang chờ xử lý',
    accent: 'warning',
    hint:   'record mới chưa được rà soát',
    getValue: s => s?.pending_review ?? 0,
    getDelta: () => null,
    deltaUp: false,
  },
  {
    key:    'approved',
    label:  'Duyệt tuần này',
    accent: 'lime',
    hint:   'record đã duyệt trong tuần',
    getValue: s => s?.this_week?.approved ?? 0,
    getDelta: s => {
      const todayApproved = s?.today?.approved
      return todayApproved != null ? `${todayApproved} hôm nay` : null
    },
    deltaUp: true,
  },
  {
    key:    'flagged',
    label:  'Cần kiểm tra',
    accent: 'danger',
    hint:   'record bị flag đang tồn đọng',
    getValue: s => s?.total_flagged ?? 0,
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
