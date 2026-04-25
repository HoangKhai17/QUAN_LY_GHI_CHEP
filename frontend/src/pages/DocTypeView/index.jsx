import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from 'antd'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import StatusBadge from '../../components/records/StatusBadge'
import PlatformBadge from '../../components/records/PlatformBadge'
import FlagDialog from '../../components/records/FlagDialog'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getDocumentTypes, updateRecordStatus, deleteRecord, getRecordStats, getCategories } from '../../services/record.service'
import { getSocket } from '../../services/socket'
import notify from '../../utils/notify'
import api from '../../services/api'
import '../../components/records/RecordList.css'
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

function serializeParams(p) {
  const parts = []
  const enc = v => encodeURIComponent(String(v))
    .replace(/%5B/gi, '[').replace(/%5D/gi, ']')
  function build(key, val) {
    if (val == null) return
    if (typeof val === 'object' && !Array.isArray(val)) {
      Object.keys(val).forEach(k => build(`${key}[${k}]`, val[k]))
    } else {
      parts.push(enc(key) + '=' + enc(val))
    }
  }
  Object.keys(p).forEach(k => build(k, p[k]))
  return parts.join('&')
}

function attachDynamicFilters(params, activeFilters) {
  const fvParam = {}
  for (const [fieldKey, { op, value }] of Object.entries(activeFilters)) {
    if (value !== '' && value != null) {
      fvParam[fieldKey] = fvParam[fieldKey] || {}
      fvParam[fieldKey][op] = value
    }
  }
  if (Object.keys(fvParam).length) params.fv = fvParam
}

const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Static filter constants ────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'new',      label: 'Mới' },
  { value: 'reviewed', label: 'Đang rà soát' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'flagged',  label: 'Flagged' },
]

const PLATFORM_OPTIONS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'zalo',     label: 'Zalo' },
  { value: 'manual',   label: 'Thủ công' },
]

const EMPTY_STATIC = {
  search: '', platform: [], status: [], category_id: [],
  date_from: '', date_to: '', sort_order: 'desc',
}

// ── Multi-select dropdown ──────────────────────────────────────────────────────

function MultiSelectDropdown({ placeholder, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const isAll    = value.length === 0
  const selected = options.filter(o => value.includes(o.value))

  function toggle(val) {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }

  function triggerLabel() {
    if (isAll) return placeholder
    if (selected.length === 1) return selected[0].label
    return `${selected.length} đã chọn`
  }

  return (
    <div className="msd" ref={ref}>
      <button
        type="button"
        className={`msd__trigger${!isAll ? ' msd__trigger--active' : ''}${open ? ' msd__trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="msd__label">{triggerLabel()}</span>
        {!isAll && <span className="msd__count">{selected.length}</span>}
        <svg className="msd__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="msd__panel">
          <div
            className={`msd__option${isAll ? ' msd__option--checked' : ''}`}
            onClick={() => onChange([])}
          >
            <span className="msd__checkbox">{isAll && <span className="msd__tick">✓</span>}</span>
            <span className="msd__option-label">{placeholder}</span>
          </div>
          <div className="msd__divider" />
          {options.map(o => {
            const checked = value.includes(o.value)
            return (
              <div
                key={o.value}
                className={`msd__option${checked ? ' msd__option--checked' : ''}`}
                onClick={() => toggle(o.value)}
              >
                <span className="msd__checkbox">{checked && <span className="msd__tick">✓</span>}</span>
                <span className="msd__option-label">{o.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DocTypeViewPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [docTypes,     setDocTypes]     = useState([])
  const [selectedCode, setSelectedCode] = useState(searchParams.get('type') || '')
  const [fieldDefs,    setFieldDefs]    = useState([])

  const [records,  setRecords]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading,  setLoading]  = useState(false)

  // Dynamic field-value filters
  const [filters,        setFilters]        = useState({})
  const [pendingFilters, setPendingFilters] = useState({})

  // Static standard filters
  const [categories,    setCategories]    = useState([])
  const [staticFilters, setStaticFilters] = useState(EMPTY_STATIC)
  const [staticDraft,   setStaticDraft]   = useState(EMPTY_STATIC)

  // Stats cards
  const [stats, setStats] = useState({ total: 0, new: 0, reviewed: 0, approved: 0, flagged: 0 })
  const [aggregations, setAggregations] = useState([])

  // Column visibility
  const [visibleCols,  setVisibleCols]  = useState(new Set())
  const [colPanelOpen, setColPanelOpen] = useState(false)
  const colPanelRef = useRef(null)

  // Checkbox / selection
  const [selected,     setSelected]     = useState(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)
  const [savingId,     setSavingId]     = useState(null)

  // Flag dialog
  const [flagOpen,     setFlagOpen]     = useState(false)
  const [flagTarget,   setFlagTarget]   = useState(null)
  const [flagLoading,  setFlagLoading]  = useState(false)
  const [flagBulkMode, setFlagBulkMode] = useState(false)

  const checkAllRef = useRef(null)

  // Detail drawer
  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail, refetch: refetchDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  const selectedType = docTypes.find(t => t.code === selectedCode)

  // ── Load all document types ──────────────────────────────────────────────────
  useEffect(() => {
    getDocumentTypes().then(res => {
      const types = (res?.data ?? []).filter(t => t.is_active !== false)
      setDocTypes(types)
      if (!selectedCode && types.length > 0) setSelectedCode(types[0].code)
    })
  }, [])

  // ── Load categories for filter dropdown ──────────────────────────────────────
  useEffect(() => {
    getCategories().then(res => {
      setCategories(res?.data ?? [])
    }).catch(() => {})
  }, [])

  // ── When selected type changes: load field defs, reset state ─────────────────
  useEffect(() => {
    if (!selectedCode) return
    setSearchParams({ type: selectedCode }, { replace: true })
    setFieldDefs([])
    setFilters({})
    setPendingFilters({})
    setStaticFilters(EMPTY_STATIC)
    setStaticDraft(EMPTY_STATIC)
    setPage(1)
    setRecords([])
    setAggregations([])
    setSelected(new Set())
    setVisibleCols(new Set())

    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return

    api.get(`/api/document-types/${type.id}`).then(res => {
      const fields = res.data.fields ?? []
      setFieldDefs(fields)
      setVisibleCols(new Set(fields.map(f => f.field_key)))
    }).catch(() => {})
  }, [selectedCode, docTypes])

  // Close column panel on outside click
  useEffect(() => {
    if (!colPanelOpen) return
    function onOutside(e) {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target)) {
        setColPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [colPanelOpen])

  function toggleCol(key) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // ── Fetch stats for current type ─────────────────────────────────────────────
  const fetchStats = useCallback(() => {
    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return
    getRecordStats({ document_type_id: type.id }).then(setStats).catch(() => {})
  }, [selectedCode, docTypes])

  useEffect(() => { fetchStats() }, [fetchStats, filters, staticFilters])

  const fetchAggregations = useCallback(async (activeFilters = filters, sFilters = staticFilters) => {
    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return
    const sf = sFilters ?? EMPTY_STATIC
    const params = { document_type_id: type.id }
    if (sf.search)              params.search      = sf.search
    if (sf.date_from)           params.date_from   = sf.date_from
    if (sf.date_to)             params.date_to     = sf.date_to
    if (sf.platform?.length)    params.platform    = sf.platform.join(',')
    if (sf.status?.length)      params.status      = sf.status.join(',')
    if (sf.category_id?.length) params.category_id = sf.category_id.join(',')
    attachDynamicFilters(params, activeFilters)

    try {
      const { data } = await api.get('/api/records/aggregations', {
        params,
        paramsSerializer: serializeParams,
      })
      setAggregations(data.data ?? [])
    } catch {
      setAggregations([])
    }
  }, [selectedCode, docTypes, filters, staticFilters])

  useEffect(() => { fetchAggregations(filters, staticFilters) }, [fetchAggregations, filters, staticFilters])

  // ── Fetch records ─────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (pg, activeFilters, limit, sFilters) => {
    const type = docTypes.find(t => t.code === selectedCode)
    if (!type?.id) return
    setLoading(true)
    try {
      const sf = sFilters ?? EMPTY_STATIC
      const params = {
        document_type_id:     type.id,
        include_field_values: 'true',
        page:                 pg,
        limit:                limit,
        sort_order:           sf.sort_order || 'desc',
      }
      if (sf.search)              params.search      = sf.search
      if (sf.date_from)           params.date_from   = sf.date_from
      if (sf.date_to)             params.date_to     = sf.date_to
      if (sf.platform?.length)    params.platform    = sf.platform.join(',')
      if (sf.status?.length)      params.status      = sf.status.join(',')
      if (sf.category_id?.length) params.category_id = sf.category_id.join(',')

      // Build fv as nested object — avoids Axios 1.x bracket-encoding issue
      const fvParam = {}
      for (const [fieldKey, { op, value }] of Object.entries(activeFilters)) {
        if (value !== '' && value != null) {
          fvParam[fieldKey] = fvParam[fieldKey] || {}
          fvParam[fieldKey][op] = value
        }
      }
      if (Object.keys(fvParam).length) params.fv = fvParam

      const { data } = await api.get('/api/records', {
        params,
        paramsSerializer: p => {
          const parts = []
          const enc = v => encodeURIComponent(String(v))
            .replace(/%5B/gi, '[').replace(/%5D/gi, ']')
          function build(key, val) {
            if (val == null) return
            if (typeof val === 'object' && !Array.isArray(val)) {
              Object.keys(val).forEach(k => build(`${key}[${k}]`, val[k]))
            } else {
              parts.push(enc(key) + '=' + enc(val))
            }
          }
          Object.keys(p).forEach(k => build(k, p[k]))
          return parts.join('&')
        },
      })
      setRecords(data.data ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [selectedCode, docTypes])

  useEffect(() => {
    if (selectedCode && docTypes.length > 0 && fieldDefs !== undefined) {
      fetchRecords(page, filters, pageSize, staticFilters)
    }
  }, [fetchRecords, page, filters, fieldDefs, pageSize, staticFilters])

  // Reset selection when records change
  useEffect(() => { setSelected(new Set()) }, [records])

  // Sync indeterminate state on select-all checkbox
  useEffect(() => {
    if (!checkAllRef.current) return
    checkAllRef.current.indeterminate = selected.size > 0 && selected.size < records.length
  }, [selected, records])

  // ── Realtime socket ──────────────────────────────────────────────────────────
  const fetchStatsRef = useRef(fetchStats)
  const fetchAggregationsRef = useRef(fetchAggregations)
  const fetchNowRef   = useRef(null)
  fetchStatsRef.current = fetchStats
  fetchAggregationsRef.current = () => fetchAggregations(filters, staticFilters)
  fetchNowRef.current   = () => fetchRecords(page, filters, pageSize, staticFilters)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function onRecordUpdated({ record_id, new_status }) {
      setRecords(prev => prev.map(r => r.id === record_id ? { ...r, status: new_status } : r))
      fetchStatsRef.current?.()
      fetchAggregationsRef.current?.()
    }
    function onRecordDeleted({ record_id }) {
      setRecords(prev => prev.filter(r => r.id !== record_id))
      setTotal(t => Math.max(0, t - 1))
      fetchStatsRef.current?.()
      fetchAggregationsRef.current?.()
    }
    function onNewRecord() {
      fetchNowRef.current?.()
      fetchStatsRef.current?.()
      fetchAggregationsRef.current?.()
    }

    socket.on('record_updated', onRecordUpdated)
    socket.on('record_deleted', onRecordDeleted)
    socket.on('new_record',     onNewRecord)

    return () => {
      socket.off('record_updated', onRecordUpdated)
      socket.off('record_deleted', onRecordDeleted)
      socket.off('new_record',     onNewRecord)
    }
  }, [])

  // ── Checkbox helpers ─────────────────────────────────────────────────────────
  const allSelected  = records.length > 0 && records.every(r => selected.has(r.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(records.map(r => r.id)))
  }

  function toggleOne(e, id) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Single-row actions ───────────────────────────────────────────────────────
  async function handleApprove(e, record) {
    e.stopPropagation()
    if (record.status === 'approved') return
    setSavingId(record.id)
    try {
      await updateRecordStatus(record.id, 'approved')
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'approved' } : r))
      fetchStats()
      fetchAggregations(filters, staticFilters)
      notify.success('Duyệt thành công', `Record ${record.code ?? record.id?.slice(-6).toUpperCase()} đã được duyệt`)
    } catch {
      notify.error('Duyệt thất bại', 'Vui lòng thử lại')
    } finally {
      setSavingId(null)
    }
  }

  function openFlag(e, record) {
    e.stopPropagation()
    setFlagTarget(record)
    setFlagBulkMode(false)
    setFlagOpen(true)
  }

  function confirmDelete(e, record) {
    e.stopPropagation()
    Modal.confirm({
      title: 'Xóa record này?',
      content: `"${record.note ?? '(không có ghi chú)'}"`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      centered: true,
      async onOk() {
        try {
          await deleteRecord(record.id)
          setRecords(prev => prev.filter(r => r.id !== record.id))
          setTotal(t => Math.max(0, t - 1))
          fetchStats()
          fetchAggregations(filters, staticFilters)
          notify.success('Đã xóa record')
        } catch {
          notify.error('Xóa thất bại', 'Vui lòng thử lại')
        }
      },
    })
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  async function handleBulkApprove() {
    const ids = [...selected].filter(id => records.find(r => r.id === id)?.status !== 'approved')
    if (!ids.length) { notify.warning('Các record đã chọn đều đã được duyệt'); return }
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id => updateRecordStatus(id, 'approved')))
      setRecords(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'approved' } : r))
      setSelected(new Set())
      fetchStats()
      fetchAggregations(filters, staticFilters)
      notify.success(`Đã duyệt ${ids.length} record thành công`)
    } catch {
      notify.error('Duyệt thất bại, thử lại')
    } finally {
      setBulkLoading(false)
    }
  }

  function openBulkFlag() { setFlagBulkMode(true); setFlagOpen(true) }

  function handleBulkDelete() {
    const ids = [...selected]
    Modal.confirm({
      title: `Xóa ${ids.length} record đã chọn?`,
      content: 'Thao tác này không thể hoàn tác.',
      okText: `Xóa ${ids.length} record`,
      okType: 'danger',
      cancelText: 'Hủy',
      centered: true,
      async onOk() {
        setBulkLoading(true)
        try {
          await Promise.all(ids.map(id => deleteRecord(id)))
          setRecords(prev => prev.filter(r => !ids.includes(r.id)))
          setTotal(t => Math.max(0, t - ids.length))
          setSelected(new Set())
          fetchStats()
          fetchAggregations(filters, staticFilters)
          notify.success(`Đã xóa ${ids.length} record`)
        } catch {
          notify.error('Xóa thất bại, thử lại')
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  async function handleFlagConfirm(reason) {
    setFlagLoading(true)
    try {
      if (flagBulkMode) {
        const ids = [...selected]
        await Promise.all(ids.map(id => updateRecordStatus(id, 'flagged', reason)))
        setRecords(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'flagged', flag_reason: reason } : r))
        setSelected(new Set())
        notify.success(`Đã gắn cờ ${ids.length} record`)
      } else {
        await updateRecordStatus(flagTarget.id, 'flagged', reason)
        setRecords(prev => prev.map(r => r.id === flagTarget.id ? { ...r, status: 'flagged', flag_reason: reason } : r))
        notify.success('Đã gắn cờ record', `Lý do: ${reason}`)
      }
      fetchStats()
      fetchAggregations(filters, staticFilters)
      setFlagOpen(false); setFlagTarget(null); setFlagBulkMode(false)
    } catch {
      notify.error('Gắn cờ thất bại', 'Vui lòng thử lại')
    } finally {
      setFlagLoading(false)
    }
  }

  // ── Filter actions ───────────────────────────────────────────────────────────
  function applyFilters() {
    setFilters(pendingFilters)
    setStaticFilters(staticDraft)
    setPage(1)
  }

  function clearFilters() {
    setPendingFilters({})
    setFilters({})
    setStaticDraft(EMPTY_STATIC)
    setStaticFilters(EMPTY_STATIC)
    setPage(1)
  }

  function openDetail(r) { openById(r.id); setDetailOpen(true) }

  // ── Derived values ───────────────────────────────────────────────────────────
  const filterableDefs = fieldDefs.filter(f => f.is_filterable)
  const displayCols    = fieldDefs.filter(f => visibleCols.has(f.field_key))
  const totalPages     = Math.ceil(total / pageSize)

  const activeDynCount    = Object.values(filters).filter(f => f.value !== '' && f.value != null).length
  const activeStaticCount = (
    (staticFilters.platform.length  > 0 ? 1 : 0) +
    (staticFilters.status.length    > 0 ? 1 : 0) +
    (staticFilters.category_id.length > 0 ? 1 : 0) +
    (staticFilters.date_from ? 1 : 0) +
    (staticFilters.date_to   ? 1 : 0) +
    (staticFilters.search    ? 1 : 0)
  )
  const activeFilterCount = activeDynCount + activeStaticCount
  const hasActiveFilters  = activeFilterCount > 0

  const needCount    = stats.new + stats.reviewed
  const approvedPct  = stats.total > 0 ? Math.round(stats.approved / stats.total * 100) : 0

  // Fixed-width columns → triggers horizontal scroll naturally when many cols
  const gridCols = [
    '36px',
    '90px',
    '148px',
    ...displayCols.map(() => '148px'),
    '88px',
    '88px',
    '104px',
    '88px',
  ].join(' ')

  const hasCtrlBar = fieldDefs.length > 0

  return (
    <div className="dtv-page">

      {/* ── Header + type selector ── */}
      <div className="dtv-toolbar">
        <div>
          <div className="dtv-toolbar__title">Phân loại</div>
          <div className="dtv-toolbar__sub">
            {selectedType?.name}
            {total > 0 && ` · ${total} record`}
            {hasActiveFilters && <span className="dtv-filter-active-badge"> · đang lọc</span>}
          </div>
        </div>

        <div className="dtv-type-selector">
          <label className="dtv-type-selector__label">Loại tài liệu</label>
          <select
            className="dtv-type-selector__select"
            value={selectedCode}
            onChange={e => { if (e.target.value !== selectedCode) setSelectedCode(e.target.value) }}
          >
            {docTypes.length === 0 && <option value="">Đang tải…</option>}
            {docTypes.map(dt => (
              <option key={dt.code} value={dt.code}>{dt.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="dtv-stats">
        <div className="dtv-stat-card">
          <div className="dtv-stat-card__label">Tổng loại này</div>
          <div className="dtv-stat-card__value">{stats.total.toLocaleString()}</div>
          <div className="dtv-stat-card__sub">{selectedType?.name ?? '—'}</div>
        </div>
        <div className="dtv-stat-card dtv-stat-card--need">
          <div className="dtv-stat-card__label">Cần xử lý</div>
          <div className="dtv-stat-card__value">{needCount.toLocaleString()}</div>
          <div className="dtv-stat-card__sub">{stats.new} mới · {stats.reviewed} rà soát</div>
        </div>
        <div className="dtv-stat-card dtv-stat-card--approved">
          <div className="dtv-stat-card__label">Đã duyệt</div>
          <div className="dtv-stat-card__value">{stats.approved.toLocaleString()}</div>
          <div className="dtv-stat-card__sub">Tỷ lệ {approvedPct}%</div>
        </div>
        <div className="dtv-stat-card dtv-stat-card--flag">
          <div className="dtv-stat-card__label">Bị flag</div>
          <div className="dtv-stat-card__value">{stats.flagged.toLocaleString()}</div>
          <div className="dtv-stat-card__sub">Cần kiểm tra lại</div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      {aggregations.length > 0 && (
        <div className="dtv-aggregations">
          {aggregations.map(a => (
            <div key={a.field_key} className="dtv-agg-card">
              <div className="dtv-agg-card__label">{a.label}</div>
              <div className="dtv-agg-card__value">{formatValue(a.data_type, a.result, a.unit)}</div>
              <div className="dtv-agg-card__sub">
                {a.aggregation_type === 'sum' ? 'Tổng' : a.aggregation_type} · {a.value_count} giá trị
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bbo-card dtv-filters">
        <div className="dtv-filters__header">
          <span className="dtv-filters__title">Bộ lọc</span>
          {hasActiveFilters && (
            <span className="dtv-filter-active-badge">
              {activeFilterCount} bộ lọc đang bật
            </span>
          )}
        </div>

        {/* ── Static filters ── */}
        <div className="dtv-filters__grid">
          {/* Keyword search */}
          <div className="dtv-filter-item dtv-filter-item--grow">
            <div className="dtv-filter-item__label">Từ khóa</div>
            <input
              className="dtv-filter-input"
              type="text"
              placeholder="Tìm kiếm ghi chú, mã record…"
              value={staticDraft.search}
              onChange={e => setStaticDraft(d => ({ ...d, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>

          {/* Sort order toggle */}
          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Sắp xếp</div>
            <div className="dtv-sort-toggle">
              <button
                className={`dtv-sort-btn${staticDraft.sort_order === 'desc' ? ' dtv-sort-btn--active' : ''}`}
                onClick={() => setStaticDraft(d => ({ ...d, sort_order: 'desc' }))}
              >
                Mới nhất
              </button>
              <button
                className={`dtv-sort-btn${staticDraft.sort_order === 'asc' ? ' dtv-sort-btn--active' : ''}`}
                onClick={() => setStaticDraft(d => ({ ...d, sort_order: 'asc' }))}
              >
                Cũ nhất
              </button>
            </div>
          </div>

          {/* Platform */}
          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Kênh tiếp nhận</div>
            <MultiSelectDropdown
              placeholder="Tất cả kênh"
              options={PLATFORM_OPTIONS}
              value={staticDraft.platform}
              onChange={v => setStaticDraft(d => ({ ...d, platform: v }))}
            />
          </div>

          {/* Status */}
          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Trạng thái</div>
            <MultiSelectDropdown
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              value={staticDraft.status}
              onChange={v => setStaticDraft(d => ({ ...d, status: v }))}
            />
          </div>

          {/* Category */}
          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Danh mục</div>
            <MultiSelectDropdown
              placeholder="Tất cả danh mục"
              options={categories.map(c => ({ value: String(c.id), label: c.name }))}
              value={staticDraft.category_id}
              onChange={v => setStaticDraft(d => ({ ...d, category_id: v }))}
            />
          </div>

          {/* Date range */}
          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Từ ngày</div>
            <input
              className="dtv-filter-input"
              type="date"
              value={staticDraft.date_from}
              onChange={e => setStaticDraft(d => ({ ...d, date_from: e.target.value }))}
            />
          </div>

          <div className="dtv-filter-item">
            <div className="dtv-filter-item__label">Đến ngày</div>
            <input
              className="dtv-filter-input"
              type="date"
              value={staticDraft.date_to}
              onChange={e => setStaticDraft(d => ({ ...d, date_to: e.target.value }))}
            />
          </div>
        </div>

        {/* ── Dynamic field filters ── */}
        {filterableDefs.length > 0 && (
          <>
            <div className="dtv-filters__section-divider">
              <span>Trường dữ liệu loại tài liệu</span>
            </div>
            <div className="dtv-filters__grid">
              {filterableDefs.map(f => {
                const ops = getOps(f.data_type)
                const current = pendingFilters[f.field_key] || { op: ops[0].op, value: '' }
                const inputType = f.data_type === 'money' || f.data_type === 'number'
                  ? 'number' : f.data_type === 'date' ? 'date' : 'text'

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
                          onClick={() => setPendingFilters(prev => { const n = { ...prev }; delete n[f.field_key]; return n })}
                        >✕</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

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

      {/* ── Table section: column ctrl bar + table card merged visually ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Column visibility control bar */}
        {hasCtrlBar && (
          <div className="dtv-col-ctrl-bar" ref={colPanelRef}>
            <span className="dtv-col-ctrl-info">
              {visibleCols.size < fieldDefs.length
                ? `${visibleCols.size} / ${fieldDefs.length} cột đang hiện`
                : `${fieldDefs.length} cột`}
            </span>
            <button
              className={`dtv-col-ctrl__btn${colPanelOpen ? ' dtv-col-ctrl__btn--open' : ''}`}
              onClick={() => setColPanelOpen(o => !o)}
            >
              Chọn cột
              <ChevronDown />
            </button>

            {colPanelOpen && (
              <div className="dtv-col-ctrl__panel">
                <div className="dtv-col-ctrl__panel-hd">
                  <span>Hiện / ẩn cột</span>
                  <button onClick={() => setVisibleCols(new Set(fieldDefs.map(f => f.field_key)))}>
                    Hiện tất cả
                  </button>
                </div>
                <div className="dtv-col-ctrl__list">
                  {fieldDefs.map(f => (
                    <label key={f.field_key} className="dtv-col-ctrl__item">
                      <input
                        type="checkbox"
                        checked={visibleCols.has(f.field_key)}
                        onChange={() => toggleCol(f.field_key)}
                      />
                      <span className="dtv-col-ctrl__item-label">{f.label}</span>
                      {f.unit && <span className="dtv-col-ctrl__unit">({f.unit})</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pivot table card */}
        <div className="bbo-card" style={{ overflow: 'hidden', borderRadius: hasCtrlBar ? '0 0 12px 12px' : '12px' }}>

          {/* Bulk action bar */}
          {someSelected && (
            <div className="recListBulkBar">
              <span className="recListBulkBar__count">
                Đã chọn <strong>{selected.size}</strong> record
              </span>
              <div className="recListBulkBar__actions">
                <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={handleBulkApprove} disabled={bulkLoading}>
                  ✓ Duyệt ({selected.size})
                </button>
                <button className="bbo-btn bbo-btn-sm" onClick={openBulkFlag} disabled={bulkLoading}>
                  🚩 Gắn cờ ({selected.size})
                </button>
                <button className="bbo-btn bbo-btn-sm bbo-btn-danger" onClick={handleBulkDelete} disabled={bulkLoading}>
                  🗑 Xóa ({selected.size})
                </button>
                <button className="bbo-btn bbo-btn-sm bbo-btn-ghost" onClick={() => setSelected(new Set())} disabled={bulkLoading}>
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          {/* Scrollable table */}
          <div className="rec-table-wrap">

            {/* Header */}
            <div className="rec-table-head dtv-pivot-row" style={{ gridTemplateColumns: gridCols }}>
              <div className="recListCheckboxCell dtv-sticky-1" onClick={e => e.stopPropagation()}>
                <input
                  ref={checkAllRef}
                  type="checkbox"
                  className="recListCheckbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="Chọn tất cả"
                />
              </div>
              <div className="dtv-sticky-2">Mã record</div>
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
              <div>Action</div>
            </div>

            {/* Skeleton rows */}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rec-table-row dtv-pivot-row" style={{ gridTemplateColumns: gridCols }}>
                <div className="skeleton dtv-sticky-1" style={{ width: 16, height: 16, borderRadius: 3, margin: 'auto' }} />
                <div className="skeleton dtv-sticky-2" style={{ width: 72, height: 14 }} />
                <div className="skeleton" style={{ width: 90, height: 14 }} />
                {displayCols.map(f => (
                  <div key={f.field_key} className="skeleton" style={{ width: '75%', height: 14 }} />
                ))}
                <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />
                <div className="skeleton" style={{ width: 64, height: 14 }} />
                <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />
                <div />
              </div>
            ))}

            {/* Empty state */}
            {!loading && records.length === 0 && (
              <div className="recListEmpty">
                <div className="recListEmpty__icon">📋</div>
                <div className="recListEmpty__title">
                  {hasActiveFilters
                    ? 'Không có record nào khớp bộ lọc'
                    : `Chưa có record loại "${selectedType?.name}"`}
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
                className={`rec-table-row dtv-pivot-row${selected.has(r.id) ? ' recListRow--selected' : ''}`}
                style={{ gridTemplateColumns: gridCols }}
                onClick={() => openDetail(r)}
              >
                <div className="recListCheckboxCell dtv-sticky-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="recListCheckbox"
                    checked={selected.has(r.id)}
                    onChange={e => toggleOne(e, r.id)}
                  />
                </div>

                <div className="rec-table__code dtv-sticky-2">
                  {r.code ?? r.id?.slice(-6)?.toUpperCase()}
                </div>

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
                      {fv
                        ? formatValue(f.data_type, fv.value, f.unit)
                        : <span className="dtv-cell--empty">—</span>}
                      {fv?.source === 'human' && <span className="dtv-cell-human" title="Đã chỉnh tay">✎</span>}
                    </div>
                  )
                })}

                <div><PlatformBadge platform={r.platform} /></div>
                <div className="rec-table__time">{fmtDate(r.received_at)}</div>
                <div><StatusBadge status={r.status} /></div>

                <div className="recListActions recListActions--visible" onClick={e => e.stopPropagation()}>
                  {r.status !== 'approved' && (
                    <button
                      className="recListActionBtn recListActionBtn--approve"
                      title="Duyệt"
                      disabled={savingId === r.id}
                      onClick={e => handleApprove(e, r)}
                    >✓</button>
                  )}
                  {r.status !== 'flagged' && (
                    <button
                      className="recListActionBtn recListActionBtn--flag"
                      title="Gắn cờ"
                      onClick={e => openFlag(e, r)}
                    >🚩</button>
                  )}
                  <button
                    className="recListActionBtn recListActionBtn--del"
                    title="Xóa"
                    onClick={e => confirmDelete(e, r)}
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!loading && (
            <div className="recListPagination">
              <span className="recListPagination__info">
                {total > 0
                  ? `Hiển thị ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} / ${total} record`
                  : '0 record'}
              </span>

              {total > pageSize && (
                <div className="pager">
                  <button className="pager-btn" disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu">«</button>
                  <button className="pager-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="Trang trước">‹</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i
                    if (p < 1 || p > totalPages) return null
                    return (
                      <button key={p} className={`pager-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>
                        {p}
                      </button>
                    )
                  })}
                  <button className="pager-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} title="Trang sau">›</button>
                  <button className="pager-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="Trang cuối">»</button>
                </div>
              )}

              <div className="recListPageSizer">
                <span className="recListPageSizer__label">Hiển thị</span>
                {[20, 50, 100].map(size => (
                  <button
                    key={size}
                    className={`recListPageSizer__btn${pageSize === size ? ' recListPageSizer__btn--active' : ''}`}
                    onClick={() => { setPageSize(size); setPage(1) }}
                  >
                    {size}
                  </button>
                ))}
                <span className="recListPageSizer__label">/ trang</span>
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
        onRefreshRecord={refetchDetail}
        onStatusChange={(id, patch) => {
          setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
          fetchStats()
          fetchAggregations(filters, staticFilters)
        }}
        onDelete={id => {
          setRecords(prev => prev.filter(r => r.id !== id))
          setTotal(prev => Math.max(0, prev - 1))
          fetchStats()
          fetchAggregations(filters, staticFilters)
          setDetailOpen(false)
          closeDetail()
        }}
      />

      {/* Flag dialog */}
      <FlagDialog
        open={flagOpen}
        loading={flagLoading}
        onCancel={() => { setFlagOpen(false); setFlagTarget(null); setFlagBulkMode(false) }}
        onConfirm={handleFlagConfirm}
      />
    </div>
  )
}
