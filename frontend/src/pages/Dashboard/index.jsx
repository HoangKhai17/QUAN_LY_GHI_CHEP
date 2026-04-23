import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SummaryCards from '../../components/dashboard/SummaryCards'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import PlatformBadge from '../../components/records/PlatformBadge'
import FlagDialog from '../../components/records/FlagDialog'
import useDashboardSummary from '../../hooks/useDashboardSummary'
import useRecordsQuery from '../../hooks/useRecordsQuery'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getMockActivityChart } from '../../services/dashboard.service'
import { updateRecordStatus } from '../../services/record.service'
import { message } from 'antd'
import './Dashboard.css'

const CHART_BARS = getMockActivityChart()
const CHART_MAX  = Math.max(...CHART_BARS)
const CHART_DAYS = ['T2','T3','T4','T5','T6','T7','CN','T2','T3','T4','T5','T6','T7','CN']

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { summary, loading: loadingSummary, error: summaryErr, refetch: refetchSummary } = useDashboardSummary(30_000)

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
            <div className="dash-chart-filters">
              <span className="dash-filter-chip dash-filter-chip--active">Tất cả kênh</span>
              <span className="dash-filter-chip dash-filter-chip--muted">Telegram</span>
              <span className="dash-filter-chip dash-filter-chip--muted">Zalo</span>
            </div>
          </div>
          <div className="bbo-card-body">
            <div className="dashChart">
              <div className="dashChart__bars">
                {CHART_BARS.map((v, i) => {
                  const isLast = i === CHART_BARS.length - 1
                  const isPrev = i === CHART_BARS.length - 2
                  return (
                    <div key={i} className="dashChart__col">
                      <div
                        className={`dashChart__bar${isLast ? ' dashChart__bar--primary' : isPrev ? ' dashChart__bar--lime' : ''}`}
                        style={{ height: `${Math.round((v / CHART_MAX) * 140)}px` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="dashChart__labels">
                {CHART_DAYS.map((d, i) => <div key={i}>{d}</div>)}
              </div>
            </div>
            <div className="dashChart__summary">
              <div>
                <div className="dashChart__summary-label">Telegram</div>
                <div className="dashChart__summary-value">68%</div>
              </div>
              <div>
                <div className="dashChart__summary-label">Zalo</div>
                <div className="dashChart__summary-value">32%</div>
              </div>
              <div>
                <div className="dashChart__summary-label">Peak giờ</div>
                <div className="dashChart__summary-value">14:00</div>
              </div>
              <div>
                <div className="dashChart__summary-label">Tỷ lệ duyệt</div>
                <div className="dashChart__summary-value dashChart__summary-value--accent">
                  {summary ? `${Math.round(((summary.today?.approved ?? 0) / Math.max(summary.today?.total ?? 1, 1)) * 100)}%` : '—'}
                </div>
              </div>
            </div>
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
                  <div className="pending-item__title">{r.note || '(không có ghi chú)'}</div>
                  <div className="pending-item__meta">
                    {r.sender_name} · {r.platform} · {fmtTime(r.received_at)}
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
              onClick={() => navigate('/app/quick-review')}
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
            <span className="tbl-filter-tab tbl-filter-tab--active">Tất cả</span>
            <span className="tbl-filter-tab">Telegram</span>
            <span className="tbl-filter-tab">Zalo</span>
            <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/records')}>
              Xem đầy đủ →
            </button>
          </div>
        </div>

        {/* Mini table — simpler columns */}
        <div className="rec-table-wrap">
          <div className="rec-table-head dashTableGrid">
            <div />
            <div>Mã record</div>
            <div>Ghi chú</div>
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
              <div className="rec-table__note">{r.note || '(không có ghi chú)'}</div>
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
              Chưa có record nào hôm nay
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
