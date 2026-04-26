import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SummaryCards from '../../components/dashboard/SummaryCards'
import useDashboardSummary from '../../hooks/useDashboardSummary'
import { getReportsSummary } from '../../services/dashboard.service'
import './Dashboard.css'

const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const RANGE_OPTIONS = [
  { key: 'today', label: 'Hôm nay', days: 1 },
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '28d', label: '28 ngày', days: 28 },
]

const STATUS_META = {
  new:      { label: 'Mới',          color: '#2563eb', className: 'dashStatusSeg--new' },
  reviewed: { label: 'Đang rà soát', color: '#d97706', className: 'dashStatusSeg--reviewed' },
  approved: { label: 'Đã duyệt',     color: '#1f8f4d', className: 'dashStatusSeg--approved' },
  flagged:  { label: 'Bị flag',      color: '#c53b32', className: 'dashStatusSeg--flagged' },
}

const PLATFORM_LABELS = {
  telegram: 'Telegram',
  zalo:     'Zalo',
  manual:   'Thủ công',
}

const PLATFORM_META = {
  telegram: { color: '#35c98b' },
  zalo:     { color: '#5b8def' },
  manual:   { color: '#f5c76b' },
  other:    { color: '#98a2b3' },
}

const PLATFORM_GRADIENTS = {
  telegram: ['#4deba8', '#18a864'],
  zalo:     ['#7ab5ff', '#2e6fd4'],
  manual:   ['#fdd07a', '#d97706'],
  other:    ['#b0bec9', '#64748b'],
}

const DOC_TYPE_COLORS = [
  '#1f7a43', '#2563eb', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
]

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDateRange(days) {
  const to = new Date()
  const from = new Date(+to - (days - 1) * 86400_000)
  return {
    date_from: formatLocalDate(from),
    date_to:   formatLocalDate(to),
  }
}

function fillTimeline(tlRows, days = 14) {
  const map = Object.fromEntries((tlRows ?? []).map(r => [r.date, Number(r.count) || 0]))
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = formatLocalDate(d)
    const dow = d.getDay()
    const label = days > 7
      ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : WEEK_LABELS[(dow + 6) % 7]
    result.push({ key, label, count: map[key] ?? 0 })
  }
  return result
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function pct(value, total) {
  if (!total) return 0
  return Math.round((Number(value || 0) / total) * 100)
}

function buildConicGradient(items) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  if (!total) return '#edf1f5'

  let cursor = 0
  const stops = items
    .filter(item => item.count > 0)
    .map(item => {
      const start = cursor
      cursor += (item.count / total) * 100
      return `${item.color} ${start}% ${cursor}%`
    })

  return `conic-gradient(${stops.join(', ')})`
}

function rowCount(rows, key, value) {
  const row = (rows ?? []).find(r => r[key] === value)
  return Number(row?.count) || 0
}

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform || 'Không rõ'
}

function EmptyQueue({ children }) {
  return <div className="dashQueueEmpty">{children}</div>
}

function DonutChart({ items, total, hovered, onHover }) {
  const r  = 70
  const sw = 32
  const C  = 2 * Math.PI * r
  const gap = 3

  let cum = 0
  const segs = items
    .filter(s => s.count > 0)
    .map(item => {
      const pct = item.count / total
      const len = Math.max(0, pct * C - gap)
      const off = -cum
      cum += pct * C
      return { ...item, pct, len, off }
    })

  const hovSeg = segs.find(s => s.key === hovered) ?? null

  return (
    <svg viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      <defs>
        {segs.map(seg => {
          const [c1, c2] = PLATFORM_GRADIENTS[seg.key] ?? PLATFORM_GRADIENTS.other
          return (
            <linearGradient key={`lg-${seg.key}`} id={`dg-${seg.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          )
        })}
      </defs>

      {/* Background track */}
      <circle cx="100" cy="100" r={r} fill="none" stroke="#edf1f5" strokeWidth={sw} />

      {/* Segments — rotate -90 to start at 12 o'clock */}
      {segs.map(seg => {
        const isHov = hovered === seg.key
        return (
          <circle
            key={seg.key}
            cx="100" cy="100" r={r}
            fill="none"
            stroke={`url(#dg-${seg.key})`}
            strokeWidth={isHov ? sw + 9 : sw}
            strokeDasharray={`${seg.len} ${C - seg.len}`}
            strokeDashoffset={seg.off}
            transform="rotate(-90, 100, 100)"
            style={{
              transition: 'stroke-width .18s ease, opacity .18s ease',
              cursor: 'pointer',
              opacity: hovered && !isHov ? 0.4 : 1,
            }}
            onMouseEnter={() => onHover(seg.key)}
            onMouseLeave={() => onHover(null)}
          />
        )
      })}

      {/* Center text — dominantBaseline="middle" centers each line on its y */}
      <text x="100" y={hovSeg ? 83 : 90} textAnchor="middle" dominantBaseline="middle"
        fill="#94a3b8" fontSize="9" fontWeight="700" letterSpacing="0.5">
        {hovSeg ? hovSeg.label.toUpperCase() : 'TOTAL'}
      </text>
      <text x="100" y={hovSeg ? 102 : 112} textAnchor="middle" dominantBaseline="middle"
        fill="#0f172a" fontSize="20" fontWeight="800">
        {(hovSeg ? hovSeg.count : total).toLocaleString('vi-VN')}
      </text>
      {hovSeg && (
        <text x="100" y="122" textAnchor="middle" dominantBaseline="middle"
          fontSize="12" fontWeight="800"
          fill={(PLATFORM_GRADIENTS[hovSeg.key] ?? PLATFORM_GRADIENTS.other)[1]}>
          {Math.round(hovSeg.pct * 100)}%
        </text>
      )}
    </svg>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { summary, loading: loadingSummary, error: summaryErr, refetch: refetchSummary } = useDashboardSummary(30_000)

  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement
      setIsFullscreen(active)
      document.body.classList.toggle('app-fullscreen', active)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.body.classList.remove('app-fullscreen')
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  const [overviewRange, setOverviewRange] = useState('28d')
  const [hoveredPlatform, setHoveredPlatform] = useState(null)
  const [hoveredBar,      setHoveredBar]      = useState(null)
  const [reportLoading, setReportLoading] = useState(true)
  const [chartDays,  setChartDays]  = useState([])
  const [byPlatform, setByPlatform] = useState([])
  const [byDocType,  setByDocType]  = useState([])
  const [byStatus,   setByStatus]   = useState([])
  const [byCategory, setByCategory] = useState([])

  useEffect(() => {
    const option = RANGE_OPTIONS.find(item => item.key === overviewRange) || RANGE_OPTIONS[1]
    getReportsSummary(buildDateRange(option.days)).then(data => {
      setChartDays(fillTimeline(data.timeline, option.days))
      setByPlatform(data.by_platform ?? [])
      setByDocType((data.by_document_type ?? []).slice(0, 5))
      setByStatus(data.by_status ?? [])
      setByCategory((data.by_category ?? []).slice(0, 5))
    }).catch(() => {
      setChartDays(fillTimeline([], option.days))
      setByPlatform([])
      setByDocType([])
      setByStatus([])
      setByCategory([])
    }).finally(() => {
      setReportLoading(false)
    })
  }, [overviewRange])

  const chartMax = Math.max(...chartDays.map(d => d.count), 1)
  const totalInRange = chartDays.reduce((s, d) => s + d.count, 0)
  const totalPlatform = byPlatform.reduce((s, r) => s + Number(r.count || 0), 0)
  const totalStatus = byStatus.reduce((s, r) => s + Number(r.count || 0), 0)
  const maxDocType = Math.max(...byDocType.map(r => Number(r.count) || 0), 1)
  const maxCategory = Math.max(...byCategory.map(r => Number(r.count) || 0), 1)
  const selectedRange = RANGE_OPTIONS.find(item => item.key === overviewRange) || RANGE_OPTIONS[1]
  const periodSummary = {
    total: totalStatus,
    new: rowCount(byStatus, 'status', 'new'),
    reviewed: rowCount(byStatus, 'status', 'reviewed'),
    approved: rowCount(byStatus, 'status', 'approved'),
    flagged: rowCount(byStatus, 'status', 'flagged'),
  }
  const platformDonutItems = ['telegram', 'zalo', 'manual'].map(platform => {
    const count = rowCount(byPlatform, 'platform', platform)
    return {
      key: platform,
      label: platformLabel(platform),
      count,
      color: PLATFORM_META[platform]?.color || PLATFORM_META.other.color,
    }
  })
  const knownPlatformTotal = platformDonutItems.reduce((sum, item) => sum + item.count, 0)
  if (totalPlatform > knownPlatformTotal) {
    platformDonutItems.push({
      key: 'other',
      label: 'Khác',
      count: totalPlatform - knownPlatformTotal,
      color: PLATFORM_META.other.color,
    })
  }

  return (
    <div className="dashPage">
      <div className="dashToolbar">
        <div>
          <div className="dashToolbar__title">Tổng quan vận hành</div>
          <div className="dashToolbar__sub">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            {summaryErr ? ' · Không tải được dữ liệu' : ''}
          </div>
        </div>
        <div className="dashToolbar__actions">
          {summaryErr && (
            <button className="bbo-btn bbo-btn-sm" onClick={refetchSummary}>Thử lại</button>
          )}
          <button
            className="dashToolbar__fsBtn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>
          <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={() => navigate('/app/records')}>
            Xem tất cả record →
          </button>
        </div>
      </div>

      <div className="dashOverviewHead">
        <div>
          <div className="dashSectionTitle">Tổng quan</div>
          <div className="dashCardSub">Thống kê theo kỳ đang chọn</div>
        </div>
        <div className="dashRangeTabs" role="tablist" aria-label="Chọn kỳ thống kê tổng quan">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={overviewRange === option.key}
              className={`dashRangeTab${overviewRange === option.key ? ' dashRangeTab--active' : ''}`}
              onClick={() => {
                if (option.key === overviewRange) return
                setReportLoading(true)
                setOverviewRange(option.key)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <SummaryCards
        summary={summary}
        periodSummary={periodSummary}
        periodLabel={selectedRange.label}
        loading={loadingSummary || reportLoading}
      />

      <div className="dashMainGrid">
        <div className="bbo-card dashChartCard">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Sức tải tiếp nhận</div>
              <div className="dashCardSub">{selectedRange.label} · {totalInRange.toLocaleString('vi-VN')} record</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashChart">
              <div className="dashChart__bars">
                {(chartDays.length > 0 ? chartDays : fillTimeline([], selectedRange.days)).map((d, i, arr) => {
                  const isToday = i === arr.length - 1
                  const isHov   = hoveredBar === d.key
                  const height  = Math.max(8, Math.round((d.count / chartMax) * 248))
                  return (
                    <div
                      key={d.key}
                      className="dashChart__col"
                      title={`${d.key}: ${d.count} record`}
                      onMouseEnter={() => setHoveredBar(d.key)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <div
                        className="dashChart__value"
                        style={isHov ? { opacity: 1, color: isToday ? 'var(--primary)' : 'var(--ink)', fontSize: '11px' } : {}}
                      >
                        {isHov || d.count > 0 ? d.count : ''}
                      </div>
                      <div
                        className={`dashChart__bar${isToday ? ' dashChart__bar--primary' : ''}`}
                        style={{
                          height: `${height}px`,
                          ...(isHov && isToday  ? { background: 'linear-gradient(180deg,#34d274 0%,#16a34a 100%)', boxShadow: '0 4px 14px rgba(22,163,74,.35)' } : {}),
                          ...(isHov && !isToday ? { background: 'linear-gradient(180deg,#b0c4d4 0%,#8fa4b8 100%)' } : {}),
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="dashChart__labels">
                {(chartDays.length > 0 ? chartDays : fillTimeline([], selectedRange.days)).map((d, i, arr) => (
                  <div key={d.key}>
                    {selectedRange.days <= 7 || i === 0 || i === arr.length - 1 || i % 5 === 0 ? d.label : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bbo-card dashPlatformCard">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Nguồn tiếp nhận</div>
              <div className="dashCardSub">Phân bổ theo kênh trong kỳ</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashDonutStandalone">
              <div className="dashDonutSvgWrap">
                <DonutChart
                  items={platformDonutItems}
                  total={totalPlatform}
                  hovered={hoveredPlatform}
                  onHover={setHoveredPlatform}
                />
              </div>
              <div className="dashDonutLegend">
                {platformDonutItems.filter(item => item.count > 0).map(item => {
                  const [c1, c2] = PLATFORM_GRADIENTS[item.key] ?? PLATFORM_GRADIENTS.other
                  return (
                    <div
                      key={item.key}
                      className={`dashDonutLegend__item${hoveredPlatform === item.key ? ' dashDonutLegend__item--active' : ''}`}
                      onMouseEnter={() => setHoveredPlatform(item.key)}
                      onMouseLeave={() => setHoveredPlatform(null)}
                    >
                      <span style={{ background: `linear-gradient(135deg,${c1},${c2})` }} />
                      <div>
                        <em>{item.label}</em>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <strong>{item.count.toLocaleString('vi-VN')}</strong>
                          {totalPlatform > 0 && (
                            <span className="dashDonutLegend__pct">{Math.round(item.count / totalPlatform * 100)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashInsightGrid">
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Pipeline trạng thái</div>
              <div className="dashCardSub">Tỷ lệ record trong {selectedRange.label.toLowerCase()}</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashStatusBar">
              {Object.entries(STATUS_META).map(([status, meta]) => {
                const count = rowCount(byStatus, 'status', status)
                const width = Math.max(count ? pct(count, totalStatus) : 0, count ? 6 : 0)
                return (
                  <div
                    key={status}
                    className={`dashStatusSeg ${meta.className}`}
                    style={{ width: `${width}%` }}
                    title={`${meta.label}: ${count} record`}
                  />
                )
              })}
            </div>
            <div className="dashStatusLegend">
              {Object.entries(STATUS_META).map(([status, meta]) => {
                const count = rowCount(byStatus, 'status', status)
                return (
                  <div key={status} className="dashStatusLegend__item">
                    <span style={{ background: meta.color }} />
                    <div>
                      <strong>{count.toLocaleString('vi-VN')}</strong>
                      <em>{meta.label} · {pct(count, totalStatus)}%</em>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Top loại tài liệu</div>
              <div className="dashCardSub">Nhóm phát sinh nhiều nhất trong kỳ</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashRankList">
              {byDocType.length > 0 ? byDocType.map((dt, i) => {
                const count = Number(dt.count) || 0
                return (
                  <div key={dt.code || i} className="dashRankItem">
                    <div className="dashRankItem__head">
                      <span>
                        <i style={{ background: DOC_TYPE_COLORS[i % DOC_TYPE_COLORS.length] }} />
                        {dt.name || dt.code || 'Chưa phân loại'}
                      </span>
                      <strong>{count.toLocaleString('vi-VN')}</strong>
                    </div>
                    <div className="dashRankItem__track">
                      <div style={{ width: `${Math.max(4, pct(count, maxDocType))}%`, background: DOC_TYPE_COLORS[i % DOC_TYPE_COLORS.length] }} />
                    </div>
                  </div>
                )
              }) : <EmptyQueue>Chưa có dữ liệu loại tài liệu</EmptyQueue>}
            </div>
          </div>
        </div>

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Top danh mục</div>
              <div className="dashCardSub">Phân bổ theo nhóm chi phí / nghiệp vụ</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashRankList">
              {byCategory.length > 0 ? byCategory.map((cat, i) => {
                const count = Number(cat.count) || 0
                const color = cat.color || DOC_TYPE_COLORS[i % DOC_TYPE_COLORS.length]
                return (
                  <div key={cat.category_name || i} className="dashRankItem">
                    <div className="dashRankItem__head">
                      <span>
                        <i style={{ background: color }} />
                        {cat.category_name || 'Chưa gán danh mục'}
                      </span>
                      <strong>{count.toLocaleString('vi-VN')}</strong>
                    </div>
                    <div className="dashRankItem__track">
                      <div style={{ width: `${Math.max(4, pct(count, maxCategory))}%`, background: color }} />
                    </div>
                  </div>
                )
              }) : <EmptyQueue>Chưa có dữ liệu danh mục</EmptyQueue>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 28 }} />
    </div>
  )
}
