import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RecordList from '../../components/records/RecordList'
import RecordDetailDrawer from '../../components/records/RecordDetailDrawer'
import useRecordsQuery from '../../hooks/useRecordsQuery'
import useRecordDetail from '../../hooks/useRecordDetail'
import { getCategories, getDocumentTypes, createRecord, getSenders, getRecordStats, getUsers, getRecordYears } from '../../services/record.service'
import { exportReport } from '../../services/reports.service'
import notify from '../../utils/notify'
import './Records.css'

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


const MONTH_OPTIONS = [
  { value: '', label: 'Cả năm' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` })),
]

function getDefaultDraft() {
  const now = new Date()
  return {
    search: '', platform: [], status: [], category_id: [], document_type_id: [],
    sender_name: [],
    period_year:  String(now.getFullYear()),
    period_month: String(now.getMonth() + 1),
    date_from: '',
    date_to:   '',
    sort_order: 'desc',
  }
}

function periodToDateRange(year, month) {
  if (!year) return { date_from: '', date_to: '' }
  if (!month) return { date_from: `${year}-01-01`, date_to: `${year}-12-31` }
  const y = parseInt(year), m = parseInt(month)
  const mm = String(m).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  return { date_from: `${year}-${mm}-01`, date_to: `${year}-${mm}-${lastDay}` }
}

function periodChipLabel(dateFrom, dateTo) {
  if (!dateFrom) return null
  const [y, m, d] = dateFrom.split('-')
  if (m === '01' && d === '01' && dateTo === `${y}-12-31`) return `Năm ${y}`
  return `Tháng ${parseInt(m)}/${y}`
}

const EMPTY_FORM = {
  note: '', category_id: '', document_type_id: '', platform: 'manual',
  sender_id: '', sender_name: '',
}

// ── Multi-select dropdown ────────────────────────────────────────────────────
function MultiSelectDropdown({ placeholder, options, value, onChange }) {
  const [open,     setOpen]     = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  const ref        = useRef(null)
  const triggerRef = useRef(null)

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

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(o => !o)
  }

  return (
    <div className="msd" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={`msd__trigger${!isAll ? ' msd__trigger--active' : ''}${open ? ' msd__trigger--open' : ''}`}
        onClick={handleToggle}
      >
        <span className="msd__label">{triggerLabel()}</span>
        {!isAll && (
          <span className="msd__count">{selected.length}</span>
        )}
        <svg className="msd__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="msd__panel"
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}
        >
          {/* Tất cả */}
          <div
            className={`msd__option${isAll ? ' msd__option--checked' : ''}`}
            onClick={() => onChange([])}
          >
            <span className="msd__checkbox">
              {isAll && <span className="msd__tick">✓</span>}
            </span>
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
                <span className="msd__checkbox">
                  {checked && <span className="msd__tick">✓</span>}
                </span>
                <span className="msd__option-label">{o.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RecordsPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  const [pageSize, setPageSize] = useState(20)

  const _initDraft = getDefaultDraft()
  const { date_from: _initFrom, date_to: _initTo } = periodToDateRange(_initDraft.period_year, _initDraft.period_month)

  const _initSearch = searchParams.get('q') ?? ''

  const {
    records, total, page, filters, loading,
    updateFilters, setPage,
    updateRecord, removeRecord,
  } = useRecordsQuery(
    { status: searchParams.get('status') ?? '', search: _initSearch, date_from: _initFrom, date_to: _initTo },
    pageSize,
  )

  function handlePageSizeChange(size) {
    setPageSize(size)
    setPage(1)
  }

  useEffect(() => {
    const s = searchParams.get('status')
    const q = searchParams.get('q')
    if (s) updateFilters({ status: s })
    if (q) updateFilters({ search: q })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { record: detailRec, loading: loadingDetail, openById, close: closeDetail, refetch: refetchDetail } = useRecordDetail()
  const [detailOpen, setDetailOpen] = useState(false)

  const [draft, setDraft]           = useState(() => ({ ...getDefaultDraft(), search: _initSearch }))
  const [categories, setCategories]         = useState([])
  const [docTypes, setDocTypes]             = useState([])
  const [senders, setSenders]               = useState([])
  const [systemUsers, setSystemUsers]       = useState([])
  const [availableYears, setAvailableYears] = useState([])

  const [createOpen, setCreateOpen]       = useState(false)
  const [createForm, setCreateForm]       = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createFiles, setCreateFiles]     = useState([])
  const [createErrors, setCreateErrors]   = useState({})
  const [isDragging, setIsDragging]       = useState(false)
  const fileInputRef                      = useRef(null)
  const [stats, setStats]                 = useState({ total: 0, new: 0, reviewed: 0, approved: 0, flagged: 0 })

  useEffect(() => {
    getCategories().then(r => setCategories(r.data ?? []))
    getDocumentTypes().then(r => setDocTypes(r.data ?? []))
    getSenders().then(r => setSenders(r.data ?? []))
    getUsers().then(r => setSystemUsers(r.data ?? []))
    getRecordYears().then(r => setAvailableYears(r.data ?? []))
  }, [])

  // Re-fetch stats whenever applied filters change (ignores status filter — always shows full breakdown)
  function refetchStats() {
    const params = {}
    if (filters.platform)         params.platform         = filters.platform
    if (filters.category_id)      params.category_id      = filters.category_id
    if (filters.document_type_id) params.document_type_id = filters.document_type_id
    if (filters.sender_name)      params.sender_name      = filters.sender_name
    if (filters.search)           params.search           = filters.search
    if (filters.date_from)        params.date_from        = filters.date_from
    if (filters.date_to)          params.date_to          = filters.date_to
    getRecordStats(params).then(setStats).catch(() => {})
  }

  useEffect(() => { refetchStats() }, [filters])

  function openDetail(record) { openById(record.id); setDetailOpen(true) }

  // Multi-value keys — stored as arrays in draft, joined as CSV when applied
  const MULTI_KEYS = ['platform', 'status', 'category_id', 'document_type_id', 'sender_name']

  function applyFilters() {
    // Manual date range takes priority; fall back to period (năm/tháng)
    const { date_from, date_to } = (draft.date_from || draft.date_to)
      ? { date_from: draft.date_from, date_to: draft.date_to }
      : periodToDateRange(draft.period_year, draft.period_month)
    updateFilters({
      search:           draft.search.trim(),
      platform:         draft.platform.join(','),
      status:           draft.status.join(','),
      category_id:      draft.category_id.join(','),
      document_type_id: draft.document_type_id.join(','),
      sender_name:      draft.sender_name.join(','),
      date_from,
      date_to,
      sort_order:       draft.sort_order,
    })
  }

  function resetFilters() {
    const d = getDefaultDraft()
    setDraft(d)
    const { date_from, date_to } = periodToDateRange(d.period_year, d.period_month)
    updateFilters({ search: '', platform: '', status: '', category_id: '', document_type_id: '', sender_name: '', date_from, date_to, sort_order: 'desc' })
  }

  // Sort applies immediately without needing "Tìm record"
  function handleSortChange(value) {
    setDraft(d => ({ ...d, sort_order: value }))
    updateFilters({ sort_order: value })
  }

  // Remove a single value from a multi-filter chip
  function removeActiveFilter(key, singleValue) {
    const arr = (filters[key] ?? '').split(',').filter(v => v && v !== singleValue)
    setDraft(d => ({ ...d, [key]: MULTI_KEYS.includes(key) ? arr : '' }))
    updateFilters({ [key]: arr.join(',') })
  }

  function removeScalarFilter(key) {
    if (key === 'period') {
      setDraft(d => ({ ...d, period_year: '', period_month: '' }))
      updateFilters({ date_from: '', date_to: '' })
      return
    }
    setDraft(d => ({ ...d, [key]: '' }))
    updateFilters({ [key]: '' })
  }

  // Build active-filter chips — one chip per individual value
  const activeFilters = []
  if (filters.search) {
    activeFilters.push({ key: 'search', scalar: true, label: `Từ khóa: "${filters.search}"` })
  }
  ;(filters.platform ?? '').split(',').filter(Boolean).forEach(v => {
    const opt = PLATFORM_OPTIONS.find(o => o.value === v)
    activeFilters.push({ key: 'platform', value: v, label: `Kênh: ${opt?.label ?? v}` })
  })
  ;(filters.status ?? '').split(',').filter(Boolean).forEach(v => {
    const opt = STATUS_OPTIONS.find(o => o.value === v)
    activeFilters.push({ key: 'status', value: v, label: `Trạng thái: ${opt?.label ?? v}` })
  })
  ;(filters.category_id ?? '').split(',').filter(Boolean).forEach(v => {
    const cat = categories.find(c => c.id === v)
    activeFilters.push({ key: 'category_id', value: v, label: `Phân loại: ${cat?.name ?? '…'}` })
  })
  ;(filters.document_type_id ?? '').split(',').filter(Boolean).forEach(v => {
    const dt = docTypes.find(d => d.id === v)
    activeFilters.push({ key: 'document_type_id', value: v, label: `Loại TL: ${dt?.name ?? '…'}` })
  })
  ;(filters.sender_name ?? '').split(',').filter(Boolean).forEach(v => {
    activeFilters.push({ key: 'sender_name', value: v, label: `Người gửi: ${v}` })
  })
  if (filters.date_from || filters.date_to) {
    const lbl = periodChipLabel(filters.date_from, filters.date_to)
    activeFilters.push({ key: 'period', scalar: true, label: `Thời gian: ${lbl}` })
  }

  function closeCreateModal() {
    setCreateOpen(false)
    setCreateForm(EMPTY_FORM)
    setCreateFiles([])
    setCreateErrors({})
    setIsDragging(false)
  }

  function addFiles(newFiles) {
    setCreateFiles(prev => [...prev, ...newFiles].slice(0, 3))
  }

  function removeFile(index) {
    setCreateFiles(prev => prev.filter((_, i) => i !== index))
  }

  function handleFileSelect(e) {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    addFiles(dropped)
  }

  async function handleCreate() {
    const errors = {}
    if (!createForm.sender_id) errors.sender_name = true
    if (!createForm.note.trim() && createFiles.length === 0) errors.content = true
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      notify.warning(
        'Thiếu thông tin',
        errors.sender_name ? 'Vui lòng chọn người gửi' : 'Vui lòng nhập ghi chú hoặc đính kèm ảnh'
      )
      return
    }
    setCreateErrors({})
    setCreateLoading(true)
    try {
      await createRecord({
        note:             createForm.note.trim() || null,
        category_id:      createForm.category_id || null,
        document_type_id: createForm.document_type_id || null,
        platform:         createForm.platform || 'manual',
        sender_name:      createForm.sender_name,
        sender_id:        createForm.sender_id || null,
      }, createFiles)
      notify.success('Tạo record thành công', 'Record mới đã được thêm vào hệ thống')
      closeCreateModal()
      updateFilters({})
      refetchStats()
    } catch (err) {
      notify.error('Tạo record thất bại', err?.response?.data?.error || 'Có lỗi xảy ra')
    } finally {
      setCreateLoading(false)
    }
  }

  // Options for multi-select filters
  const categoryOptions  = categories.map(c => ({ value: c.id, label: c.name }))
  const docTypeOptions   = docTypes.map(d => ({ value: d.id, label: d.name }))
  const senderOptions    = senders.map(name => ({ value: name, label: name }))

  // Stats subtitle for total card
  const statsTotalSub = (() => {
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? new Date(filters.date_from) : null
      const to   = filters.date_to   ? new Date(filters.date_to)   : new Date()
      if (from) {
        const days = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)))
        return `Trong ${days} ngày lọc`
      }
      return `Đến ${filters.date_to}`
    }
    return 'Toàn bộ thời gian'
  })()

  const needCount     = stats.new + stats.reviewed
  const approvedPct   = stats.total > 0 ? Math.round(stats.approved / stats.total * 100) : 0

  const [isFullscreen,     setIsFullscreen]     = useState(false)
  const [filterCollapsed,  setFilterCollapsed]  = useState(false)
  const [exporting,        setExporting]        = useState(false)

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  async function exportCurrentRecords() {
    if (total <= 0) {
      notify.warning('Không có dữ liệu để xuất', 'Bộ lọc hiện tại chưa có record phù hợp')
      return
    }
    setExporting(true)
    try {
      const params = {
        type: 'records',
        format: 'xlsx',
        include_field_values: 'true',
        ...filters,
      }
      const response = await exportReport(params)
      const cd = response.headers['content-disposition'] ?? ''
      const match = cd.match(/filename="?([^";\s]+)"?/)
      const filename = match?.[1] ?? `BBOTECH_records_${new Date().toISOString().slice(0, 10)}.xlsx`
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify.success('Đã xuất dữ liệu', `${total.toLocaleString('vi-VN')} record theo bộ lọc hiện tại`)
    } catch (err) {
      let msg = err?.message || 'Không thể xuất dữ liệu'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          msg = JSON.parse(text).error || msg
        } catch {}
      }
      notify.error('Xuất dữ liệu thất bại', msg)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="recPage">
      {/* ── Toolbar ── */}
      <div className="recToolbar">
        <div>
          <div className="recToolbar__title">Danh sách Record</div>
          <div className="recToolbar__sub">
            {loading ? 'Đang tải…' : `${total} record phù hợp`}
          </div>
        </div>
        <div className="recToolbar__actions">
          <button
            className="bbo-btn bbo-btn-sm bbo-btn-ghost recToolbar__fsBtn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình (ESC)' : 'Xem toàn màn hình'}
          >
            {isFullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>
                <path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
              </svg>
            )}
          </button>
          <button className="bbo-btn bbo-btn-sm" onClick={() => navigate('/app/dashboard')}>
            ← Dashboard
          </button>
          <button
            className="bbo-btn bbo-btn-sm bbo-btn-export"
            onClick={exportCurrentRecords}
            disabled={exporting || loading || total <= 0}
          >
            {exporting ? 'Đang xuất…' : 'Xuất dữ liệu'}
          </button>
          <button
            className="bbo-btn bbo-btn-sm bbo-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            + Tạo record
          </button>
        </div>
      </div>

      {/* ── Advanced filter bar ── */}
      <div className="recFilterCard bbo-card">
        <div className="recFilterHeader">
          <div className="recFilterHeader__left">
            <span className="recFilterHeader__title">Bộ lọc</span>
            {activeFilters.length > 0 && (
              <span className="recFilterHeader__badge">{activeFilters.length} đang bật</span>
            )}
          </div>
          <button
            className="recFilterHeader__toggle"
            onClick={() => setFilterCollapsed(c => !c)}
            title={filterCollapsed ? 'Mở rộng bộ lọc' : 'Thu gọn bộ lọc'}
          >
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ transform: filterCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s' }}
            >
              <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className={`recFilterBody${filterCollapsed ? ' recFilterBody--collapsed' : ''}`}>
        <div className="recFilterGrid">

          {/* Kênh tiếp nhận — multi-select */}
          <div className="recFilterField">
            <label className="recFilterLabel">Kênh tiếp nhận</label>
            <MultiSelectDropdown
              placeholder="Tất cả kênh"
              options={PLATFORM_OPTIONS}
              value={draft.platform}
              onChange={v => setDraft(d => ({ ...d, platform: v }))}
            />
          </div>

          {/* Trạng thái — multi-select */}
          <div className="recFilterField">
            <label className="recFilterLabel">Trạng thái</label>
            <MultiSelectDropdown
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              value={draft.status}
              onChange={v => setDraft(d => ({ ...d, status: v }))}
            />
          </div>

          {/* Phân loại — multi-select */}
          <div className="recFilterField">
            <label className="recFilterLabel">Phân loại</label>
            <MultiSelectDropdown
              placeholder="Tất cả phân loại"
              options={categoryOptions}
              value={draft.category_id}
              onChange={v => setDraft(d => ({ ...d, category_id: v }))}
            />
          </div>

          {/* Loại tài liệu — multi-select */}
          <div className="recFilterField">
            <label className="recFilterLabel">Loại tài liệu</label>
            <MultiSelectDropdown
              placeholder="Tất cả loại TL"
              options={docTypeOptions}
              value={draft.document_type_id}
              onChange={v => setDraft(d => ({ ...d, document_type_id: v }))}
            />
          </div>

          {/* Người gửi — multi-select */}
          <div className="recFilterField">
            <label className="recFilterLabel">Người gửi</label>
            <MultiSelectDropdown
              placeholder="Tất cả người gửi"
              options={senderOptions}
              value={draft.sender_name}
              onChange={v => setDraft(d => ({ ...d, sender_name: v }))}
            />
          </div>

          {/* Năm */}
          <div className="recFilterField">
            <label className="recFilterLabel">Năm</label>
            <select
              className="recFilterSelect"
              value={draft.period_year}
              onChange={e => {
                const y = e.target.value
                // chọn năm/tháng → xóa khoảng ngày thủ công
                setDraft(d => ({ ...d, period_year: y, period_month: y ? d.period_month : '', date_from: '', date_to: '' }))
              }}
            >
              <option value="">Tất cả năm</option>
              {availableYears.map(y => <option key={y} value={String(y)}>Năm {y}</option>)}
            </select>
          </div>

          {/* Tháng */}
          <div className="recFilterField">
            <label className="recFilterLabel">Tháng</label>
            <select
              className="recFilterSelect"
              value={draft.period_month}
              onChange={e => setDraft(d => ({ ...d, period_month: e.target.value, date_from: '', date_to: '' }))}
              disabled={!draft.period_year}
            >
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Từ ngày */}
          <div className="recFilterField">
            <label className="recFilterLabel">Từ ngày</label>
            <input
              className="recFilterInput"
              type="date"
              value={draft.date_from}
              onChange={e => setDraft(d => ({ ...d, date_from: e.target.value, period_year: '', period_month: '' }))}
            />
          </div>

          {/* Đến ngày */}
          <div className="recFilterField">
            <label className="recFilterLabel">Đến ngày</label>
            <input
              className="recFilterInput"
              type="date"
              value={draft.date_to}
              onChange={e => setDraft(d => ({ ...d, date_to: e.target.value, period_year: '', period_month: '' }))}
            />
          </div>

          {/* Sắp xếp */}
          <div className="recFilterField">
            <label className="recFilterLabel">Sắp xếp</label>
            <div className="recSortToggle">
              <button
                className={`recSortBtn${draft.sort_order === 'desc' ? ' recSortBtn--active' : ''}`}
                onClick={() => handleSortChange('desc')}
                title="Mới nhất trước"
              >
                ↓ Mới nhất
              </button>
              <button
                className={`recSortBtn${draft.sort_order === 'asc' ? ' recSortBtn--active' : ''}`}
                onClick={() => handleSortChange('asc')}
                title="Cũ nhất trước"
              >
                ↑ Cũ nhất
              </button>
            </div>
          </div>

          {/* Từ khóa — wide */}
          <div className="recFilterField recFilterField--wide">
            <label className="recFilterLabel">Từ khóa</label>
            <input
              className="recFilterInput"
              type="text"
              placeholder="Tìm theo ghi chú, mã, người gửi…"
              value={draft.search}
              onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
        </div>

        <div className="recFilterActions">
          <div className="recFilterActions__btns">
            <button className="bbo-btn bbo-btn-sm bbo-btn-ghost" onClick={resetFilters}>
              Đặt lại
            </button>
            <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={applyFilters}>
              Tìm record
            </button>
          </div>
          <div className="recStatsInline">
            <div className="recStatsInline__item">
              <span className="recStatsInline__value">{stats.total.toLocaleString()}</span>
              <span className="recStatsInline__label">Tổng kết quả</span>
            </div>
            <div className="recStatsInline__divider" />
            <div className="recStatsInline__item">
              <span className="recStatsInline__value recStatsInline__value--need">{needCount.toLocaleString()}</span>
              <span className="recStatsInline__label">Cần xử lý</span>
            </div>
            <div className="recStatsInline__divider" />
            <div className="recStatsInline__item">
              <span className="recStatsInline__value recStatsInline__value--approved">{stats.approved.toLocaleString()}</span>
              <span className="recStatsInline__label">Đã duyệt · {approvedPct}%</span>
            </div>
            <div className="recStatsInline__divider" />
            <div className="recStatsInline__item">
              <span className="recStatsInline__value recStatsInline__value--flag">{stats.flagged.toLocaleString()}</span>
              <span className="recStatsInline__label">Bị flag</span>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="recActiveTags">
            {activeFilters.map((f, i) => (
              <span key={`${f.key}-${f.value ?? i}`} className="filter-chip">
                {f.label}
                <span
                  className="filter-chip-x"
                  onClick={() =>
                    f.scalar
                      ? removeScalarFilter(f.key)
                      : removeActiveFilter(f.key, f.value)
                  }
                >✕</span>
              </span>
            ))}
          </div>
        )}
        </div>{/* /recFilterBody */}
      </div>

      {/* ── Record list ── */}
      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <RecordList
          records={records}
          total={total}
          page={page}
          loading={loading}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onRowClick={openDetail}
          onRecordUpdate={(id, patch) => { updateRecord(id, patch); refetchStats() }}
          onRecordRemove={(id) => { removeRecord(id); refetchStats() }}
        />
      </div>

      {/* ── Detail drawer ── */}
      <RecordDetailDrawer
        open={detailOpen}
        record={detailRec}
        loading={loadingDetail}
        onClose={() => { setDetailOpen(false); closeDetail() }}
        onRefreshRecord={refetchDetail}
        onStatusChange={(id, patch) => { updateRecord(id, patch); refetchStats() }}
        onDelete={id => {
          removeRecord(id)
          refetchStats()
          setDetailOpen(false)
          closeDetail()
        }}
      />

      {/* ── Create record modal ── */}
      {createOpen && (
        <div
          className="recModalOverlay"
          onClick={e => e.target === e.currentTarget && closeCreateModal()}
        >
          <div className="recModal">
            <div className="recModal__header">
              <div className="recModal__title">Tạo Record thủ công</div>
              <button className="recModal__close" onClick={closeCreateModal}>✕</button>
            </div>

            <div className="recModal__body">
              {/* Ghi chú */}
              <div className={`recModalField${createErrors.content ? ' recModalField--error' : ''}`}>
                <label>
                  Ghi chú
                  <span className="recModalFieldRequired"> *</span>
                  <span className="recModalFieldHint"> (hoặc đính kèm ảnh)</span>
                </label>
                <textarea
                  className="recModalTextarea"
                  rows={3}
                  placeholder="Nhập nội dung ghi chú…"
                  value={createForm.note}
                  onChange={e => {
                    setCreateForm(f => ({ ...f, note: e.target.value }))
                    if (e.target.value.trim()) setCreateErrors(p => ({ ...p, content: false }))
                  }}
                />
              </div>

              {/* Ảnh đính kèm */}
              <div className="recModalField">
                <label>Ảnh đính kèm <span className="recModalFieldHint">tối đa 3 ảnh · 10MB/ảnh</span></label>
                <div
                  className={`recModalUploadZone${isDragging ? ' recModalUploadZone--drag' : ''}${createErrors.content ? ' recModalUploadZone--error' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  {createFiles.length === 0 ? (
                    <div className="recModalUploadPlaceholder">
                      <span className="recModalUploadIcon">🖼</span>
                      <span>Nhấn hoặc kéo ảnh vào đây</span>
                      <span className="recModalUploadHint">JPG, PNG, WEBP</span>
                    </div>
                  ) : (
                    <div className="recModalFilePreviews">
                      {createFiles.map((file, i) => (
                        <div key={i} className="recModalFileItem">
                          <img src={URL.createObjectURL(file)} alt="" />
                          <button
                            type="button"
                            className="recModalFileRemove"
                            onClick={e => { e.stopPropagation(); removeFile(i) }}
                          >✕</button>
                        </div>
                      ))}
                      {createFiles.length < 3 && (
                        <div className="recModalFileAdd" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                          <span>+</span>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </div>
                {createErrors.content && (
                  <span className="recModalError">Vui lòng nhập ghi chú hoặc đính kèm ảnh</span>
                )}
              </div>

              <div className="recModalRow">
                <div className="recModalField">
                  <label>Kênh</label>
                  <select
                    className="recModalSelect"
                    value={createForm.platform}
                    onChange={e => setCreateForm(f => ({ ...f, platform: e.target.value }))}
                  >
                    <option value="manual">Thủ công</option>
                    <option value="telegram">Telegram</option>
                    <option value="zalo">Zalo</option>
                  </select>
                </div>
                <div className={`recModalField${createErrors.sender_name ? ' recModalField--error' : ''}`}>
                  <label>Người gửi <span className="recModalFieldRequired">*</span></label>
                  <select
                    className="recModalSelect"
                    value={createForm.sender_id}
                    onChange={e => {
                      const user = systemUsers.find(u => u.id === e.target.value)
                      setCreateForm(f => ({
                        ...f,
                        sender_id:   e.target.value,
                        sender_name: user?.name || '',
                      }))
                      if (e.target.value) setCreateErrors(p => ({ ...p, sender_name: false }))
                    }}
                  >
                    <option value="">-- Chọn người gửi --</option>
                    {systemUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.username ? ` (@${u.username})` : ''}
                      </option>
                    ))}
                  </select>
                  {createErrors.sender_name && (
                    <span className="recModalError">Bắt buộc chọn</span>
                  )}
                </div>
              </div>

              <div className="recModalRow">
                <div className="recModalField">
                  <label>Phân loại</label>
                  <select
                    className="recModalSelect"
                    value={createForm.category_id}
                    onChange={e => setCreateForm(f => ({ ...f, category_id: e.target.value }))}
                  >
                    <option value="">-- Chọn phân loại --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="recModalField">
                  <label>Loại tài liệu</label>
                  <select
                    className="recModalSelect"
                    value={createForm.document_type_id}
                    onChange={e => setCreateForm(f => ({ ...f, document_type_id: e.target.value }))}
                  >
                    <option value="">-- Chọn loại tài liệu --</option>
                    {docTypes.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="recModal__footer">
              <button className="bbo-btn bbo-btn-md" onClick={closeCreateModal}>Hủy</button>
              <button
                className="bbo-btn bbo-btn-md bbo-btn-primary"
                onClick={handleCreate}
                disabled={createLoading}
              >
                {createLoading ? 'Đang tạo…' : 'Tạo Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
