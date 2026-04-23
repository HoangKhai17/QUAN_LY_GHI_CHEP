import './SummaryCards.css'

const CARDS = [
  {
    key:    'today_total',
    label:  'Record mới hôm nay',
    accent: 'primary',
    hint:   'so với hôm qua',
    getValue: s => s?.today?.total,
    getDelta: s => s?.today?.new != null ? `+${s.today.new} mới` : null,
    deltaUp: true,
  },
  {
    key:    'pending',
    label:  'Đang chờ rà soát',
    accent: 'warning',
    hint:   'cần xử lý sớm',
    getValue: s => s?.pending_review,
    getDelta: () => null,
    deltaUp: false,
  },
  {
    key:    'approved',
    label:  'Đã duyệt',
    accent: 'lime',
    hint:   'trong tuần này',
    getValue: s => s?.this_week?.total,
    getDelta: s => s?.today?.approved != null ? `${s.today.approved} hôm nay` : null,
    deltaUp: true,
  },
  {
    key:    'flagged',
    label:  'Bị flag / lỗi',
    accent: 'danger',
    hint:   'cần kiểm tra lại',
    getValue: s => s?.today?.flagged ?? 0,
    getDelta: () => null,
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
          <span className="stat-value">{value ?? '—'}</span>
        )}
        {!loading && delta && (
          <span className={card.deltaUp ? 'stat-delta-up' : 'stat-delta-down'}>
            {card.deltaUp ? '▲' : '▼'} {delta}
          </span>
        )}
      </div>
      <div className="stat-hint">{card.hint}</div>
    </div>
  )
}
