import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import PlatformBadge from '../../components/records/PlatformBadge'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getDocumentTypes } from '../../services/record.service'
import api from '../../services/api'
import './DocTypeView.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatValue(dataType, value, unit) {
  if (value == null) return '—'
  if (dataType === 'money' || dataType === 'number') {
    const n = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(n)) return String(value)
    return n.toLocaleString('vi-VN') + (unit ? ` ${unit}` : '')
  }
  if (dataType === 'date') {
    const s = String(value)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-')
      return `${d}/${m}/${y}`
    }
    return s
  }
  if (dataType === 'boolean') return value ? 'Có' : 'Không'
  return String(value)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initials(name) {
  return (name ?? '').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'
}

// Op labels per data type
function getOps(dataType) {
  if (dataType === 'money' || dataType === 'number') {
    return [
      { op: 'gte', label: '≥ (ít nhất)' },
      { op: 'lte', label: '≤ (tối đa)' },
      { op: 'eq',  label: '= (bằng)' },
    ]
  }
  if (dataType === 'date') {
    return [
      { op: 'from', label: 'Từ ngày' },
      { op: 'to',   label: 'Đến ngày' },
    ]
  }
  return [
    { op: 'like', label: 'Chứa' },
    { op: 'eq',   label: 'Bằng' },
  ]
}

const LIMIT = 20

// ── Main component ─────────────────────────────────────────────────────────────

export default function DocTypeViewPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [docTypes,     setDocTypes]     = useState([])
  const [selectedCode, setSelectedCode] = useState(searchParams.get('type') || '')
  const [fieldDefs,    setFieldDefs]    = useState([])

  const [records,  setRecords]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)

  // filters: { [field_key]: { op, value } }
  const [filters,       setFilters]       = useState({})
  const [pendingFilters, setPendingFilters] = useState({})

  // detail drawer
  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  const selectedType = docTypes.find(t => t.code === selectedCode)

  // ── Load all document types ──
  useEffect(() => {
    getDocumentTypes().then(res => {
      const types = (res?.data ?? []).filter(t => t.is_active !== false)
      setDocTypes(types)
      if (!selectedCode && types.length > 0) {
        setSelectedCode(types[0].code)
      }
    })
  }, [])

  // ── When selected type changes: load field definitions, reset ──
  useEffect(() => {
    if (!selectedCode) return
    setSearchParams({ type: selectedCode }, { replace: true })
    setFieldDefs([])
    setFilters({})
    setPendingFilters({})
    setPage(1)
    setRecords([])

    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return

    api.get(`/api/document-types/${type.id}`).then(res => {
      setFieldDefs(res.data.fields ?? [])
    }).catch(() => {})
  }, [selectedCode, docTypes])

  // ── Fetch records ──
  const fetchRecords = useCallback(async (pg, activeFilters) => {
    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return
    setLoading(true)
    try {
      // Build flat params with bracket-notation keys for fv filters
      const params = {
        document_type_id:     type.id,
        include_field_values: 'true',
        page:                 pg,
        limit:                LIMIT,
      }
      for (const [fieldKey, { op, value }] of Object.entries(activeFilters)) {
        if (value !== '' && value != null) {
          params[`fv[${fieldKey}][${op}]`] = value
        }
      }
      const { data } = await api.get('/api/records', { params })
      setRecords(data.data ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [selectedCode, docTypes])

  // Re-fetch when page or committed filters change
  useEffect(() => {
    if (selectedCode && docTypes.length > 0 && fieldDefs !== undefined) {
      fetchRecords(page, filters)
    }
  }, [fetchRecords, page, filters, fieldDefs])

  function applyFilters() {
    setFilters(pendingFilters)
    setPage(1)
  }

  function clearFilters() {
    setPendingFilters({})
    setFilters({})
    setPage(1)
  }

  function openDetail(r) {
    openById(r.id)
    setDetailOpen(true)
  }

  // Filterable fields (show in filter bar)
  const filterableDefs = fieldDefs.filter(f => f.is_filterable)
  // Display columns in pivot table (max 6 to avoid overflow)
  const displayCols = fieldDefs.slice(0, 6)

  const totalPages = Math.ceil(total / LIMIT)
  const hasActiveFilters = Object.values(filters).some(f => f.value !== '' && f.value != null)

  // Dynamic grid template
  const gridCols = [
    '96px',                                   // Mã
    '130px',                                  // Người gửi
    ...displayCols.map(() => 'minmax(100px, 1fr)'), // field columns
    '90px',                                   // Kênh
    '86px',                                   // Ngày
    '90px',                                   // Trạng thái
  ].join(' ')

  return (
    <div className="dtv-page">
      {/* ── Header ── */}
      <div className="dtv-toolbar">
        <div>
          <div className="dtv-toolbar__title">Xem theo loại tài liệu</div>
          <div className="dtv-toolbar__sub">
            {selectedType?.name}
            {total > 0 && ` · ${total} record`}
            {hasActiveFilters && <span className="dtv-filter-active-badge"> · đang lọc</span>}
          </div>
        </div>
      </div>

      {/* ── Type tabs ── */}
      <div className="bbo-card dtv-tabs-card">
        {docTypes.length === 0 && (
          <div className="dtv-tabs-empty">Đang tải loại tài liệu…</div>
        )}
        <div className="dtv-tabs">
          {docTypes.map(dt => (
            <button
              key={dt.code}
              className={`dtv-tab${selectedCode === dt.code ? ' dtv-tab--active' : ''}`}
              onClick={() => { if (selectedCode !== dt.code) setSelectedCode(dt.code) }}
            >
              {dt.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      {filterableDefs.length > 0 && (
        <div className="bbo-card dtv-filters">
          <div className="dtv-filters__header">
            <span className="dtv-filters__title">Bộ lọc trường dữ liệu</span>
            {hasActiveFilters && (
              <span className="dtv-filter-active-badge">
                {Object.values(filters).filter(f => f.value).length} bộ lọc đang bật
              </span>
            )}
          </div>
          <div className="dtv-filters__grid">
            {filterableDefs.map(f => {
              const ops = getOps(f.data_type)
              const current = pendingFilters[f.field_key] || { op: ops[0].op, value: '' }
              const inputType = (f.data_type === 'money' || f.data_type === 'number')
                ? 'number'
                : f.data_type === 'date'
                  ? 'date'
                  : 'text'

              return (
                <div key={f.field_key} className="dtv-filter-item">
                  <div className="dtv-filter-item__label">
                    {f.label}
                    {f.unit && <span className="dtv-filter-item__unit"> ({f.unit})</span>}
                  </div>
                  <div className="dtv-filter-item__row">
                    {ops.length > 1 && (
                      <select
                        className="dtv-filter-op"
                        value={current.op}
                        onChange={e => setPendingFilters(prev => ({
                          ...prev,
                          [f.field_key]: { ...current, op: e.target.value },
                        }))}
                      >
                        {ops.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                      </select>
                    )}
                    <input
                      className="dtv-filter-input"
                      type={inputType}
                      placeholder={ops.length === 1 ? ops[0].label : 'Giá trị…'}
                      value={current.value}
                      onChange={e => setPendingFilters(prev => ({
                        ...prev,
                        [f.field_key]: { op: current.op, value: e.target.value },
                      }))}
                      onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    />
                    {current.value && (
                      <button
                        className="dtv-filter-clear-btn"
                        onClick={() => setPendingFilters(prev => {
                          const n = { ...prev }
                          delete n[f.field_key]
                          return n
                        })}
                      >✕</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="dtv-filters__actions">
            <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={applyFilters}>
              Áp dụng bộ lọc
            </button>
            {hasActiveFilters && (
              <button className="bbo-btn bbo-btn-sm" onClick={clearFilters}>
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Pivot table ── */}
      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <div className="rec-table-wrap">
          {/* Header row */}
          <div className="rec-table-head dtv-pivot-row" style={{ gridTemplateColumns: gridCols }}>
            <div>Mã record</div>
            <div>Người gửi</div>
            {displayCols.map(f => (
              <div key={f.field_key} className={f.data_type === 'money' || f.data_type === 'number' ? 'dtv-col--num' : ''}>
                {f.label}
                {f.unit && <span className="dtv-col-unit"> ({f.unit})</span>}
              </div>
            ))}
            <div>Kênh</div>
            <div>Ngày</div>
            <div>Trạng thái</div>
          </div>

          {/* Skeleton */}
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rec-table-row dtv-pivot-row" style={{ gridTemplateColumns: gridCols }}>
              <div className="skeleton" style={{ width: 72, height: 14 }} />
              <div className="skeleton" style={{ width: 90, height: 14 }} />
              {displayCols.map(f => (
                <div key={f.field_key} className="skeleton" style={{ width: '75%', height: 14 }} />
              ))}
              <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 64, height: 14 }} />
              <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />
            </div>
          ))}

          {/* Empty */}
          {!loading && records.length === 0 && (
            <div className="recListEmpty">
              <div className="recListEmpty__icon">📋</div>
              <div className="recListEmpty__title">
                {hasActiveFilters ? 'Không có record nào khớp bộ lọc' : `Chưa có record loại "${selectedType?.name}"`}
              </div>
              <div className="recListEmpty__sub">
                {hasActiveFilters
                  ? 'Thử xóa bộ lọc hoặc thay đổi điều kiện'
                  : 'Gửi ảnh tài liệu qua Telegram/Zalo để bắt đầu'}
              </div>
              {hasActiveFilters && (
                <button className="bbo-btn bbo-btn-sm" style={{ marginTop: 16 }} onClick={clearFilters}>
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}

          {/* Data rows */}
          {!loading && records.map(r => (
            <div
              key={r.id}
              className="rec-table-row dtv-pivot-row"
              style={{ gridTemplateColumns: gridCols }}
              onClick={() => openDetail(r)}
            >
              <div className="rec-table__code">{r.code ?? r.id?.slice(-6)?.toUpperCase()}</div>
              <div className="rec-table__sender">
                <div className="avatar-sm">{initials(r.sender_name)}</div>
                <span className="rec-table__sender-name">{r.sender_name ?? '—'}</span>
              </div>
              {displayCols.map(f => {
                const fv = r.field_values?.[f.field_key]
                const isNumeric = f.data_type === 'money' || f.data_type === 'number'
                return (
                  <div
                    key={f.field_key}
                    className={`dtv-cell${isNumeric ? ' dtv-cell--num' : ''}`}
                    title={fv ? formatValue(f.data_type, fv.value, '') : ''}
                  >
                    {fv ? formatValue(f.data_type, fv.value, f.unit) : <span className="dtv-cell--empty">—</span>}
                    {fv?.source === 'human' && <span className="dtv-cell-human" title="Đã chỉnh tay">✎</span>}
                  </div>
                )
              })}
              <div><PlatformBadge platform={r.platform} /></div>
              <div className="rec-table__time">{fmtDate(r.received_at)}</div>
              <div><StatusBadge status={r.status} /></div>
            </div>
          ))}

          {/* Pagination */}
          {!loading && total > LIMIT && (
            <div className="recListPagination">
              <span className="recListPagination__info">
                {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} / {total} record
              </span>
              <div className="pager">
                <button className="pager-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page - 2 + i
                  if (p < 1 || p > totalPages) return null
                  return (
                    <button key={p} className={`pager-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  )
                })}
                <button className="pager-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 28 }} />

      {/* Detail drawer */}
      <RecordDetailDrawer
        open={detailOpen}
        record={detailRec}
        loading={loadingDetail}
        onClose={() => { setDetailOpen(false); closeDetail() }}
        onStatusChange={(id, patch) => setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))}
        onDelete={id => {
          setRecords(prev => prev.filter(r => r.id !== id))
          setTotal(prev => Math.max(0, prev - 1))
          setDetailOpen(false)
          closeDetail()
        }}
      />
    </div>
  )
}
