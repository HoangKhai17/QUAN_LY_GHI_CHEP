import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SummaryCards from '../../components/dashboard/SummaryCards'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import useDashboardSummary from '../../hooks/useDashboardSummary'
import useRecordsQuery from '../../hooks/useRecordsQuery'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getReportsSummary } from '../../services/dashboard.service'
import './Dashboard.css'

const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

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

const DOC_TYPE_COLORS = [
  '#1f7a43', '#2563eb', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
]

function buildLast14Days() {
  const to = new Date()
  const from = new Date(+to - 13 * 86400_000)
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to:   to.toISOString().slice(0, 10),
  }
}

function fillTimeline(tlRows) {
  const map = Object.fromEntries((tlRows ?? []).map(r => [r.date, Number(r.count) || 0]))
  const result = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    result.push({ key, label: WEEK_LABELS[(dow + 6) % 7], count: map[key] ?? 0 })
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

function rowCount(rows, key, value) {
  const row = (rows ?? []).find(r => r[key] === value)
  return Number(row?.count) || 0
}

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform || 'Không rõ'
}

function extractionLabel(status) {
  if (status === 'failed') return 'Trích xuất lỗi'
  if (status === 'needs_review') return 'Cần rà soát dữ liệu'
  if (status === 'pending') return 'Đang trích xuất'
  return 'Cần kiểm tra'
}

function QueueItem({ record, kind, onClick }) {
  const title = record.note || record.document_type_name || '(không có ghi chú)'
  const metaParts = [
    record.sender_name || 'Không rõ người gửi',
    platformLabel(record.platform),
    fmtTime(record.received_at),
  ]

  return (
    <button className={`dashQueueItem dashQueueItem--${kind}`} onClick={onClick}>
      <div className="img-ph dashQueueItem__thumb">IMG</div>
      <div className="dashQueueItem__body">
        <div className="dashQueueItem__title">{title}</div>
        <div className="dashQueueItem__meta">
          {metaParts.join(' · ')}
          {record.document_type_name && (
            <>
              {' · '}
              <span className="docTypePill">{record.document_type_name}</span>
            </>
          )}
        </div>
      </div>
      {kind === 'issue' ? (
        <span className="dashIssueBadge">{extractionLabel(record.extraction_status)}</span>
      ) : (
        <StatusBadge status={record.status} />
      )}
    </button>
  )
}

function EmptyQueue({ children }) {
  return <div className="dashQueueEmpty">{children}</div>
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { summary, loading: loadingSummary, error: summaryErr, refetch: refetchSummary } = useDashboardSummary(30_000)

  const [chartDays,  setChartDays]  = useState([])
  const [byPlatform, setByPlatform] = useState([])
  const [byDocType,  setByDocType]  = useState([])
  const [byStatus,   setByStatus]   = useState([])
  const [byCategory, setByCategory] = useState([])

  useEffect(() => {
    getReportsSummary(buildLast14Days()).then(data => {
      setChartDays(fillTimeline(data.timeline))
      setByPlatform(data.by_platform ?? [])
      setByDocType((data.by_document_type ?? []).slice(0, 5))
      setByStatus(data.by_status ?? [])
      setByCategory((data.by_category ?? []).slice(0, 5))
    }).catch(() => {
      setChartDays(fillTimeline([]))
      setByPlatform([])
      setByDocType([])
      setByStatus([])
      setByCategory([])
    })
  }, [])

  const pendingQuery = useRecordsQuery({ status: 'new', sort_order: 'asc' }, 4)
  const flaggedQuery = useRecordsQuery({ status: 'flagged', sort_order: 'asc' }, 3)
  const failedQuery  = useRecordsQuery({ extraction_status: 'failed', sort_order: 'asc' }, 2)
  const reviewQuery  = useRecordsQuery({ extraction_status: 'needs_review', sort_order: 'asc' }, 2)

  const issueRecords = [...failedQuery.records, ...reviewQuery.records].slice(0, 4)
  const loadingIssues = failedQuery.loading || reviewQuery.loading

  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  function openDetail(record) {
    openById(record.id)
    setDetailOpen(true)
  }

  function refetchAll() {
    refetchSummary()
    pendingQuery.refetch()
    flaggedQuery.refetch()
    failedQuery.refetch()
    reviewQuery.refetch()
  }

  const chartMax = Math.max(...chartDays.map(d => d.count), 1)
  const total14Days = chartDays.reduce((s, d) => s + d.count, 0)
  const totalPlatform = byPlatform.reduce((s, r) => s + Number(r.count || 0), 0)
  const totalStatus = byStatus.reduce((s, r) => s + Number(r.count || 0), 0)
  const maxDocType = Math.max(...byDocType.map(r => Number(r.count) || 0), 1)
  const maxCategory = Math.max(...byCategory.map(r => Number(r.count) || 0), 1)
  const pendingTotal = summary?.pending_review ?? Number(pendingQuery.total || 0)
  const flaggedTotal = summary?.total_flagged ?? Number(flaggedQuery.total || 0)
  const issueTotal = Number(failedQuery.total || 0) + Number(reviewQuery.total || 0)
  const weekApprovalPct = summary?.this_week?.total
    ? pct(summary.this_week.approved, summary.this_week.total)
    : 0

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
          <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records?status=new')}>
            Bắt đầu rà soát →
          </button>
          <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records')}>
            Xem tất cả record →
          </button>
        </div>
      </div>

      <SummaryCards summary={summary} loading={loadingSummary} />

      <div className="dashMainGrid">
        <div className="bbo-card dashChartCard">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Sức tải tiếp nhận</div>
              <div className="dashCardSub">14 ngày gần nhất · {total14Days.toLocaleString('vi-VN')} record</div>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashChart">
              <div className="dashChart__bars">
                {(chartDays.length > 0 ? chartDays : fillTimeline([])).map((d, i) => {
                  const isToday = i === 13
                  const height = Math.max(8, Math.round((d.count / chartMax) * 164))
                  return (
                    <div key={d.key} className="dashChart__col" title={`${d.key}: ${d.count} record`}>
                      <div className="dashChart__value">{d.count > 0 ? d.count : ''}</div>
                      <div
                        className={`dashChart__bar${isToday ? ' dashChart__bar--primary' : ''}`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="dashChart__labels">
                {(chartDays.length > 0 ? chartDays : fillTimeline([])).map(d => (
                  <div key={d.key}>{d.label}</div>
                ))}
              </div>
            </div>

            <div className="dashMetricStrip">
              {['telegram', 'zalo', 'manual'].map(platform => {
                const count = rowCount(byPlatform, 'platform', platform)
                return (
                  <div key={platform} className="dashMetricStrip__item">
                    <span className="dashMetricStrip__label">{platformLabel(platform)}</span>
                    <span className="dashMetricStrip__value">{pct(count, totalPlatform)}%</span>
                    <span className="dashMetricStrip__sub">{count.toLocaleString('vi-VN')} record</span>
                  </div>
                )
              })}
              <div className="dashMetricStrip__item">
                <span className="dashMetricStrip__label">Duyệt tuần này</span>
                <span className="dashMetricStrip__value dashMetricStrip__value--accent">{weekApprovalPct}%</span>
                <span className="dashMetricStrip__sub">{summary?.this_week?.approved ?? 0}/{summary?.this_week?.total ?? 0} record</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bbo-card dashWorkCard">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Việc cần xử lý</div>
              <div className="dashCardSub">Ưu tiên record cũ nhất và lỗi trích xuất</div>
            </div>
            <a href="/app/records?status=new" className="dashPendingLink"
               onClick={e => { e.preventDefault(); navigate('/app/records?status=new') }}>
              Xem hàng chờ →
            </a>
          </div>
          <div className="bbo-card-body dashQueue">
            <div className="dashQueueSection">
              <div className="dashQueueSection__head">
                <span>Chờ rà soát</span>
                <strong>{pendingTotal}</strong>
              </div>
              {pendingQuery.loading && [1, 2].map(i => <div key={i} className="dashQueueSkeleton skeleton" />)}
              {!pendingQuery.loading && pendingQuery.records.map(r => (
                <QueueItem key={r.id} record={r} kind="pending" onClick={() => openDetail(r)} />
              ))}
              {!pendingQuery.loading && pendingQuery.records.length === 0 && (
                <EmptyQueue>Không có record chờ rà soát</EmptyQueue>
              )}
            </div>

            <div className="dashQueueSection">
              <div className="dashQueueSection__head">
                <span>Bị flag</span>
                <strong>{flaggedTotal}</strong>
              </div>
              {flaggedQuery.loading && <div className="dashQueueSkeleton skeleton" />}
              {!flaggedQuery.loading && flaggedQuery.records.map(r => (
                <QueueItem key={r.id} record={r} kind="flagged" onClick={() => openDetail(r)} />
              ))}
              {!flaggedQuery.loading && flaggedQuery.records.length === 0 && (
                <EmptyQueue>Không có record bị flag</EmptyQueue>
              )}
            </div>

            <div className="dashQueueSection">
              <div className="dashQueueSection__head">
                <span>Lỗi trích xuất</span>
                <strong>{issueTotal}</strong>
              </div>
              {loadingIssues && <div className="dashQueueSkeleton skeleton" />}
              {!loadingIssues && issueRecords.map(r => (
                <QueueItem key={r.id} record={r} kind="issue" onClick={() => openDetail(r)} />
              ))}
              {!loadingIssues && issueRecords.length === 0 && (
                <EmptyQueue>Không có lỗi trích xuất cần xử lý</EmptyQueue>
              )}
            </div>

            <button
              className="bbo-btn bbo-btn-md bbo-btn-primary bbo-btn-full"
              onClick={() => navigate('/app/records?status=new')}
            >
              Bắt đầu rà soát nhanh →
            </button>
          </div>
        </div>
      </div>

      <div className="dashInsightGrid">
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div>
              <div className="bbo-card-title">Pipeline trạng thái</div>
              <div className="dashCardSub">Tỷ lệ record trong 14 ngày gần nhất</div>
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

      <RecordDetailDrawer
        open={detailOpen}
        record={detailRec}
        loading={loadingDetail}
        onClose={() => { setDetailOpen(false); closeDetail() }}
        onStatusChange={refetchAll}
        onDelete={() => {
          setDetailOpen(false)
          closeDetail()
          refetchAll()
        }}
      />
    </div>
  )
}
