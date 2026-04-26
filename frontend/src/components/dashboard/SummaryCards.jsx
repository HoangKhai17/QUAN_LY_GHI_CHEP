import './SummaryCards.css'

const CARDS = [
  {
    key:    'range_total',
    label:  'Tổng record',
    accent: 'primary',
    getHint: periodLabel => `record tiếp nhận trong ${periodLabel.toLowerCase()}`,
    getValue: (s, p) => p?.total ?? s?.today?.total ?? 0,
    getDelta: () => null,
    deltaUp: true,
  },
  {
    key:    'pending',
    label:  'Chờ rà soát',
    accent: 'warning',
    getHint: periodLabel => `record chưa hoàn tất trong ${periodLabel.toLowerCase()}`,
    getValue: (s, p) => (p?.new ?? 0) + (p?.reviewed ?? 0),
    getDelta: (s, p) => {
      const n = p?.new ?? 0
      const r = p?.reviewed ?? 0
      if (!n && !r) return null
      return `${n} chưa xem · ${r} đang rà soát`
    },
    deltaUp: false,
  },
  {
    key:    'approved',
    label:  'Đã duyệt',
    accent: 'lime',
    getHint: periodLabel => `record hoàn tất trong ${periodLabel.toLowerCase()}`,
    getValue: (s, p) => p?.approved ?? s?.this_week?.approved ?? 0,
    getDelta: (s, p) => {
      const total = p?.total ?? 0
      const approved = p?.approved ?? 0
      return total ? `${Math.round((approved / total) * 100)}% tổng kỳ` : null
    },
    deltaUp: true,
  },
  {
    key:    'flagged',
    label:  'Cần kiểm tra',
    accent: 'danger',
    getHint: periodLabel => `record bị flag trong ${periodLabel.toLowerCase()}`,
    getValue: (s, p) => p?.flagged ?? s?.total_flagged ?? 0,
    getDelta: (s, p) => {
      const flagged = p?.flagged ?? 0
      return flagged > 0 ? 'cần xử lý' : null
    },
    deltaUp: false,
  },
]

export default function SummaryCards({ summary, periodSummary, periodLabel = 'kỳ này', loading }) {
  return (
    <div className="summaryCards">
      {CARDS.map(card => (
        <StatCard
          key={card.key}
          card={card}
          summary={summary}
          periodSummary={periodSummary}
          periodLabel={periodLabel}
          loading={loading}
        />
      ))}
    </div>
  )
}

function StatCard({ card, summary, periodSummary, periodLabel, loading }) {
  const value = card.getValue(summary, periodSummary)
  const delta = card.getDelta(summary, periodSummary)
  const hint = card.getHint(periodLabel)

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
      <div className="stat-hint">{hint}</div>
    </div>
  )
}
