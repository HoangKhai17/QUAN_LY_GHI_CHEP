import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RecordList from '../../components/records/RecordList'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import PlatformBadge from '../../components/records/PlatformBadge'
import useRecordsQuery from '../../hooks/useRecordsQuery'
import useRecordDetail from '../../hooks/useRecordDetail'
import { useState } from 'react'
import './Records.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'new',      label: 'Mới' },
  { value: 'reviewed', label: 'Đang rà' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'flagged',  label: 'Flagged' },
]

const PLATFORM_OPTIONS = [
  { value: '', label: 'Tất cả kênh' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'zalo',     label: 'Zalo' },
]

export default function RecordsPage() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()

  const {
    records, total, page, filters, loading,
    updateFilters, setPage,
    updateRecord, removeRecord,
  } = useRecordsQuery(
    { status: searchParams.get('status') ?? '' },
    20,
  )

  // Sync URL ?status= param into filters on mount
  useEffect(() => {
    const s = searchParams.get('status')
    if (s) updateFilters({ status: s })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  const [search, setSearch] = useState('')

  function openDetail(record) {
    openById(record.id)
    setDetailOpen(true)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    updateFilters({ search: search.trim() })
  }

  function handleStatusFilter(val) {
    updateFilters({ status: val })
  }

  function handlePlatformFilter(val) {
    updateFilters({ platform: val })
  }

  return (
    <div className="recPage">
      {/* ── Toolbar ── */}
      <div className="recToolbar">
        <div>
          <div className="recToolbar__title">Danh sách Record</div>
          <div className="recToolbar__sub">
            {total > 0 ? `${total} record` : 'Đang tải…'}
            {filters.status ? ` · lọc: ${STATUS_OPTIONS.find(o => o.value === filters.status)?.label}` : ''}
          </div>
        </div>
        <div className="recToolbar__actions">
          <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/dashboard')}>
            ← Dashboard
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="recFilters bbo-card" style={{ padding: '14px 18px' }}>
        <div className="recFilters__row">
          {/* Search */}
          <form className="recSearch" onSubmit={handleSearchSubmit}>
            <input
              className="recSearch__input"
              type="text"
              placeholder="Tìm theo ghi chú, mã, người gửi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="bbo-btn bbo-btn-sm bbo-btn-primary">Tìm</button>
            {(search || filters.search) && (
              <button
                type="button"
                className="bbo-btn bbo-btn-sm"
                onClick={() => { setSearch(''); updateFilters({ search: '' }) }}
              >✕</button>
            )}
          </form>

          <div className="recFilters__divider" />

          {/* Status chips */}
          <div className="recFilters__chips">
            {STATUS_OPTIONS.map(o => (
              <span
                key={o.value}
                className={`filter-chip${filters.status === o.value ? ' filter-chip--active' : ''}`}
                onClick={() => handleStatusFilter(o.value)}
              >{o.label}</span>
            ))}
          </div>

          <div className="recFilters__divider" />

          {/* Platform chips */}
          <div className="recFilters__chips">
            {PLATFORM_OPTIONS.map(o => (
              <span
                key={o.value}
                className={`filter-chip${filters.platform === o.value ? ' filter-chip--active' : ''}`}
                onClick={() => handlePlatformFilter(o.value)}
              >{o.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Record list ── */}
      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <RecordList
          records={records}
          total={total}
          page={page}
          loading={loading}
          pageSize={20}
          onPageChange={setPage}
          onRowClick={openDetail}
          onRecordUpdate={updateRecord}
          onRecordRemove={removeRecord}
        />
      </div>

      {/* ── Detail drawer ── */}
      <RecordDetailDrawer
        open={detailOpen}
        record={detailRec}
        loading={loadingDetail}
        onClose={() => { setDetailOpen(false); closeDetail() }}
        onStatusChange={(id, patch) => updateRecord(id, patch)}
        onDelete={id => {
          removeRecord(id)
          setDetailOpen(false)
          closeDetail()
        }}
      />
    </div>
  )
}
