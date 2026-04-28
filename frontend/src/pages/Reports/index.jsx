import { useState, useEffect, useCallback, useRef } from 'react'
import { getReportsSummary, getReportsFinancial, getReportsStaff, getReportsHeatmap, getReportsQuality, getReportsSla, getReportsBacklog, getReportsDocTrend, getReportsAudit, archiveAuditLogs, exportReport } from '../../services/reports.service'
import useAuthStore from '../../store/auth.store'
import './Reports.css'

// ── Date helpers ───────────────────────────────────────────────────────────────

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildPeriod(key, customFrom, customTo) {
  const today = new Date()
  if (key === 'month') {
    return { date_from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), date_to: fmt(today) }
  }
  if (key === 'quarter') {
    const qStart = Math.floor(today.getMonth() / 3) * 3
    return { date_from: fmt(new Date(today.getFullYear(), qStart, 1)), date_to: fmt(today) }
  }
  if (key === 'custom') {
    return { date_from: customFrom || fmt(new Date(+today - 6 * 86400_000)), date_to: customTo || fmt(today) }
  }
  // 7d
  return { date_from: fmt(new Date(+today - 6 * 86400_000)), date_to: fmt(today) }
}

/**
 * Tính kỳ trước đúng theo từng preset:
 * - month   → tháng trước (đầy đủ, e.g. March 1–31)
 * - quarter → quý trước (đầy đủ, e.g. Jan 1–Mar 31)
 * - 7d/custom → cùng số ngày, shift ngược
 */
function buildPrevPeriod(key, date_from, date_to) {
  if (key === 'month') {
    const currStart = new Date(date_from)
    // Ngày cuối tháng trước
    const prevEnd   = new Date(currStart.getFullYear(), currStart.getMonth(), 0)
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1)
    return { date_from: fmt(prevStart), date_to: fmt(prevEnd) }
  }
  if (key === 'quarter') {
    const currStart    = new Date(date_from)
    const currQMonth   = Math.floor(currStart.getMonth() / 3) * 3
    // Ngày cuối quý trước = ngày liền trước ngày đầu quý này
    const prevQEnd     = new Date(currStart.getFullYear(), currQMonth, 0)
    // Ngày đầu quý trước = ngày 1 của quý chứa prevQEnd
    const prevQMonth   = Math.floor(prevQEnd.getMonth() / 3) * 3
    const prevQStart   = new Date(prevQEnd.getFullYear(), prevQMonth, 1)
    return { date_from: fmt(prevQStart), date_to: fmt(prevQEnd) }
  }
  // 7d + custom: cùng số ngày shift ngược
  const from   = new Date(date_from)
  const to     = new Date(date_to)
  const days   = Math.round((to - from) / 86400_000) + 1
  const prevTo = new Date(from.getTime() - 86400_000)
  const prevFr = new Date(prevTo.getTime() - (days - 1) * 86400_000)
  return { date_from: fmt(prevFr), date_to: fmt(prevTo) }
}

function fillTimeline(rows, date_from, date_to) {
  const map = Object.fromEntries((rows ?? []).map(r => [r.date, Number(r.count) || 0]))
  const result = []
  const cur = new Date(date_from)
  const end = new Date(date_to)
  while (cur <= end) {
    const key = fmt(cur)
    result.push({ date: key, count: map[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function sumByStatus(byStatus, ...statuses) {
  return (byStatus ?? [])
    .filter(s => statuses.includes(s.status))
    .reduce((acc, s) => acc + Number(s.count), 0)
}

function calcDelta(curr, prev) {
  if (prev === null || prev === undefined) return null
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round((curr - prev) / prev * 100)
}

function fmtNum(val) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n % 1 === 0
    ? n.toLocaleString('vi-VN')
    : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

function fmtDate(iso) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} giờ trước`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Design constants ───────────────────────────────────────────────────────────

const PLATFORM_META = {
  telegram: { label: 'Telegram', color: '#18a864' },
  zalo:     { label: 'Zalo',     color: '#2e6fd4' },
  manual:   { label: 'Thủ công', color: '#d97706' },
  other:    { label: 'Khác',     color: '#64748b' },
}

const STATUS_META = {
  new:      { label: 'Mới',          color: '#2563eb' },
  reviewed: { label: 'Đang rà soát', color: '#d97706' },
  approved: { label: 'Đã duyệt',     color: '#1f7a43' },
  flagged:  { label: 'Flagged',      color: '#dc2626' },
}

const PERIOD_PRESETS = [
  { key: '7d',      label: '7 ngày' },
  { key: 'month',   label: 'Tháng này' },
  { key: 'quarter', label: 'Quý này' },
  { key: 'custom',  label: 'Tùy chọn' },
]

// roles: null = tất cả user đăng nhập, ['admin','manager'] = chỉ admin/manager
const TABS = [
  { key: 'overview',  label: 'Tổng quan',       soon: false, roles: null },
  { key: 'financial', label: 'Tài chính',        soon: false, roles: ['admin','manager'] },
  { key: 'staff',     label: 'Nhân viên',        soon: false, roles: null },
  { key: 'heatmap',   label: 'Hoạt động',        soon: false, roles: null },
  { key: 'quality',   label: 'Chất lượng',       soon: false, roles: null },
  { key: 'sla',       label: 'Tốc độ xử lý',    soon: false, roles: null },
  { key: 'backlog',   label: 'Tồn đọng',         soon: false, roles: null },
  { key: 'doc-trend', label: 'Xu hướng loại',    soon: false, roles: null },
  { key: 'audit',     label: 'Audit / Tuân thủ', soon: false, roles: ['admin','manager'] },
  { key: 'export',    label: 'Xuất báo cáo',     soon: false, roles: ['admin','manager'] },
]

// ── Responsive SVG Line Chart ──────────────────────────────────────────────────

const VH     = 200
const PAD    = { top: 14, bottom: 32, left: 38, right: 16 }
const RADIUS = 5

function LineChart({ current, previous, animKey }) {
  const wrapRef    = useRef(null)
  const [cw, setCw] = useState(900)
  const [hover, setHover] = useState(null) // { idx, x, y, prevY }

  // Measure container width
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([e]) => setCw(Math.max(300, e.contentRect.width)))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  if (!current?.length) {
    return (
      <div ref={wrapRef} style={{ width: '100%', height: VH }}>
        <div className="rpt-chart-empty">Không có dữ liệu</div>
      </div>
    )
  }

  const allCounts = [
    ...current.map(d => d.count),
    ...(previous ?? []).map(d => d.count),
    1,
  ]
  const maxY  = Math.max(...allCounts)
  const iW    = cw - PAD.left - PAD.right
  const iH    = VH - PAD.top - PAD.bottom
  const n     = current.length

  const xOf = i => PAD.left + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW)
  const yOf = v => PAD.top + iH - (v / maxY) * iH

  const toPoints  = pts => pts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.count).toFixed(1)}`).join(' ')
  const toArea    = pts => {
    const base = PAD.top + iH
    const line = pts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.count).toFixed(1)}`).join(' ')
    return `${xOf(0).toFixed(1)},${base} ${line} ${xOf(n - 1).toFixed(1)},${base}`
  }

  const gridVals = [0, Math.round(maxY * 0.33), Math.round(maxY * 0.67), maxY]

  const step = Math.max(1, Math.ceil(n / 8))
  const showLabel = i => i % step === 0 || i === n - 1

  // ── Mouse interaction ──
  function onMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * cw
    let best = 0
    let bestD = Infinity
    current.forEach((_, i) => {
      const d = Math.abs(xOf(i) - mouseX)
      if (d < bestD) { bestD = d; best = i }
    })
    if (bestD > iW / n + 10) { setHover(null); return }
    setHover({
      idx:  best,
      x:    xOf(best),
      y:    yOf(current[best].count),
      prevY: previous?.[best] != null ? yOf(previous[best].count) : null,
    })
  }

  // Tooltip position: flip to left if near right edge
  const tooltipX = hover ? (hover.x + 120 > cw ? hover.x - 124 : hover.x + 10) : 0
  const tooltipY = hover ? Math.max(PAD.top, hover.y - 24) : 0

  return (
    <div ref={wrapRef} style={{ width: '100%', height: VH, position: 'relative' }}>
      <svg
        key={animKey}
        viewBox={`0 0 ${cw} ${VH}`}
        width={cw} height={VH}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="rptGradCurr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7a43" stopOpacity=".22" />
            <stop offset="100%" stopColor="#1f7a43" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rptGradPrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity=".12" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          </linearGradient>
          <clipPath id="rptChartClip">
            <rect x={PAD.left} y={PAD.top} width={iW} height={iH} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yOf(v)} x2={cw - PAD.right} y2={yOf(v)}
              stroke="#e8ecf0" strokeWidth="1" />
            <text x={PAD.left - 5} y={yOf(v)} textAnchor="end" dominantBaseline="middle"
              fontSize="9.5" fill="#b0bec9">{v}</text>
          </g>
        ))}

        {/* Previous period */}
        {previous?.length > 0 && (
          <g clipPath="url(#rptChartClip)">
            <polygon points={toArea(previous)} fill="url(#rptGradPrev)" />
            <polyline points={toPoints(previous)} fill="none"
              stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 3"
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {/* Current period: area + animated line */}
        <g clipPath="url(#rptChartClip)">
          <polygon points={toArea(current)} fill="url(#rptGradCurr)" />
          <polyline
            points={toPoints(current)}
            fill="none"
            stroke="#1f7a43"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            className="rpt-line-draw"
          />
        </g>

        {/* X labels */}
        {current.map((p, i) => showLabel(i) && (
          <text key={i} x={xOf(i)} y={VH - 6} textAnchor="middle" fontSize="9.5" fill="#b0bec9">
            {fmtDate(p.date)}
          </text>
        ))}

        {/* Hover: crosshair */}
        {hover && (
          <>
            <line
              x1={hover.x} y1={PAD.top}
              x2={hover.x} y2={PAD.top + iH}
              stroke="#1f7a43" strokeWidth="1" strokeDasharray="3 2" opacity=".5"
            />
            {/* Prev dot */}
            {hover.prevY != null && (
              <circle cx={hover.x} cy={hover.prevY} r={4}
                fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
            )}
            {/* Current dot (enlarged) */}
            <circle cx={hover.x} cy={hover.y} r={RADIUS + 2}
              fill="#fff" stroke="#1f7a43" strokeWidth="2.5" />

            {/* Tooltip */}
            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect x="0" y="0" width="110" height={hover.prevY != null ? 54 : 38}
                rx="7" fill="#1a2533" opacity=".9" />
              <text x="10" y="15" fontSize="10" fill="#94a3b8" fontWeight="600">
                {fmtDate(current[hover.idx].date)}
              </text>
              <text x="10" y="31" fontSize="13" fill="#fff" fontWeight="800">
                {current[hover.idx].count.toLocaleString('vi-VN')} records
              </text>
              {hover.prevY != null && previous?.[hover.idx] != null && (
                <text x="10" y="47" fontSize="10" fill="#94a3b8">
                  Kỳ trước: {previous[hover.idx].count.toLocaleString('vi-VN')}
                </text>
              )}
            </g>
          </>
        )}

        {/* Normal dots (few data points only) */}
        {!hover && n <= 21 && current.map((p, i) => (
          <circle key={i} cx={xOf(i)} cy={yOf(p.count)} r={n <= 14 ? 3.5 : 2.5}
            fill="#fff" stroke="#1f7a43" strokeWidth="2" />
        ))}
      </svg>
    </div>
  )
}

// ── KPI Card (redesigned) ──────────────────────────────────────────────────────

function KpiCard({ label, value, prev, accent, loading, invertDelta }) {
  const rawPct = calcDelta(value, prev)
  const pct    = invertDelta && rawPct !== null ? -rawPct : rawPct

  let chipClass = 'rpt-kpi-chip--flat'
  let chipText  = '— 0%'
  if (pct !== null && pct > 0) { chipClass = 'rpt-kpi-chip--up';   chipText = `▲ ${pct}%` }
  if (pct !== null && pct < 0) { chipClass = 'rpt-kpi-chip--down'; chipText = `▼ ${Math.abs(pct)}%` }

  const showCompare = !loading && prev !== null && prev !== undefined

  return (
    <div className="rpt-kpi-card">
      <div className="rpt-kpi-accent" style={{ background: accent }} />
      <div className="rpt-kpi-body">
        <div className="rpt-kpi-top">
          <span className="rpt-kpi-label">{label}</span>
          {showCompare && pct !== null && (
            <span className={`rpt-kpi-chip ${chipClass}`}>{chipText}</span>
          )}
        </div>
        <div className="rpt-kpi-value">
          {loading ? <span className="rpt-kpi-skeleton" /> : (value ?? 0).toLocaleString('vi-VN')}
        </div>
        {showCompare && (
          <div className="rpt-kpi-compare">
            <span className="rpt-kpi-compare-label">Kỳ trước</span>
            <span className="rpt-kpi-compare-sep">→</span>
            <span className="rpt-kpi-compare-val">{(prev ?? 0).toLocaleString('vi-VN')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Breakdown Bars ─────────────────────────────────────────────────────────────

function BreakdownBars({ items }) {
  if (!items?.length) return <p className="rpt-empty-mini">Không có dữ liệu</p>
  const max   = Math.max(...items.map(i => i.count), 1)
  const total = items.reduce((s, i) => s + i.count, 0)
  return (
    <div className="rpt-breakdown-list">
      {items.map(item => (
        <div key={item.key} className="rpt-breakdown-row">
          <div className="rpt-breakdown-label">{item.label}</div>
          <div className="rpt-breakdown-track">
            <div className="rpt-breakdown-fill"
              style={{ width: `${(item.count / max) * 100}%`, background: item.color }} />
          </div>
          <div className="rpt-breakdown-count">{item.count.toLocaleString('vi-VN')}</div>
          <div className="rpt-breakdown-pct">
            {total ? `${Math.round(item.count / total * 100)}%` : '0%'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab 1: Tổng quan ──────────────────────────────────────────────────────────

function OverviewTab() {
  const [period,     setPeriod]     = useState('month')
  const [compare,   setCompare]    = useState(true)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [curr,       setCurr]       = useState(null)
  const [prev,       setPrev]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [animKey,    setAnimKey]    = useState(0)

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      const [currData, prevData] = await Promise.all([
        getReportsSummary({ date_from, date_to }),
        compare
          ? getReportsSummary(buildPrevPeriod(period, date_from, date_to))
          : Promise.resolve(null),
      ])
      setCurr(currData)
      setPrev(prevData)
      setAnimKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }, [period, compare, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
  const prevDates = compare ? buildPrevPeriod(period, date_from, date_to) : null

  const currTl = curr ? fillTimeline(curr.timeline, date_from, date_to) : []
  const prevTl = prev && prevDates
    ? fillTimeline(prev.timeline, prevDates.date_from, prevDates.date_to)
    : []

  const cTotal    = sumByStatus(curr?.by_status, 'new', 'reviewed', 'approved', 'flagged')
  const cApproved = sumByStatus(curr?.by_status, 'approved')
  const cPending  = sumByStatus(curr?.by_status, 'new', 'reviewed')
  const cFlagged  = sumByStatus(curr?.by_status, 'flagged')

  const pTotal    = prev ? sumByStatus(prev.by_status, 'new', 'reviewed', 'approved', 'flagged') : null
  const pApproved = prev ? sumByStatus(prev.by_status, 'approved') : null
  const pPending  = prev ? sumByStatus(prev.by_status, 'new', 'reviewed') : null
  const pFlagged  = prev ? sumByStatus(prev.by_status, 'flagged') : null

  // Label kỳ trước để hiển thị trong legend
  function prevPeriodLabel() {
    if (!prevDates) return 'Kỳ trước'
    if (period === 'month') {
      const d = new Date(prevDates.date_from)
      return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
    }
    if (period === 'quarter') {
      const d = new Date(prevDates.date_from)
      return `Q${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}`
    }
    return `${fmtDate(prevDates.date_from)} – ${fmtDate(prevDates.date_to)}`
  }

  return (
    <div className="rpt-tab-body">

      {/* ── Filter bar ── */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input"
                value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input"
                value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <label className="rpt-toggle-label">
          <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
          So sánh kỳ trước
        </label>
      </div>

      {/* ── KPI Cards ── */}
      <div className="rpt-kpi-grid">
        <KpiCard label="Tổng records" value={cTotal}    prev={pTotal}    accent="var(--primary)" loading={loading} />
        <KpiCard label="Đã duyệt"     value={cApproved} prev={pApproved} accent="#16a34a"        loading={loading} />
        <KpiCard label="Chờ xử lý"   value={cPending}  prev={pPending}  accent="#d97706"        loading={loading} invertDelta />
        <KpiCard label="Flagged"       value={cFlagged}  prev={pFlagged}  accent="#dc2626"        loading={loading} invertDelta />
      </div>

      {/* ── Timeline chart ── */}
      <div className="bbo-card rpt-chart-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Xu hướng theo ngày</div>
          {compare && prev && (
            <div className="rpt-chart-legend">
              <span className="rpt-legend-curr" /> Kỳ này
              <span className="rpt-legend-prev" /> {prevPeriodLabel()}
            </div>
          )}
        </div>
        <div className="bbo-card-body rpt-chart-body">
          {loading
            ? <div className="rpt-skeleton rpt-skeleton--chart" />
            : <LineChart current={currTl} previous={compare ? prevTl : null} animKey={animKey} />
          }
        </div>
      </div>

      {/* ── Breakdown grid ── */}
      <div className="rpt-breakdown-grid">
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo nền tảng</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : <BreakdownBars items={(curr?.by_platform ?? []).map(p => ({
                  key:   p.platform,
                  label: PLATFORM_META[p.platform]?.label ?? p.platform,
                  count: Number(p.count),
                  color: PLATFORM_META[p.platform]?.color ?? '#94a3b8',
                }))} />
            }
          </div>
        </div>
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo trạng thái</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : <BreakdownBars items={(curr?.by_status ?? [])
                  .filter(s => s.status !== 'deleted')
                  .map(s => ({
                    key:   s.status,
                    label: STATUS_META[s.status]?.label ?? s.status,
                    count: Number(s.count),
                    color: STATUS_META[s.status]?.color ?? '#94a3b8',
                  }))} />
            }
          </div>
        </div>
      </div>

      {/* ── Doc-type breakdown ── */}
      {!loading && curr?.by_document_type?.some(d => d.count > 0) && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo loại tài liệu</div>
          </div>
          <div className="bbo-card-body">
            <BreakdownBars items={curr.by_document_type.filter(d => d.count > 0).map((d, i) => ({
              key:   d.code ?? `dt-${i}`,
              label: d.name ?? d.code ?? '(chưa phân loại)',
              count: Number(d.count),
              color: ['#1f7a43','#2563eb','#d97706','#7c3aed','#db2777','#0891b2'][i % 6],
            }))} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Tài chính ──────────────────────────────────────────────────────────

function FinancialTab() {
  const [dateFrom,          setDateFrom]          = useState('')
  const [dateTo,            setDateTo]            = useState('')
  const [includeUnapproved, setIncludeUnapproved] = useState(false)
  const [data,              setData]              = useState(null)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      if (includeUnapproved) params.include_unapproved = 'true'
      const res = await getReportsFinancial(params)
      setData(res)
    } catch (e) {
      setError(e?.response?.status === 403
        ? 'Bạn không có quyền xem dữ liệu tài chính. Chỉ Admin và Manager mới có thể truy cập.'
        : 'Không thể tải dữ liệu. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, includeUnapproved])

  useEffect(() => { load() }, [load])

  const groups = Object.values(
    (data?.aggregations ?? []).reduce((acc, agg) => {
      const key = agg.document_type_code
      if (!acc[key]) acc[key] = { code: key, name: agg.document_type_name, fields: [] }
      acc[key].fields.push(agg)
      return acc
    }, {})
  )

  return (
    <div className="rpt-tab-body">
      <div className="rpt-filter-bar">
        <div className="rpt-filter-group">
          <label className="rpt-filter-label">Từ ngày</label>
          <input type="date" className="rpt-date-input"
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="rpt-filter-group">
          <label className="rpt-filter-label">Đến ngày</label>
          <input type="date" className="rpt-date-input"
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <label className="rpt-toggle-label">
          <input type="checkbox" checked={includeUnapproved}
            onChange={e => setIncludeUnapproved(e.target.checked)} />
          Bao gồm chưa duyệt
        </label>
        <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={load}>Áp dụng</button>
      </div>

      {error && <div className="rpt-error-banner">⚠️ {error}</div>}

      {!error && !loading && (
        <div className="rpt-fin-summary">
          <div className="rpt-fin-summary-item">
            <span className="rpt-fin-summary-label">Tổng records</span>
            <span className="rpt-fin-summary-val">{(data?.total_records ?? 0).toLocaleString('vi-VN')}</span>
          </div>
          <div className="rpt-fin-summary-item">
            <span className="rpt-fin-summary-label">Loại tài liệu</span>
            <span className="rpt-fin-summary-val">{groups.length}</span>
          </div>
          <div className="rpt-fin-summary-item">
            <span className="rpt-fin-summary-label">Trạng thái</span>
            <span className="rpt-fin-summary-val rpt-fin-summary-val--sub">
              {includeUnapproved ? 'Tất cả' : 'Đã duyệt'}
            </span>
          </div>
        </div>
      )}

      {error ? null : loading ? (
        <div className="rpt-skeleton rpt-skeleton--table" />
      ) : groups.length === 0 ? (
        <div className="rpt-empty-state">
          <div className="rpt-empty-icon">📊</div>
          <div className="rpt-empty-title">Không có dữ liệu tài chính</div>
          <div className="rpt-empty-sub">
            Chưa có loại tài liệu nào có trường số liệu được đánh dấu là
            &ldquo;có thể báo cáo&rdquo;.<br />
            Vào <strong>Cài đặt → Loại tài liệu</strong> để cấu hình trường dữ liệu.
          </div>
        </div>
      ) : (
        <div className="rpt-fin-tables">
          {groups.map(grp => (
            <div key={grp.code} className="bbo-card">
              <div className="bbo-card-header">
                <div className="bbo-card-title">{grp.name}</div>
                <div className="bbo-card-action">
                  {grp.fields.reduce((s, f) => s + f.record_count, 0).toLocaleString('vi-VN')} records
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rpt-fin-table">
                  <thead>
                    <tr>
                      <th>Trường dữ liệu</th>
                      <th>Số records</th>
                      <th>Tổng</th>
                      <th>Trung bình</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grp.fields.map(f => (
                      <tr key={f.field_key}>
                        <td className="rpt-fin-field">{f.field_label}</td>
                        <td>{f.record_count.toLocaleString('vi-VN')}</td>
                        <td className="rpt-fin-total">{fmtNum(f.total)}</td>
                        <td>{fmtNum(f.average)}</td>
                        <td>{fmtNum(f.min)}</td>
                        <td>{fmtNum(f.max)}</td>
                        <td className="rpt-fin-unit">{f.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Nhân viên ──────────────────────────────────────────────────────────

const RATE_STYLE = (rate) => {
  if (rate >= 80) return { bg: '#eaf7ef', color: '#18864b' }
  if (rate >= 60) return { bg: '#fff7e7', color: '#b7791f' }
  return { bg: '#fff1ef', color: '#c53b32' }
}

const AVATAR_COLORS = [
  ['#1f7a43', '#22c55e'], ['#2563eb', '#60a5fa'], ['#7c3aed', '#a78bfa'],
  ['#d97706', '#fbbf24'], ['#db2777', '#f472b6'], ['#0891b2', '#22d3ee'],
]

function SortIcon({ active, dir }) {
  if (!active) return <span className="rpt-sort-icon rpt-sort-icon--off">↕</span>
  return <span className="rpt-sort-icon">{dir === 'desc' ? '↓' : '↑'}</span>
}

function StaffTab() {
  const [period,     setPeriod]     = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [platform,   setPlatform]   = useState('')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [sortCol,    setSortCol]    = useState('total_sent')
  const [sortDir,    setSortDir]    = useState('desc')

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      const params = { date_from, date_to }
      if (platform) params.platform = platform
      const res = await getReportsStaff(params)
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo, platform])

  useEffect(() => { load() }, [load])

  const staff = data?.staff ?? []

  const sorted = [...staff].sort((a, b) => {
    const va = Number(a[sortCol] ?? 0)
    const vb = Number(b[sortCol] ?? 0)
    return sortDir === 'desc' ? vb - va : va - vb
  })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const maxSent  = Math.max(...staff.map(s => s.total_sent), 1)
  const avgRate  = staff.length
    ? Math.round(staff.reduce((s, u) => s + Number(u.approval_rate ?? 0), 0) / staff.length)
    : 0
  const avgStyle = RATE_STYLE(avgRate)

  return (
    <div className="rpt-tab-body">

      {/* ── Filter bar ── */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Date range badge */}
        {(() => {
          const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
          if (!date_from || !date_to) return null
          const fmtFull = iso => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return (
            <span className="rpt-staff-daterange">
              {fmtFull(date_from)} – {fmtFull(date_to)}
            </span>
          )
        })()}

        {/* Platform filter — pushed to right */}
        <select className="rpt-select rpt-staff-plat-select" value={platform}
          onChange={e => setPlatform(e.target.value)}>
          <option value="">Tất cả nền tảng</option>
          <option value="telegram">Telegram</option>
          <option value="zalo">Zalo</option>
          <option value="manual">Thủ công</option>
        </select>
      </div>

      {/* ── Summary strip ── */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Nhân viên hoạt động</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : staff.length}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng records</div>
          <div className="rpt-staff-strip-val">
            {loading ? '—' : (data?.total_records ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tỷ lệ duyệt trung bình</div>
          <div className="rpt-staff-strip-val" style={{ color: avgStyle.color }}>
            {loading ? '—' : `${avgRate}%`}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="rpt-skeleton rpt-skeleton--table" />
      ) : staff.length === 0 ? (
        <div className="rpt-empty-state">
          <div className="rpt-empty-icon">👥</div>
          <div className="rpt-empty-title">Không có dữ liệu nhân viên</div>
          <div className="rpt-empty-sub">Không có records nào trong kỳ được chọn.</div>
        </div>
      ) : (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Xếp hạng nhân viên</div>
            <div className="bbo-card-action">{staff.length} người hoạt động trong kỳ</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-staff-table">
              <thead>
                <tr>
                  <th className="rpt-staff-th--center">#</th>
                  <th>Nhân viên</th>
                  <th className="rpt-staff-th--right rpt-staff-th--sort"
                    onClick={() => toggleSort('total_sent')}>
                    Gửi <SortIcon active={sortCol === 'total_sent'} dir={sortDir} />
                  </th>
                  <th className="rpt-staff-th--right rpt-staff-th--sort"
                    onClick={() => toggleSort('approved')}>
                    Duyệt <SortIcon active={sortCol === 'approved'} dir={sortDir} />
                  </th>
                  <th className="rpt-staff-th--right rpt-staff-th--sort"
                    onClick={() => toggleSort('pending')}>
                    Chờ <SortIcon active={sortCol === 'pending'} dir={sortDir} />
                  </th>
                  <th className="rpt-staff-th--right rpt-staff-th--sort"
                    onClick={() => toggleSort('flagged')}>
                    Flag <SortIcon active={sortCol === 'flagged'} dir={sortDir} />
                  </th>
                  <th className="rpt-staff-th--right rpt-staff-th--sort"
                    onClick={() => toggleSort('approval_rate')}>
                    Tỷ lệ duyệt <SortIcon active={sortCol === 'approval_rate'} dir={sortDir} />
                  </th>
                  <th>Hoạt động gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u, i) => {
                  const rate     = Number(u.approval_rate ?? 0)
                  const rs       = RATE_STYLE(rate)
                  const colors   = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const initials = (u.sender_name ?? '?').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
                  const platMeta = PLATFORM_META[u.user_platform] ?? PLATFORM_META.other
                  const rankEl   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`

                  return (
                    <tr key={u.sender_name} className="rpt-staff-row">
                      <td className="rpt-staff-rank">{rankEl}</td>

                      <td className="rpt-staff-name-cell">
                        <div className="rpt-staff-avatar"
                          style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}>
                          {initials}
                        </div>
                        <div>
                          <div className="rpt-staff-name">{u.sender_name}</div>
                          <span className="rpt-staff-plat"
                            style={{ background: platMeta.color + '1a', color: platMeta.color }}>
                            {platMeta.label}
                          </span>
                        </div>
                      </td>

                      {/* Gửi + mini bar */}
                      <td className="rpt-staff-sent-td">
                        <div className="rpt-staff-sent-row">
                          <span className="rpt-staff-sent-num">{u.total_sent}</span>
                          <div className="rpt-staff-bar-track">
                            <div className="rpt-staff-bar-fill"
                              style={{ width: `${(u.total_sent / maxSent) * 100}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="rpt-staff-num rpt-staff-num--ok">{u.approved}</td>
                      <td className="rpt-staff-num rpt-staff-num--warn">{u.pending}</td>
                      <td className="rpt-staff-num rpt-staff-num--bad">{u.flagged || '—'}</td>

                      <td className="rpt-staff-rate-td">
                        <span className="rpt-staff-rate-chip"
                          style={{ background: rs.bg, color: rs.color }}>
                          {rate.toFixed(1)}%
                        </span>
                      </td>

                      <td className="rpt-staff-activity">{fmtRelative(u.last_activity)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Heat color scale ──────────────────────────────────────────────────────────

function heatColor(count, max) {
  if (!count || !max) return '#edf0f3'
  const r = count / max
  if (r <= 0.15) return '#c6efda'
  if (r <= 0.35) return '#84d4a8'
  if (r <= 0.65) return '#3cb872'
  return '#1f7a43'
}

// ── Calendar Heatmap (GitHub style) ───────────────────────────────────────────

const MONTH_VN = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12']
const DOW_VN   = ['T2','T3','T4','T5','T6','T7','CN']

function CalendarHeatmap({ data, dateFrom, dateTo }) {
  const [hov, setHov] = useState(null)
  if (!dateFrom || !dateTo || !data) return <div className="rpt-skeleton" style={{ height: 130 }} />

  const countMap = {}
  data.forEach(d => { countMap[d.date] = d.count })
  const maxCount = Math.max(...Object.values(countMap), 1)

  // Align grid start to Monday on/before dateFrom
  const startRaw  = new Date(dateFrom)
  const endRaw    = new Date(dateTo)
  const daysToMon = (startRaw.getDay() + 6) % 7
  const gridStart = new Date(startRaw)
  gridStart.setDate(gridStart.getDate() - daysToMon)

  const weeks = []
  const cur   = new Date(gridStart)
  while (cur <= endRaw) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const iso = fmt(cur)
      week.push({ iso, inRange: cur >= startRaw && cur <= endRaw, count: countMap[iso] ?? 0, month: cur.getMonth(), dayOfMonth: cur.getDate() })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <div className="rpt-cal-wrap">
      {/* Month labels */}
      <div className="rpt-cal-month-row">
        <div style={{ width: 28 }} />
        {weeks.map((w, wi) => (
          <div key={wi} className="rpt-cal-month-lbl">
            {w[0].dayOfMonth <= 7 ? MONTH_VN[w[0].month] : ''}
          </div>
        ))}
      </div>

      {/* Grid: DOW labels + week columns */}
      <div className="rpt-cal-body">
        <div className="rpt-cal-dow-col">
          {DOW_VN.map((l, i) => (
            <div key={i} className="rpt-cal-dow-lbl">{i % 2 === 0 ? l : ''}</div>
          ))}
        </div>
        <div className="rpt-cal-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="rpt-cal-week">
              {week.map((day, di) => (
                <div key={di}
                  className={`rpt-cal-cell${day.inRange ? '' : ' rpt-cal-cell--out'}`}
                  style={day.inRange ? { background: heatColor(day.count, maxCount) } : {}}
                  onMouseEnter={() => day.inRange && setHov(day)}
                  onMouseLeave={() => setHov(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: hover info + legend */}
      <div className="rpt-cal-footer">
        <span className="rpt-cal-hover-info">
          {hov ? `📅 ${hov.iso}: ${hov.count.toLocaleString('vi-VN')} records` : ' '}
        </span>
        <div className="rpt-cal-legend">
          <span>Ít</span>
          {['#edf0f3','#c6efda','#84d4a8','#3cb872','#1f7a43'].map(c => (
            <div key={c} className="rpt-cal-legend-cell" style={{ background: c }} />
          ))}
          <span>Nhiều</span>
        </div>
      </div>
    </div>
  )
}

// ── Time Pattern Heatmap (DOW × Hour) ─────────────────────────────────────────

function TimeHeatmap({ data }) {
  const [hov, setHov] = useState(null)
  // Postgres DOW: 0=Sun,1=Mon,...,6=Sat — display Mon-first
  const DOW_ORDER  = [1, 2, 3, 4, 5, 6, 0]
  const DOW_LABELS = ['T2','T3','T4','T5','T6','T7','CN']

  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0))
  ;(data ?? []).forEach(({ dow, hour, count }) => { matrix[dow][hour] = count })
  const maxVal = Math.max(...matrix.flat(), 1)

  return (
    <div className="rpt-time-wrap">
      {/* Hour axis labels */}
      <div className="rpt-time-header">
        <div className="rpt-time-row-lbl" />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="rpt-time-hour-lbl">{h % 6 === 0 ? `${h}h` : ''}</div>
        ))}
      </div>

      {/* Rows (Mon → Sun) */}
      {DOW_ORDER.map((dow, ri) => (
        <div key={dow} className="rpt-time-row">
          <div className="rpt-time-row-lbl">{DOW_LABELS[ri]}</div>
          {matrix[dow].map((count, hour) => (
            <div key={hour}
              className="rpt-time-cell"
              style={{ background: heatColor(count, maxVal) }}
              onMouseEnter={() => setHov({ label: DOW_LABELS[ri], hour, count })}
              onMouseLeave={() => setHov(null)}
            />
          ))}
        </div>
      ))}

      {/* Hover info */}
      <div className="rpt-time-hover">
        {hov
          ? `${hov.label} ${String(hov.hour).padStart(2,'0')}:00 – ${String(hov.hour+1).padStart(2,'0')}:00 — ${hov.count.toLocaleString('vi-VN')} records`
          : ' '}
      </div>
    </div>
  )
}

// ── Tab 4: Hoạt động (Heatmap) ────────────────────────────────────────────────

function HeatmapTab() {
  const [period,     setPeriod]     = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      setData(await getReportsHeatmap({ date_from, date_to }))
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
  const totalRec  = (data?.by_date ?? []).reduce((s, d) => s + d.count, 0)
  const activeDays = (data?.by_date ?? []).filter(d => d.count > 0).length

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {date_from && date_to && (() => {
          const fmtFull = iso => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return <span className="rpt-staff-daterange">{fmtFull(date_from)} – {fmtFull(date_to)}</span>
        })()}
      </div>

      {/* Summary strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng records</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : totalRec.toLocaleString('vi-VN')}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Ngày có hoạt động</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : activeDays}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Trung bình / ngày</div>
          <div className="rpt-staff-strip-val">
            {loading ? '—' : activeDays ? (totalRec / activeDays).toFixed(1) : '0'}
          </div>
        </div>
      </div>

      {/* Calendar heatmap */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Lịch hoạt động theo ngày</div>
        </div>
        <div className="bbo-card-body">
          {loading
            ? <div className="rpt-skeleton" style={{ height: 130 }} />
            : <CalendarHeatmap data={data?.by_date} dateFrom={date_from} dateTo={date_to} />
          }
        </div>
      </div>

      {/* Time pattern heatmap */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Mẫu hoạt động theo khung giờ</div>
          <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>Giờ Việt Nam (UTC+7)</div>
        </div>
        <div className="bbo-card-body">
          {loading
            ? <div className="rpt-skeleton" style={{ height: 200 }} />
            : <TimeHeatmap data={data?.by_dow_hour} />
          }
        </div>
      </div>

    </div>
  )
}

// ── Tab 5: Chất lượng & Flags ─────────────────────────────────────────────────

const OCR_STATUS_LABELS = { success: 'Thành công', failed: 'Thất bại', pending: 'Đang xử lý', 'n/a': 'Không có OCR' }
const OCR_STATUS_COLORS = { success: '#1f7a43', failed: '#dc2626', pending: '#d97706', 'n/a': '#94a3b8' }

function QualityTab() {
  const [period,     setPeriod]     = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      setData(await getReportsQuality({ date_from, date_to }))
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
  const flagRate  = Number(data?.flag_rate ?? 0)
  const flagColor = flagRate >= 20 ? '#dc2626' : flagRate >= 10 ? '#d97706' : '#1f7a43'

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {date_from && date_to && (() => {
          const fmtFull = iso => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return <span className="rpt-staff-daterange">{fmtFull(date_from)} – {fmtFull(date_to)}</span>
        })()}
      </div>

      {/* KPI strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng records</div>
          <div className="rpt-staff-strip-val">
            {loading ? '—' : (data?.total_records ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Đã flagged</div>
          <div className="rpt-staff-strip-val" style={{ color: '#dc2626' }}>
            {loading ? '—' : (data?.total_flagged ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tỷ lệ flag</div>
          <div className="rpt-staff-strip-val" style={{ color: flagColor }}>
            {loading ? '—' : `${flagRate}%`}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">OCR thành công</div>
          <div className="rpt-staff-strip-val" style={{ color: '#1f7a43' }}>
            {loading ? '—' : data?.ocr_success_rate != null ? `${data.ocr_success_rate}%` : '—'}
          </div>
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="rpt-breakdown-grid">

        {/* By document type */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo loại tài liệu</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>Top 15 bị flag</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_document_type?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-quality-flag-list">
                    {data.by_document_type.map((row, i) => (
                      <div key={i} className="rpt-quality-flag-row">
                        <div className="rpt-quality-flag-label" title={row.name}>{row.name || row.code}</div>
                        <div className="rpt-quality-flag-track">
                          <div className="rpt-quality-flag-fill"
                            style={{ width: `${Math.min(Number(row.flag_rate), 100)}%` }} />
                        </div>
                        <div className="rpt-quality-flag-count">{row.flagged}</div>
                        <div className="rpt-quality-flag-rate">{row.flag_rate}%</div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

        {/* Platform + OCR */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Nền tảng & OCR</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : <>
                  {data?.by_platform?.length > 0 && (
                    <div className="rpt-quality-section">
                      <div className="rpt-quality-section-title">Tỷ lệ flag theo nền tảng</div>
                      <div className="rpt-quality-flag-list">
                        {data.by_platform.map((row, i) => {
                          const pm = PLATFORM_META[row.platform] ?? PLATFORM_META.other
                          return (
                            <div key={i} className="rpt-quality-flag-row">
                              <div className="rpt-quality-flag-label">
                                <span className="rpt-quality-plat-dot" style={{ background: pm.color }} />
                                {pm.label}
                              </div>
                              <div className="rpt-quality-flag-track">
                                <div className="rpt-quality-flag-fill"
                                  style={{ width: `${Math.min(Number(row.flag_rate), 100)}%` }} />
                              </div>
                              <div className="rpt-quality-flag-count">{row.flagged}</div>
                              <div className="rpt-quality-flag-rate">{row.flag_rate}%</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {data?.ocr_status?.length > 0 && (
                    <div className="rpt-quality-section" style={{ marginTop: 20 }}>
                      <div className="rpt-quality-section-title">Trạng thái OCR</div>
                      <BreakdownBars items={data.ocr_status.map(s => ({
                        key:   s.status,
                        label: OCR_STATUS_LABELS[s.status] ?? s.status,
                        count: Number(s.count),
                        color: OCR_STATUS_COLORS[s.status] ?? '#94a3b8',
                      }))} />
                    </div>
                  )}
                </>
            }
          </div>
        </div>
      </div>

      {/* Flag sender table */}
      {!loading && data?.by_sender?.length > 0 && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Nhân viên có flag cao nhất</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Chỉ hiển thị người có ít nhất 1 flag
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-quality-sender-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nhân viên</th>
                  <th>Tổng gửi</th>
                  <th>Flagged</th>
                  <th>Tỷ lệ flag</th>
                </tr>
              </thead>
              <tbody>
                {data.by_sender.map((row, i) => {
                  const rate = Number(row.flag_rate ?? 0)
                  const rc   = rate >= 30 ? '#dc2626' : rate >= 15 ? '#d97706' : '#1f7a43'
                  return (
                    <tr key={i} className="rpt-staff-row">
                      <td className="rpt-staff-rank">{i + 1}</td>
                      <td><div className="rpt-staff-name">{row.sender_name}</div></td>
                      <td className="rpt-quality-sender-num">{row.total}</td>
                      <td className="rpt-quality-sender-flag">{row.flagged}</td>
                      <td className="rpt-quality-sender-rate-td">
                        <div className="rpt-quality-sender-rate-row">
                          <span style={{ color: rc, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {rate.toFixed(1)}%
                          </span>
                          <div className="rpt-quality-sender-bar-track">
                            <div className="rpt-quality-sender-bar-fill"
                              style={{ width: `${Math.min(rate, 100)}%`, background: rc }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SLA helpers ───────────────────────────────────────────────────────────────

function fmtHours(h) {
  if (h === null || h === undefined) return '—'
  const n = Number(h)
  if (isNaN(n) || n < 0) return '—'
  if (n < 1)  return `${Math.round(n * 60)} phút`
  if (n < 24) return `${n.toFixed(1)}h`
  const d = Math.floor(n / 24)
  const r = Math.round(n % 24)
  return r > 0 ? `${d}d ${r}h` : `${d} ngày`
}

function slaColor(h) {
  if (h === null || h === undefined) return 'var(--ink3)'
  const n = Number(h)
  if (n <= 8)  return '#1f7a43'
  if (n <= 24) return '#d97706'
  return '#dc2626'
}

function ageLabel(hours) {
  const h = Number(hours)
  if (h < 1)  return `${Math.round(h * 60)} phút`
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  const r = h % 24
  return r > 0 ? `${d}d ${r}h` : `${d} ngày`
}

function ageColor(hours) {
  const h = Number(hours)
  if (h < 4)  return '#1f7a43'
  if (h < 24) return '#d97706'
  if (h < 72) return '#ef8c2e'
  return '#dc2626'
}

const SLA_HIST_COLORS = ['#1f7a43', '#3cb872', '#d97706', '#ef8c2e', '#dc2626']

// ── SLA Histogram ─────────────────────────────────────────────────────────────

function SlaHistogram({ data, total }) {
  if (!data?.length) return <p className="rpt-empty-mini">Không có dữ liệu</p>
  const max = Math.max(...data.map(b => b.count), 1)
  return (
    <div className="rpt-sla-histogram">
      {data.map((b, i) => (
        <div key={b.bucket} className="rpt-sla-hist-row">
          <div className="rpt-sla-hist-label">{b.bucket}</div>
          <div className="rpt-sla-hist-track">
            <div className="rpt-sla-hist-fill"
              style={{ width: `${(b.count / max) * 100}%`, background: SLA_HIST_COLORS[i] ?? '#94a3b8' }} />
          </div>
          <div className="rpt-sla-hist-count">{Number(b.count).toLocaleString('vi-VN')}</div>
          <div className="rpt-sla-hist-pct">
            {total ? `${Math.round(b.count / total * 100)}%` : '0%'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab 6: SLA / Tốc độ xử lý ────────────────────────────────────────────────

function SlaTab() {
  const [period,     setPeriod]     = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      setData(await getReportsSla({ date_from, date_to }))
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
  const pct24       = data?.within_24h_pct ?? 0
  const pct24Color  = pct24 >= 80 ? '#1f7a43' : pct24 >= 50 ? '#d97706' : '#dc2626'
  const backlogNum  = data?.backlog_count ?? 0
  const backlogColor = backlogNum > 50 ? '#dc2626' : backlogNum > 20 ? '#d97706' : 'var(--ink)'
  const maxDocHours = Math.max(...(data?.by_document_type ?? []).map(d => Number(d.avg_hours)), 1)
  const maxPlatHours = Math.max(...(data?.by_platform ?? []).map(p => Number(p.avg_hours)), 1)

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {date_from && date_to && (() => {
          const fmtFull = iso => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return <span className="rpt-staff-daterange">{fmtFull(date_from)} – {fmtFull(date_to)}</span>
        })()}
      </div>

      {/* KPI strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Thời gian duyệt TB</div>
          <div className="rpt-staff-strip-val" style={{ color: slaColor(data?.avg_hours) }}>
            {loading ? '—' : fmtHours(data?.avg_hours)}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Trung vị</div>
          <div className="rpt-staff-strip-val" style={{ color: slaColor(data?.median_hours) }}>
            {loading ? '—' : fmtHours(data?.median_hours)}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Đạt SLA 24h</div>
          <div className="rpt-staff-strip-val" style={{ color: pct24Color }}>
            {loading ? '—' : data?.within_24h_pct != null ? `${pct24}%` : '—'}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Đang tồn đọng</div>
          <div className="rpt-staff-strip-val" style={{ color: backlogColor }}>
            {loading ? '—' : backlogNum.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Phân bố thời gian xử lý</div>
          <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {data?.total_resolved
              ? `${data.total_resolved.toLocaleString('vi-VN')} records đã duyệt`
              : 'Chỉ tính records đã được duyệt'}
          </div>
        </div>
        <div className="bbo-card-body">
          {loading
            ? <div className="rpt-skeleton" style={{ height: 160 }} />
            : <SlaHistogram data={data?.histogram} total={data?.total_resolved} />
          }
        </div>
      </div>

      {/* Breakdown grid: doc type + platform */}
      <div className="rpt-breakdown-grid">

        {/* By document type */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo loại tài liệu</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>Nhanh nhất → chậm nhất</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_document_type?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-sla-doctype-list">
                    {data.by_document_type.map((row, i) => (
                      <div key={i} className="rpt-sla-doctype-row">
                        <div className="rpt-sla-doctype-label" title={row.name}>{row.name}</div>
                        <div className="rpt-sla-doctype-track">
                          <div className="rpt-sla-doctype-fill"
                            style={{
                              width: `${Math.min(Number(row.avg_hours) / maxDocHours * 100, 100)}%`,
                              background: slaColor(row.avg_hours),
                            }} />
                        </div>
                        <div className="rpt-sla-doctype-val" style={{ color: slaColor(row.avg_hours) }}>
                          {fmtHours(row.avg_hours)}
                        </div>
                        <div className="rpt-sla-doctype-sub">{row.total} rec</div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

        {/* By platform */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo nền tảng</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_platform?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-sla-platform-list">
                    {data.by_platform.map((row, i) => {
                      const pm = PLATFORM_META[row.platform] ?? PLATFORM_META.other
                      return (
                        <div key={i} className="rpt-sla-plat-row">
                          <div className="rpt-sla-plat-label">
                            <span className="rpt-quality-plat-dot" style={{ background: pm.color }} />
                            {pm.label}
                          </div>
                          <div className="rpt-sla-plat-info">
                            <div className="rpt-sla-plat-avg" style={{ color: slaColor(row.avg_hours) }}>
                              {fmtHours(row.avg_hours)}
                            </div>
                            <div className="rpt-sla-plat-sub">
                              Trung vị {fmtHours(row.median_hours)} · {Number(row.total).toLocaleString('vi-VN')} records
                            </div>
                          </div>
                          <div className="rpt-sla-plat-track">
                            <div className="rpt-sla-plat-fill"
                              style={{
                                width: `${Math.min(Number(row.avg_hours) / maxPlatHours * 100, 100)}%`,
                                background: slaColor(row.avg_hours),
                              }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
            }
          </div>
        </div>
      </div>

      {/* Backlog table */}
      {!loading && data?.backlog?.length > 0 && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Tồn đọng chờ xử lý</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Cũ nhất trước — {data.backlog.length} records
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-sla-backlog-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Loại tài liệu</th>
                  <th>Nền tảng</th>
                  <th>Trạng thái</th>
                  <th>Nhận lúc</th>
                  <th>Đang chờ</th>
                </tr>
              </thead>
              <tbody>
                {data.backlog.map(row => {
                  const pm = PLATFORM_META[row.platform] ?? PLATFORM_META.other
                  const ac = ageColor(row.age_hours)
                  return (
                    <tr key={row.id} className="rpt-staff-row">
                      <td><div className="rpt-staff-name">{row.sender_name || '—'}</div></td>
                      <td className="rpt-sla-backlog-dt">{row.document_type_name}</td>
                      <td>
                        <span className="rpt-staff-plat"
                          style={{ background: pm.color + '1a', color: pm.color }}>
                          {pm.label}
                        </span>
                      </td>
                      <td>
                        <span className={`rpt-sla-status-chip rpt-sla-status-chip--${row.status}`}>
                          {STATUS_META[row.status]?.label ?? row.status}
                        </span>
                      </td>
                      <td className="rpt-sla-backlog-time">{fmtRelative(row.received_at)}</td>
                      <td>
                        <span className="rpt-sla-age" style={{ color: ac }}>
                          {ageLabel(row.age_hours)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Age bucket colors ─────────────────────────────────────────────────────────
const AGE_BUCKET_COLORS = ['#1f7a43', '#d97706', '#ef8c2e', '#dc2626']

// ── Tab 7: Backlog & Tồn đọng ─────────────────────────────────────────────────

function BacklogTab() {
  const [platform,  setPlatform]  = useState('')
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (platform) params.platform = platform
      setData(await getReportsBacklog(params))
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => { load() }, [load])

  const total      = data?.total_backlog  ?? 0
  const oldestH    = data?.oldest_hours   ?? 0
  const oldestColor = oldestH > 168 ? '#dc2626' : oldestH > 72 ? '#ef8c2e' : oldestH > 24 ? '#d97706' : '#1f7a43'
  const maxBucket  = Math.max(...(data?.age_buckets ?? []).map(b => b.count), 1)
  const maxDocCnt  = Math.max(...(data?.by_document_type ?? []).map(d => d.count), 1)

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-backlog-filter-title">Trạng thái hiện tại</div>
        <select className="rpt-select rpt-staff-plat-select" value={platform}
          onChange={e => setPlatform(e.target.value)}>
          <option value="">Tất cả nền tảng</option>
          <option value="telegram">Telegram</option>
          <option value="zalo">Zalo</option>
          <option value="manual">Thủ công</option>
        </select>
        <button className="bbo-btn bbo-btn-sm bbo-btn-outline" onClick={load}>↻ Làm mới</button>
      </div>

      {/* KPI strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng tồn đọng</div>
          <div className="rpt-staff-strip-val" style={{ color: total > 100 ? '#dc2626' : total > 30 ? '#d97706' : 'var(--ink)' }}>
            {loading ? '—' : total.toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Chờ mới (new)</div>
          <div className="rpt-staff-strip-val" style={{ color: '#2563eb' }}>
            {loading ? '—' : (data?.new_count ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Đang rà soát</div>
          <div className="rpt-staff-strip-val" style={{ color: '#d97706' }}>
            {loading ? '—' : (data?.reviewed_count ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Chờ lâu nhất</div>
          <div className="rpt-staff-strip-val" style={{ color: oldestColor }}>
            {loading ? '—' : ageLabel(oldestH)}
          </div>
        </div>
      </div>

      {/* Age buckets */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Phân bố thời gian chờ</div>
          <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
            Tính từ lúc nhận đến hiện tại
          </div>
        </div>
        <div className="bbo-card-body">
          {loading
            ? <div className="rpt-skeleton" style={{ height: 120 }} />
            : !data?.age_buckets?.length
              ? <p className="rpt-empty-mini">Không có dữ liệu</p>
              : <div className="rpt-sla-histogram">
                  {data.age_buckets.map((b, i) => (
                    <div key={b.bucket} className="rpt-sla-hist-row">
                      <div className="rpt-sla-hist-label">{b.bucket}</div>
                      <div className="rpt-sla-hist-track">
                        <div className="rpt-sla-hist-fill"
                          style={{ width: `${(b.count / maxBucket) * 100}%`, background: AGE_BUCKET_COLORS[i] ?? '#94a3b8' }} />
                      </div>
                      <div className="rpt-sla-hist-count">{Number(b.count).toLocaleString('vi-VN')}</div>
                      <div className="rpt-sla-hist-pct">
                        {total ? `${Math.round(b.count / total * 100)}%` : '0%'}
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      </div>

      {/* 2-col: doc type + sender */}
      <div className="rpt-breakdown-grid">

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo loại tài liệu</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_document_type?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-sla-doctype-list">
                    {data.by_document_type.map((row, i) => (
                      <div key={i} className="rpt-sla-doctype-row">
                        <div className="rpt-sla-doctype-label" title={row.name}>{row.name}</div>
                        <div className="rpt-sla-doctype-track">
                          <div className="rpt-sla-doctype-fill"
                            style={{ width: `${(row.count / maxDocCnt) * 100}%`, background: '#2563eb' }} />
                        </div>
                        <div className="rpt-sla-doctype-val" style={{ color: 'var(--ink)' }}>
                          {row.count}
                        </div>
                        <div className="rpt-sla-doctype-sub" style={{ color: ageColor(row.oldest_hours) }}>
                          {ageLabel(row.oldest_hours)}
                        </div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo nhân viên</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Top 10 tồn đọng nhiều nhất
            </div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_sender?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-backlog-sender-list">
                    {data.by_sender.map((row, i) => (
                      <div key={i} className="rpt-backlog-sender-row">
                        <div className="rpt-backlog-sender-rank">{i + 1}</div>
                        <div className="rpt-backlog-sender-name">{row.sender_name}</div>
                        <div className="rpt-backlog-sender-count">{row.count}</div>
                        <div className="rpt-backlog-sender-age" style={{ color: ageColor(row.oldest_hours) }}>
                          {ageLabel(row.oldest_hours)}
                        </div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>
      </div>

      {/* Records list */}
      {!loading && data?.records?.length > 0 && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Danh sách tồn đọng</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Cũ nhất trước · Hiển thị {data.records.length} / {total.toLocaleString('vi-VN')} records
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-sla-backlog-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Loại tài liệu</th>
                  <th>Nền tảng</th>
                  <th>Trạng thái</th>
                  <th>Nhận lúc</th>
                  <th>Đang chờ</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map(row => {
                  const pm = PLATFORM_META[row.platform] ?? PLATFORM_META.other
                  return (
                    <tr key={row.id} className="rpt-staff-row">
                      <td><div className="rpt-staff-name">{row.sender_name || '—'}</div></td>
                      <td className="rpt-sla-backlog-dt">{row.document_type_name}</td>
                      <td>
                        <span className="rpt-staff-plat"
                          style={{ background: pm.color + '1a', color: pm.color }}>
                          {pm.label}
                        </span>
                      </td>
                      <td>
                        <span className={`rpt-sla-status-chip rpt-sla-status-chip--${row.status}`}>
                          {STATUS_META[row.status]?.label ?? row.status}
                        </span>
                      </td>
                      <td className="rpt-sla-backlog-time">{fmtRelative(row.received_at)}</td>
                      <td>
                        <span className="rpt-sla-age" style={{ color: ageColor(row.age_hours) }}>
                          {ageLabel(row.age_hours)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Doc Type color palette ────────────────────────────────────────────────────
const DOC_COLORS = ['#1f7a43','#2563eb','#d97706','#7c3aed','#db2777','#0891b2','#65a30d','#dc2626']

// ── Multi-Line Chart ──────────────────────────────────────────────────────────

function MultiLineChart({ series, animKey }) {
  const wrapRef = useRef(null)
  const [cw, setCw] = useState(900)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([e]) => setCw(Math.max(300, e.contentRect.width)))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  if (!series?.length || !series[0]?.data?.length) {
    return (
      <div ref={wrapRef} style={{ width: '100%', height: VH }}>
        <div className="rpt-chart-empty">Không có dữ liệu</div>
      </div>
    )
  }

  const n       = series[0].data.length
  const allVals = series.flatMap(s => s.data.map(d => d.count))
  const maxY    = Math.max(...allVals, 1)
  const iW      = cw - PAD.left - PAD.right
  const iH      = VH - PAD.top - PAD.bottom

  const xOf = i => PAD.left + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW)
  const yOf = v => PAD.top + iH - (v / maxY) * iH
  const toPoints = data => data.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.count).toFixed(1)}`).join(' ')

  const gridVals = [0, Math.round(maxY * 0.33), Math.round(maxY * 0.67), maxY]
  const step     = Math.max(1, Math.ceil(n / 8))
  const showLbl  = i => i % step === 0 || i === n - 1

  function onMouseMove(e) {
    const rect   = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * cw
    let best = 0, bestD = Infinity
    series[0].data.forEach((_, i) => {
      const d = Math.abs(xOf(i) - mouseX)
      if (d < bestD) { bestD = d; best = i }
    })
    if (bestD > iW / n + 10) { setHover(null); return }
    setHover({ idx: best, x: xOf(best) })
  }

  const tooltipH = 28 + series.length * 18
  const tooltipX = hover ? (hover.x + 140 > cw ? hover.x - 144 : hover.x + 10) : 0

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div className="rpt-ml-legend">
        {series.map(s => (
          <div key={s.code} className="rpt-ml-legend-item">
            <span className="rpt-ml-legend-dot" style={{ background: s.color }} />
            <span className="rpt-ml-legend-label">{s.name}</span>
          </div>
        ))}
      </div>
      <svg
        key={animKey}
        viewBox={`0 0 ${cw} ${VH}`}
        width={cw} height={VH}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="rptMLClip">
            <rect x={PAD.left} y={PAD.top} width={iW} height={iH} />
          </clipPath>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yOf(v)} x2={cw - PAD.right} y2={yOf(v)}
              stroke="#e8ecf0" strokeWidth="1" />
            <text x={PAD.left - 5} y={yOf(v)} textAnchor="end" dominantBaseline="middle"
              fontSize="9.5" fill="#b0bec9">{v}</text>
          </g>
        ))}

        {series.map(s => (
          <g key={s.code} clipPath="url(#rptMLClip)">
            <polyline
              points={toPoints(s.data)}
              fill="none" stroke={s.color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              opacity={hover ? 0.55 : 1}
            />
          </g>
        ))}

        {series[0].data.map((p, i) => showLbl(i) && (
          <text key={i} x={xOf(i)} y={VH - 6} textAnchor="middle" fontSize="9.5" fill="#b0bec9">
            {fmtDate(p.date)}
          </text>
        ))}

        {hover && (
          <>
            <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + iH}
              stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" opacity=".4" />
            {series.map(s => (
              <circle key={s.code}
                cx={hover.x} cy={yOf(s.data[hover.idx]?.count ?? 0)} r={4}
                fill="#fff" stroke={s.color} strokeWidth="2.5" />
            ))}
            <g transform={`translate(${tooltipX},${PAD.top})`}>
              <rect x="0" y="0" width="136" height={tooltipH} rx="7" fill="#1a2533" opacity=".92" />
              <text x="10" y="17" fontSize="10" fill="#94a3b8" fontWeight="600">
                {fmtDate(series[0].data[hover.idx]?.date)}
              </text>
              {series.map((s, si) => (
                <g key={s.code}>
                  <circle cx="14" cy={30 + si * 18} r={3.5} fill={s.color} />
                  <text x="23" y={34 + si * 18} fontSize="10.5" fill="#e2e8f0">
                    {s.name.length > 13 ? s.name.slice(0, 13) + '…' : s.name}
                    {': '}
                    <tspan fontWeight="700" fill="#fff">{s.data[hover.idx]?.count ?? 0}</tspan>
                  </text>
                </g>
              ))}
            </g>
          </>
        )}
      </svg>
    </div>
  )
}

// ── Tab 8: Xu hướng loại Tài liệu ────────────────────────────────────────────

function DocTrendTab() {
  const [period,     setPeriod]     = useState('month')
  const [compare,    setCompare]    = useState(true)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [curr,       setCurr]       = useState(null)
  const [prev,       setPrev]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [animKey,    setAnimKey]    = useState(0)

  const load = useCallback(async () => {
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    if (!date_from || !date_to) return
    setLoading(true)
    try {
      const [currData, prevData] = await Promise.all([
        getReportsDocTrend({ date_from, date_to }),
        compare
          ? getReportsDocTrend(buildPrevPeriod(period, date_from, date_to))
          : Promise.resolve(null),
      ])
      setCurr(currData)
      setPrev(prevData)
      setAnimKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }, [period, compare, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const { date_from, date_to } = buildPeriod(period, customFrom, customTo)

  const topTypes = curr?.by_document_type?.slice(0, 5) ?? []
  const series = topTypes.map((dt, i) => ({
    code:  dt.code,
    name:  dt.name,
    color: DOC_COLORS[i % DOC_COLORS.length],
    data:  fillTimeline(
      (curr?.timeline ?? []).filter(r => r.code === dt.code),
      date_from, date_to
    ),
  }))

  const prevMap = Object.fromEntries((prev?.by_document_type ?? []).map(r => [r.code, r]))
  const totalThis = (curr?.by_document_type ?? []).reduce((s, r) => s + r.total, 0)
  const topDoc    = curr?.by_document_type?.[0]

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ ngày</label>
              <input type="date" className="rpt-date-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến ngày</label>
              <input type="date" className="rpt-date-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        {date_from && date_to && (() => {
          const fmtFull = iso => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return <span className="rpt-staff-daterange">{fmtFull(date_from)} – {fmtFull(date_to)}</span>
        })()}
        <label className="rpt-toggle-label">
          <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
          So sánh kỳ trước
        </label>
      </div>

      {/* KPI strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng records</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : totalThis.toLocaleString('vi-VN')}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Loại tài liệu hoạt động</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : (curr?.by_document_type?.length ?? 0)}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Loại nhiều nhất</div>
          <div className="rpt-staff-strip-val" style={{ fontSize: 15, color: DOC_COLORS[0] }}>
            {loading ? '—' : topDoc?.name ?? '—'}
          </div>
        </div>
      </div>

      {/* Multi-line chart */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Xu hướng theo ngày</div>
          <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>Top 5 loại tài liệu</div>
        </div>
        <div className="bbo-card-body rpt-chart-body">
          {loading
            ? <div className="rpt-skeleton rpt-skeleton--chart" />
            : <MultiLineChart series={series} animKey={animKey} />
          }
        </div>
      </div>

      {/* Comparison table */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Chi tiết theo loại tài liệu</div>
          {compare && prev && (
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              So sánh với kỳ trước
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading
            ? <div className="rpt-skeleton rpt-skeleton--table" />
            : (
              <table className="rpt-doctrend-table">
                <thead>
                  <tr>
                    <th>Loại tài liệu</th>
                    <th>Kỳ này</th>
                    {compare && prev && <th>Kỳ trước</th>}
                    {compare && prev && <th>Tăng trưởng</th>}
                    <th>Đã duyệt</th>
                    <th>Flagged</th>
                    <th>Tỷ lệ duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {(curr?.by_document_type ?? []).map((row, i) => {
                    const p     = compare ? prevMap[row.code] : null
                    const delta = p ? calcDelta(row.total, p.total) : null
                    const rate  = Number(row.approval_rate ?? 0)
                    const rc    = rate >= 80 ? '#1f7a43' : rate >= 60 ? '#d97706' : '#dc2626'
                    return (
                      <tr key={row.code} className="rpt-staff-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="rpt-ml-legend-dot"
                              style={{ background: DOC_COLORS[i % DOC_COLORS.length], flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{row.name}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>{Number(row.total).toLocaleString('vi-VN')}</td>
                        {compare && prev && (
                          <td style={{ color: 'var(--ink3)' }}>{p ? Number(p.total).toLocaleString('vi-VN') : '—'}</td>
                        )}
                        {compare && prev && (
                          <td>
                            {delta !== null
                              ? <span className={`rpt-doctrend-delta rpt-doctrend-delta--${delta >= 0 ? 'up' : 'down'}`}>
                                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
                                </span>
                              : <span style={{ color: 'var(--ink3)' }}>—</span>
                            }
                          </td>
                        )}
                        <td>{Number(row.approved).toLocaleString('vi-VN')}</td>
                        <td style={{ color: row.flagged > 0 ? '#dc2626' : 'var(--ink3)', fontWeight: row.flagged > 0 ? 700 : 400 }}>
                          {row.flagged > 0 ? row.flagged : '—'}
                        </td>
                        <td>
                          <span style={{ color: rc, fontWeight: 700 }}>{rate}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ── Audit action metadata ─────────────────────────────────────────────────────

const AUDIT_ACTION_META = {
  create:          { label: 'Tạo mới',      color: '#1f7a43' },
  edit:            { label: 'Chỉnh sửa',    color: '#2563eb' },
  review:          { label: 'Rà soát',      color: '#d97706' },
  approve:         { label: 'Duyệt',        color: '#059669' },
  flag:            { label: 'Gắn cờ',       color: '#f59e0b' },
  delete:          { label: 'Xóa',          color: '#dc2626' },
  login:           { label: 'Đăng nhập',    color: '#7c3aed' },
  logout:          { label: 'Đăng xuất',    color: '#64748b' },
  password_change: { label: 'Đổi mật khẩu', color: '#0891b2' },
}

const SENSITIVE_ACTIONS = new Set(['delete', 'flag', 'password_change'])

function auditActionLabel(action) {
  return AUDIT_ACTION_META[action]?.label ?? action
}
function auditActionColor(action) {
  return AUDIT_ACTION_META[action]?.color ?? '#94a3b8'
}

// ── AuditTab ──────────────────────────────────────────────────────────────────

function AuditTab() {
  const [period, setPeriod]       = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveMonths, setArchiveMonths] = useState(12)
  const [archiveResult, setArchiveResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
      setData(await getReportsAudit({ date_from, date_to }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const handleArchive = async () => {
    if (!window.confirm(`Lưu trữ toàn bộ log cũ hơn ${archiveMonths} tháng? Thao tác này không thể hoàn tác.`)) return
    setArchiving(true)
    setArchiveResult(null)
    try {
      const r = await archiveAuditLogs(archiveMonths)
      setArchiveResult(`Đã lưu trữ ${r.archived.toLocaleString('vi-VN')} bản ghi.`)
    } catch (e) {
      setArchiveResult('Lỗi: ' + e.message)
    } finally {
      setArchiving(false)
    }
  }

  const s          = data?.summary ?? {}
  const totalLogs  = Number(s.total_logs ?? 0)
  const maxAction  = Math.max(1, ...(data?.by_action ?? []).map(r => r.count))
  const tl         = (() => {
    if (!data?.timeline?.length) return []
    const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
    return fillTimeline(data.timeline, date_from, date_to)
  })()

  return (
    <div className="rpt-tab-body">

      {/* Filter bar */}
      <div className="rpt-filter-bar">
        <div className="rpt-period-pills">
          {PERIOD_PRESETS.map(p => (
            <button key={p.key}
              className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
              onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="rpt-custom-range">
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Từ</label>
              <input type="date" className="rpt-filter-input" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="rpt-filter-group">
              <label className="rpt-filter-label">Đến</label>
              <input type="date" className="rpt-filter-input" value={customTo}
                onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        <button className="rpt-filter-btn" onClick={load} disabled={loading}>
          {loading ? 'Đang tải…' : 'Áp dụng'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="rpt-staff-strip">
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Tổng hoạt động</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : totalLogs.toLocaleString('vi-VN')}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Người dùng hoạt động</div>
          <div className="rpt-staff-strip-val">{loading ? '—' : Number(s.unique_users ?? 0)}</div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Hành động nhạy cảm</div>
          <div className="rpt-staff-strip-val"
            style={{ color: Number(s.sensitive_count) > 0 ? '#dc2626' : 'var(--ink)' }}>
            {loading ? '—' : Number(s.sensitive_count ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rpt-staff-strip-item">
          <div className="rpt-staff-strip-label">Log mới nhất</div>
          <div className="rpt-staff-strip-val" style={{ fontSize: 14 }}>
            {loading ? '—' : (s.newest_log ? fmtRelative(s.newest_log) : '—')}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Hoạt động theo ngày</div>
        </div>
        <div className="bbo-card-body rpt-chart-body">
          {loading
            ? <div className="rpt-skeleton rpt-skeleton--chart" />
            : <LineChart current={tl} previous={null} animKey={period + customFrom + customTo} />
          }
        </div>
      </div>

      {/* By-action + by-user 2-col */}
      <div className="rpt-breakdown-grid">

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Phân tích theo hành động</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_action?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-audit-action-list">
                    {data.by_action.map(row => (
                      <div key={row.action} className="rpt-audit-action-row">
                        <div className="rpt-audit-action-badge"
                          style={{ background: auditActionColor(row.action) + '1a', color: auditActionColor(row.action) }}>
                          {auditActionLabel(row.action)}
                          {SENSITIVE_ACTIONS.has(row.action) && (
                            <span className="rpt-audit-sensitive-dot" title="Hành động nhạy cảm" />
                          )}
                        </div>
                        <div className="rpt-sla-doctype-track">
                          <div className="rpt-sla-doctype-fill"
                            style={{ width: `${(row.count / maxAction) * 100}%`, background: auditActionColor(row.action) + 'aa' }} />
                        </div>
                        <div className="rpt-audit-action-count">{Number(row.count).toLocaleString('vi-VN')}</div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Theo người dùng</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>Top 20</div>
          </div>
          <div className="bbo-card-body">
            {loading
              ? <div className="rpt-skeleton" />
              : !data?.by_user?.length
                ? <p className="rpt-empty-mini">Không có dữ liệu</p>
                : <div className="rpt-audit-user-list">
                    {data.by_user.map((row, i) => (
                      <div key={row.id ?? i} className="rpt-audit-user-row">
                        <div className="rpt-backlog-sender-rank">{i + 1}</div>
                        <div className="rpt-audit-user-info">
                          <div className="rpt-audit-user-name">{row.display_name ?? '—'}</div>
                          <div className="rpt-audit-user-role">{row.role}</div>
                        </div>
                        <div className="rpt-audit-user-count">{Number(row.total_actions).toLocaleString('vi-VN')}</div>
                        {Number(row.sensitive_count) > 0 && (
                          <div className="rpt-audit-user-sensitive" title="Hành động nhạy cảm">
                            {row.sensitive_count}⚠
                          </div>
                        )}
                        <div className="rpt-audit-user-last">{fmtRelative(row.last_action_at)}</div>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

      </div>

      {/* Recent log table */}
      {!loading && data?.recent_logs?.length > 0 && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Nhật ký gần đây</div>
            <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              {data.recent_logs.length} bản ghi mới nhất
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-sla-backlog-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_logs.map(row => (
                  <tr key={row.id} className="rpt-staff-row">
                    <td>
                      <div className="rpt-staff-name">{row.user_name}</div>
                      {row.user_role && (
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{row.user_role}</div>
                      )}
                    </td>
                    <td>
                      <span className="rpt-audit-chip"
                        style={{ background: auditActionColor(row.action) + '1a', color: auditActionColor(row.action) }}>
                        {auditActionLabel(row.action)}
                      </span>
                      {SENSITIVE_ACTIONS.has(row.action) && (
                        <span className="rpt-audit-sensitive-badge">Nhạy cảm</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{row.resource ?? '—'}</div>
                      {row.resource_id && (
                        <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'monospace' }}>
                          {String(row.resource_id).slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink3)', fontFamily: 'monospace' }}>
                      {row.ip_address ?? '—'}
                    </td>
                    <td className="rpt-sla-backlog-time">{fmtRelative(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archive panel (admin action) */}
      <div className="bbo-card rpt-audit-archive-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Lưu trữ log cũ</div>
          <div className="bbo-card-action" style={{ fontSize: 12, color: 'var(--ink3)' }}>
            Chỉ Admin
          </div>
        </div>
        <div className="bbo-card-body rpt-audit-archive-body">
          <p className="rpt-audit-archive-desc">
            Di chuyển các bản ghi log cũ hơn N tháng sang bảng lưu trữ cold storage.
            Dữ liệu không bị xóa — vẫn có thể truy xuất từ <code>audit_logs_archive</code>.
          </p>
          <div className="rpt-audit-archive-controls">
            <label className="rpt-filter-label">Cũ hơn (tháng)</label>
            <input type="number" className="rpt-filter-input rpt-audit-months-input"
              min={1} max={60} value={archiveMonths}
              onChange={e => setArchiveMonths(Number(e.target.value))} />
            <button className="rpt-audit-archive-btn" onClick={handleArchive} disabled={archiving}>
              {archiving ? 'Đang lưu trữ…' : 'Lưu trữ ngay'}
            </button>
          </div>
          {archiveResult && (
            <div className={`rpt-audit-archive-result${archiveResult.startsWith('Lỗi') ? ' rpt-audit-archive-result--err' : ''}`}>
              {archiveResult}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Export tab ────────────────────────────────────────────────────────────────

const EXPORT_TYPES = [
  {
    key:  'records',
    label: 'Danh sách tài liệu',
    icon:  '📄',
    desc:  'Toàn bộ records theo bộ lọc, kèm phân loại, trạng thái và thời gian xử lý',
    formats: ['xlsx', 'csv'],
    hasStatusFilter: true,
  },
  {
    key:  'summary',
    label: 'Tổng hợp',
    icon:  '📊',
    desc:  'Excel 4 sheet: theo trạng thái, nền tảng, loại tài liệu và xu hướng theo ngày',
    formats: ['xlsx'],
    note:  'Chỉ Excel (4 sheet)',
  },
  {
    key:  'financial',
    label: 'Tài chính',
    icon:  '💰',
    desc:  'Tổng hợp trường số (sum) theo loại tài liệu — chỉ records đã được duyệt',
    formats: ['xlsx', 'csv'],
  },
  {
    key:  'staff',
    label: 'Nhân viên',
    icon:  '👥',
    desc:  'Hiệu suất xử lý theo người gửi: tổng, tỷ lệ duyệt, thời gian xử lý trung bình',
    formats: ['xlsx', 'csv'],
  },
  {
    key:  'audit',
    label: 'Audit logs',
    icon:  '🔐',
    desc:  'Nhật ký hoạt động đầy đủ: người dùng, hành động, đối tượng, IP, thời gian',
    formats: ['xlsx', 'csv'],
  },
]

const FORMAT_META = {
  xlsx: { label: 'Excel (.xlsx)', icon: '📗' },
  csv:  { label: 'CSV (.csv)',    icon: '📋' },
}

const STATUS_EXPORT_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'new',      label: 'Mới' },
  { value: 'reviewed', label: 'Đang rà soát' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'flagged',  label: 'Flagged' },
]

const PLATFORM_EXPORT_OPTIONS = [
  { value: '',          label: 'Tất cả nền tảng' },
  { value: 'telegram',  label: 'Telegram' },
  { value: 'zalo',      label: 'Zalo' },
  { value: 'manual',    label: 'Thủ công' },
]

function ExportTab() {
  const [selType, setSelType]     = useState('records')
  const [format, setFormat]       = useState('xlsx')
  const [period, setPeriod]       = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')
  const [platform, setPlatform]   = useState('')
  const [statusFilter, setStatus] = useState('')
  const [exporting, setExporting] = useState(false)
  const [lastMsg, setLastMsg]     = useState(null) // { ok, text }
  const [history, setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('bbotech_export_history') ?? '[]') }
    catch { return [] }
  })

  const selectedTypeMeta  = EXPORT_TYPES.find(t => t.key === selType)
  const availFormats      = selectedTypeMeta?.formats ?? ['xlsx']
  const activeFormat      = availFormats.includes(format) ? format : availFormats[0]

  useEffect(() => {
    if (!availFormats.includes(format)) setFormat(availFormats[0])
  }, [selType]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExport() {
    setExporting(true)
    setLastMsg(null)
    try {
      const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
      const params = { type: selType, format: activeFormat, date_from, date_to }
      if (platform && selType !== 'audit') params.platform = platform
      if (statusFilter && selType === 'records') params.status = statusFilter

      const response = await exportReport(params)

      const cd   = response.headers['content-disposition'] ?? ''
      const match = cd.match(/filename="?([^";\s]+)"?/)
      const fname = match?.[1] ?? `BBOTECH_${selType}_${date_from}.${activeFormat}`

      const url = URL.createObjectURL(new Blob([response.data]))
      const a   = document.createElement('a')
      a.href     = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const entry = {
        type: selType,
        format: activeFormat,
        label: selectedTypeMeta?.label,
        date_from,
        date_to,
        ts: Date.now(),
      }
      const newHist = [entry, ...history].slice(0, 8)
      setHistory(newHist)
      localStorage.setItem('bbotech_export_history', JSON.stringify(newHist))
      setLastMsg({ ok: true, text: `Đã tải xuống ${fname}` })
    } catch (err) {
      let msg = 'Xuất thất bại'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          msg = JSON.parse(text).error || msg
        } catch {}
      } else if (err.message) {
        msg = err.message
      }
      setLastMsg({ ok: false, text: msg })
    } finally {
      setExporting(false)
    }
  }

  function fmtHistDate(ts) {
    return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="rpt-tab-body">

      {/* Report type selector */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Chọn loại báo cáo</div>
        </div>
        <div className="bbo-card-body">
          <div className="rpt-export-type-grid">
            {EXPORT_TYPES.map(t => (
              <button
                key={t.key}
                className={`rpt-export-type-card${selType === t.key ? ' rpt-export-type-card--active' : ''}`}
                onClick={() => setSelType(t.key)}
              >
                <div className="rpt-export-type-icon">{t.icon}</div>
                <div className="rpt-export-type-label">{t.label}</div>
                <div className="rpt-export-type-desc">{t.desc}</div>
                {t.note && <div className="rpt-export-type-note">{t.note}</div>}
                {selType === t.key && <div className="rpt-export-type-check">✓</div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Config: period + format + filters */}
      <div className="rpt-export-config-grid">

        {/* Period */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Khoảng thời gian</div>
          </div>
          <div className="bbo-card-body">
            <div className="rpt-period-pills" style={{ marginBottom: 12 }}>
              {PERIOD_PRESETS.map(p => (
                <button key={p.key}
                  className={`rpt-period-pill${period === p.key ? ' rpt-period-pill--active' : ''}`}
                  onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="rpt-custom-range">
                <div className="rpt-filter-group">
                  <label className="rpt-filter-label">Từ ngày</label>
                  <input type="date" className="rpt-filter-input" value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div className="rpt-filter-group">
                  <label className="rpt-filter-label">Đến ngày</label>
                  <input type="date" className="rpt-filter-input" value={customTo}
                    onChange={e => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Format + Filters */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Định dạng & Bộ lọc</div>
          </div>
          <div className="bbo-card-body rpt-export-options-body">

            {/* Format */}
            <div>
              <div className="rpt-filter-label" style={{ marginBottom: 8 }}>Định dạng xuất</div>
              <div className="rpt-export-format-pills">
                {availFormats.map(f => (
                  <button key={f}
                    className={`rpt-export-format-pill${activeFormat === f ? ' rpt-export-format-pill--active' : ''}`}
                    onClick={() => setFormat(f)}>
                    {FORMAT_META[f].icon} {FORMAT_META[f].label}
                  </button>
                ))}
                {EXPORT_TYPES.find(t => t.key === selType)?.formats.length === 1 && (
                  <span className="rpt-export-format-note">
                    {selectedTypeMeta?.note}
                  </span>
                )}
              </div>
            </div>

            {/* Platform filter */}
            {selType !== 'audit' && selType !== 'summary' && (
              <div>
                <label className="rpt-filter-label" style={{ display: 'block', marginBottom: 6 }}>
                  Nền tảng
                </label>
                <select className="rpt-filter-input rpt-filter-select" value={platform}
                  onChange={e => setPlatform(e.target.value)}>
                  {PLATFORM_EXPORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status filter (records only) */}
            {selType === 'records' && (
              <div>
                <label className="rpt-filter-label" style={{ display: 'block', marginBottom: 6 }}>
                  Trạng thái
                </label>
                <select className="rpt-filter-input rpt-filter-select" value={statusFilter}
                  onChange={e => setStatus(e.target.value)}>
                  {STATUS_EXPORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Export action */}
      <div className="rpt-export-action-bar">
        <div className="rpt-export-action-info">
          <div className="rpt-export-action-summary">
            {selectedTypeMeta?.icon} <strong>{selectedTypeMeta?.label}</strong>
            {' · '}
            {FORMAT_META[activeFormat].label}
            {' · '}
            {(() => {
              const { date_from, date_to } = buildPeriod(period, customFrom, customTo)
              return `${date_from} → ${date_to}`
            })()}
          </div>
          {lastMsg && (
            <div className={`rpt-export-msg${lastMsg.ok ? '' : ' rpt-export-msg--err'}`}>
              {lastMsg.ok ? '✓' : '✗'} {lastMsg.text}
            </div>
          )}
        </div>
        <button className="rpt-export-btn" onClick={handleExport} disabled={exporting}>
          {exporting
            ? <><span className="rpt-export-btn-spinner" /> Đang tạo file…</>
            : <><span>⬇</span> Xuất báo cáo</>
          }
        </button>
      </div>

      {/* Export history */}
      {history.length > 0 && (
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Lịch sử xuất</div>
            <button className="bbo-card-action rpt-export-clear-hist"
              onClick={() => { setHistory([]); localStorage.removeItem('bbotech_export_history') }}>
              Xóa lịch sử
            </button>
          </div>
          <div className="bbo-card-body">
            <div className="rpt-export-history-list">
              {history.map((h, i) => {
                const tm = EXPORT_TYPES.find(t => t.key === h.type)
                return (
                  <div key={i} className="rpt-export-history-item">
                    <div className="rpt-export-history-icon">{tm?.icon ?? '📄'}</div>
                    <div className="rpt-export-history-info">
                      <div className="rpt-export-history-label">{h.label ?? h.type}</div>
                      <div className="rpt-export-history-meta">
                        {FORMAT_META[h.format]?.label} · {h.date_from} → {h.date_to}
                      </div>
                    </div>
                    <div className="rpt-export-history-time">{fmtHistDate(h.ts)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Coming Soon placeholder ────────────────────────────────────────────────────

function ComingSoonTab({ title, desc }) {
  return (
    <div className="rpt-coming-soon">
      <div className="rpt-coming-icon">🔜</div>
      <div className="rpt-coming-title">{title}</div>
      <div className="rpt-coming-desc">{desc}</div>
      <div className="rpt-coming-chip">Đang phát triển</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const userRole    = useAuthStore(s => s.user?.role)
  const visibleTabs = TABS.filter(t => !t.roles || t.roles.includes(userRole))

  const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.key ?? 'overview')

  // Reset tab if current tab becomes inaccessible after role change
  useEffect(() => {
    if (!visibleTabs.find(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? 'overview')
    }
  }, [userRole]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rpt-page">
      <div className="rpt-header">
        <div>
          <div className="rpt-header-title">Báo cáo</div>
          <div className="rpt-header-sub">Phân tích hiệu suất và tổng hợp dữ liệu định kỳ</div>
        </div>
      </div>

      <div className="rpt-tabnav">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            disabled={tab.soon}
            className={[
              'rpt-tabnav__item',
              activeTab === tab.key ? 'rpt-tabnav__item--active' : '',
              tab.soon ? 'rpt-tabnav__item--soon' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => !tab.soon && setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.soon && <span className="rpt-tabnav__badge">Sắp ra mắt</span>}
          </button>
        ))}
      </div>

      {activeTab === 'overview'  && <OverviewTab />}
      {activeTab === 'financial' && <FinancialTab />}
      {activeTab === 'staff'     && <StaffTab />}
      {activeTab === 'heatmap'   && <HeatmapTab />}
      {activeTab === 'quality'   && <QualityTab />}
      {activeTab === 'sla'       && <SlaTab />}
      {activeTab === 'backlog'   && <BacklogTab />}
      {activeTab === 'doc-trend' && <DocTrendTab />}
      {activeTab === 'audit'  && <AuditTab />}
      {activeTab === 'export' && <ExportTab />}
    </div>
  )
}
