import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SummaryCards from '../../components/dashboard/SummaryCards'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import PlatformBadge from '../../components/records/PlatformBadge'
import FlagDialog from '../../components/records/FlagDialog'
import useDashboardSummary from '../../hooks/useDashboardSummary'
import useRecordsQuery from '../../hooks/useRecordsQuery'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getReportsSummary } from '../../services/dashboard.service'
import { updateRecordStatus } from '../../services/record.service'
import { message } from 'antd'
import './Dashboard.css'

const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function buildLast14Days() {
  const to = new Date()
  const from = new Date(+to - 13 * 86400_000)
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to:   to.toISOString().slice(0, 10),
  }
}

function fillTimeline(tlRows) {
  const map = Object.fromEntries((tlRows ?? []).map(r => [r.date, r.count]))
  const result = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dow = d.getDay() // 0=Sun…6=Sat
    result.push({ key, label: WEEK_LABELS[(dow + 6) % 7], count: map[key] ?? 0 })
  }
  return result
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'
}

const DOC_TYPE_COLORS = [
  '#1f7a43', '#2563eb', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { summary, loading: loadingSummary, error: summaryErr, refetch: refetchSummary } = useDashboardSummary(30_000)

  // Chart / reports state
  const [chartDays,    setChartDays]    = useState([])
  const [byPlatform,   setByPlatform]   = useState([])
  const [byDocType,    setByDocType]    = useState([])

  useEffect(() => {
    getReportsSummary(buildLast14Days()).then(data => {
      setChartDays(fillTimeline(data.timeline))
      setByPlatform(data.by_platform ?? [])
      setByDocType((data.by_document_type ?? []).slice(0, 5))
    }).catch(() => {
      // fallback: empty chart (no mock)
      setChartDays(fillTimeline([]))
    })
  }, [])

  const chartMax = Math.max(...chartDays.map(d => d.count), 1)

  // Pending panel — status=new, limit 4
  const { records: pendingRecs, loading: loadingPending } = useRecordsQuery({ status: 'new' }, 4)

  // Recent records table — all, limit 6
  const {
    records, loading: loadingRecords,
    updateRecord, removeRecord,
  } = useRecordsQuery({}, 6)

  // Detail drawer
  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  // Flag quick-action on pending panel
  const [flagOpen,    setFlagOpen]    = useState(false)
  const [flagTarget,  setFlagTarget]  = useState(null)
  const [flagLoading, setFlagLoading] = useState(false)

  async function handleFlagConfirm(reason) {
    setFlagLoading(true)
    try {
      await updateRecordStatus(flagTarget.id, 'flagged', reason)
      updateRecord(flagTarget.id, { status: 'flagged', flag_reason: reason })
      message.success('Đã gắn cờ')
      setFlagOpen(false)
      setFlagTarget(null)
    } catch {
      message.error('Gắn cờ thất bại')
    } finally {
      setFlagLoading(false)
    }
  }

  function openDetail(record) {
    openById(record.id)
    setDetailOpen(true)
  }

  // Platform percentage helper
  const totalPlatform = byPlatform.reduce((s, r) => s + Number(r.count), 0)
  function platformPct(name) {
    const row = byPlatform.find(r => r.platform === name)
    if (!row || !totalPlatform) return '—'
    return `${Math.round((Number(row.count) / totalPlatform) * 100)}%`
  }

  return (
    <div className="dashPage">
      {/* ── Toolbar ── */}
      <div className="dashToolbar">
        <div>
          <div className="dashToolbar__title">Tổng quan</div>
          <div className="dashToolbar__sub">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            {summaryErr ? ' · ⚠ Không tải được dữ liệu' : ''}
          </div>
        </div>
        <div className="dashToolbar__actions">
          {summaryErr && (
            <button className="bbo-btn bbo-btn-sm" onClick={refetchSummary}>↻ Thử lại</button>
          )}
          <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records')}>
            Xem tất cả record →
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <SummaryCards summary={summary} loading={loadingSummary} />

      {/* ── Two-panel row ── */}
      <div className="dashPanels">
        {/* Activity chart */}
        <div className="bbo-card dashChartCard">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Hoạt động tiếp nhận (14 ngày)</div>
          </div>
          <div className="bbo-card-body">
            <div className="dashChart">
              <div className="dashChart__bars">
                {chartDays.length === 0
                  ? Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="dashChart__col">
                        <div className="dashChart__bar" style={{ height: '4px' }} />
                      </div>
                    ))
                  : chartDays.map((d, i) => {
                      const isLast = i === chartDays.length - 1
                      const isPrev = i === chartDays.length - 2
                      return (
                        <div key={d.key} className="dashChart__col" title={`${d.key}: ${d.count} record`}>
                          <div
                            className={`dashChart__bar${isLast ? ' dashChart__bar--primary' : isPrev ? ' dashChart__bar--lime' : ''}`}
                            style={{ height: `${Math.max(4, Math.round((d.count / chartMax) * 210))}px` }}
                          />
                        </div>
                      )
                    })
                }
              </div>
              <div className="dashChart__labels">
                {(chartDays.length > 0 ? chartDays : Array.from({ length: 14 }, (_, i) => ({ label: WEEK_LABELS[i % 7] }))).map((d, i) => (
                  <div key={i}>{d.label}</div>
                ))}
              </div>
            </div>

            <div className="dashChart__summary">
              <div>
                <div className="dashChart__summary-label">Telegram</div>
                <div className="dashChart__summary-value">{platformPct('telegram')}</div>
              </div>
              <div>
                <div className="dashChart__summary-label">Zalo</div>
                <div className="dashChart__summary-value">{platformPct('zalo')}</div>
              </div>
              <div>
                <div className="dashChart__summary-label">Tổng 14 ngày</div>
                <div className="dashChart__summary-value">
                  {chartDays.reduce((s, d) => s + d.count, 0)}
                </div>
              </div>
              <div>
                <div className="dashChart__summary-label">Tỷ lệ duyệt</div>
                <div className="dashChart__summary-value dashChart__summary-value--accent">
                  {summary ? `${Math.round(((summary.today?.approved ?? 0) / Math.max(summary.today?.total ?? 1, 1)) * 100)}%` : '—'}
                </div>
              </div>
            </div>

            {/* Document type breakdown */}
            {byDocType.length > 0 && (
              <div className="dashDocTypes">
                <div className="dashDocTypes__title">Theo loại tài liệu (14 ngày)</div>
                <div className="dashDocTypes__list">
                  {byDocType.map((dt, i) => (
                    <div key={dt.code} className="dashDocTypes__item">
                      <span className="dashDocTypes__dot" style={{ background: DOC_TYPE_COLORS[i % DOC_TYPE_COLORS.length] }} />
                      <span className="dashDocTypes__name">{dt.name || dt.code}</span>
                      <span className="dashDocTypes__count">{dt.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending panel */}
        <div className="bbo-card">
          <div className="bbo-card-header">
            <div className="bbo-card-title">Chờ rà soát</div>
            <a href="/app/records?status=new" className="dashPendingLink"
               onClick={e => { e.preventDefault(); navigate('/app/records?status=new') }}>
              Xem tất cả →
            </a>
          </div>
          <div className="bbo-card-body">
            <div className="dashPendingSummary">
              {loadingSummary ? '…' : `${summary?.pending_review ?? '—'} record chờ xử lý · ưu tiên cao nhất`}
            </div>

            {loadingPending && [1, 2, 3].map(i => (
              <div key={i} className="pending-item">
                <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '70%', height: 13, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '50%', height: 11 }} />
                </div>
              </div>
            ))}

            {!loadingPending && pendingRecs.slice(0, 4).map(r => (
              <div key={r.id} className="pending-item" style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                <div className="img-ph pending-item__thumb">IMG</div>
                <div className="pending-item__body">
                  <div className="pending-item__title">{r.note || r.document_type_name || '(không có ghi chú)'}</div>
                  <div className="pending-item__meta">
                    {r.sender_name} · {r.platform} · {fmtTime(r.received_at)}
                    {r.document_type_name && <> · <span className="docTypePill">{r.document_type_name}</span></>}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}

            {!loadingPending && pendingRecs.length === 0 && (
              <div className="dashPendingEmpty">✅ Đã xử lý hết — không có record chờ</div>
            )}

            <button
              className="bbo-btn bbo-btn-md bbo-btn-primary bbo-btn-full"
              style={{ marginTop: 12 }}
              onClick={() => navigate('/app/records?status=new')}
            >
              Bắt đầu rà soát nhanh →
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent records table ── */}
      <div className="bbo-card">
        <div className="bbo-card-header">
          <div className="bbo-card-title">Record mới nhất</div>
          <div className="dashTableToolbar">
            <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records')}>
              Xem đầy đủ →
            </button>
          </div>
        </div>

        <div className="rec-table-wrap">
          <div className="rec-table-head dashTableGrid">
            <div />
            <div>Mã record</div>
            <div>Ghi chú / Loại tài liệu</div>
            <div>Người gửi</div>
            <div>Nền tảng</div>
            <div>Thời gian</div>
            <div>Trạng thái</div>
            <div />
          </div>

          {loadingRecords && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rec-table-row dashTableGrid">
              <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 72, height: 13 }} />
              <div className="skeleton" style={{ width: '80%', height: 13 }} />
              <div className="skeleton" style={{ width: 90, height: 13 }} />
              <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 48, height: 13 }} />
              <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 999 }} />
              <div />
            </div>
          ))}

          {!loadingRecords && records.map(r => (
            <div key={r.id} className="rec-table-row dashTableGrid" onClick={() => openDetail(r)}>
              <div className="img-ph rec-table__thumb">IMG</div>
              <div className="rec-table__code">{r.code ?? r.id?.slice(-6)?.toUpperCase()}</div>
              <div className="recListNoteCell">
                <div className="rec-table__note">{r.note || r.document_type_name || '(không có ghi chú)'}</div>
                {r.document_type_name && (
                  <div className="recListSub">{r.document_type_name}
                    {r.extraction_status === 'needs_review' && <span className="exSt exSt--warn"> · Cần rà soát</span>}
                    {r.extraction_status === 'failed' && <span className="exSt exSt--err"> · Trích xuất lỗi</span>}
                  </div>
                )}
              </div>
              <div className="rec-table__sender">
                <div className="avatar-sm">{initials(r.sender_name)}</div>
                <span className="rec-table__sender-name">{r.sender_name ?? '—'}</span>
              </div>
              <div><PlatformBadge platform={r.platform} /></div>
              <div className="rec-table__time">{fmtTime(r.received_at)}</div>
              <div><StatusBadge status={r.status} /></div>
              <div className="rec-table__more">⋯</div>
            </div>
          ))}

          {!loadingRecords && records.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
              Chưa có record nào — gửi ảnh qua Telegram/Zalo để bắt đầu
            </div>
          )}

          <div className="dashTableFoot">
            <span>Hiển thị {records.length} record gần nhất</span>
            <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records')}>
              Xem tất cả →
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 28 }} />

      {/* Detail drawer */}
      <RecordDetailDrawer
        open={detailOpen}
        record={detailRec}
        loading={loadingDetail}
        onClose={() => { setDetailOpen(false); closeDetail() }}
        onStatusChange={(id, patch) => {
          updateRecord(id, patch)
          refetchSummary()
        }}
        onDelete={id => {
          removeRecord(id)
          setDetailOpen(false)
          closeDetail()
          refetchSummary()
        }}
      />

      {/* Flag dialog for pending panel quick-action */}
      <FlagDialog
        open={flagOpen}
        loading={flagLoading}
        onCancel={() => { setFlagOpen(false); setFlagTarget(null) }}
        onConfirm={handleFlagConfirm}
      />
    </div>
  )
}
