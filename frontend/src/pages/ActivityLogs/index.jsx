import { useState, useEffect, useCallback } from 'react'
import { archiveAuditLogs, getAuditLogs } from '../../services/reports.service'
import './ActivityLogs.css'

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const ACTION_META = {
  login_success:    { label: 'Đăng nhập',         color: '#1f7a43', bg: '#e8f5ee' },
  login_failed:     { label: 'Đăng nhập thất bại', color: '#dc2626', bg: '#fef2f2' },
  login_locked:     { label: 'Khoá tài khoản',    color: '#dc2626', bg: '#fef2f2' },
  logout:           { label: 'Đăng xuất',          color: '#64748b', bg: '#f1f5f9' },
  password_changed: { label: 'Đổi mật khẩu',      color: '#2563eb', bg: '#eff6ff' },
  password_reset:   { label: 'Reset mật khẩu',    color: '#d97706', bg: '#fffbeb' },
  create:           { label: 'Tạo mới',            color: '#1f7a43', bg: '#e8f5ee' },
  approve:          { label: 'Duyệt',              color: '#1f7a43', bg: '#e8f5ee' },
  flag:             { label: 'Flag',               color: '#dc2626', bg: '#fef2f2' },
  review:           { label: 'Rà soát',            color: '#2563eb', bg: '#eff6ff' },
  edit:             { label: 'Chỉnh sửa',          color: '#2563eb', bg: '#eff6ff' },
  delete:           { label: 'Xoá',                color: '#dc2626', bg: '#fef2f2' },
  user_created:     { label: 'Tạo user',           color: '#1f7a43', bg: '#e8f5ee' },
  user_activated:   { label: 'Kích hoạt user',     color: '#1f7a43', bg: '#e8f5ee' },
  user_deactivated: { label: 'Vô hiệu user',       color: '#dc2626', bg: '#fef2f2' },
  role_changed:     { label: 'Đổi role',           color: '#d97706', bg: '#fffbeb' },
  setting_updated:  { label: 'Cập nhật cài đặt',  color: '#2563eb', bg: '#eff6ff' },
  setting_cleared:  { label: 'Xoá cài đặt',       color: '#d97706', bg: '#fffbeb' },
  audit_archived:   { label: 'Lưu trữ log cũ',    color: '#7c3aed', bg: '#f5f3ff' },
}

const RESOURCE_LABELS = {
  record: 'Record', auth: 'Auth', users: 'User', system_settings: 'Cài đặt', audit_logs: 'Audit log',
}

const ACTION_GROUPS = [
  { label: 'Auth',         values: ['login_success','login_failed','login_locked','logout','password_changed','password_reset'] },
  { label: 'Record',       values: ['create','approve','flag','review','edit','delete'] },
  { label: 'Quản lý User', values: ['user_created','user_activated','user_deactivated','role_changed'] },
  { label: 'Cài đặt',     values: ['setting_updated','setting_cleared'] },
  { label: 'Hệ thống',     values: ['audit_archived'] },
]

function ActionBadge({ action }) {
  const m = ACTION_META[action] || { label: action, color: '#64748b', bg: '#f1f5f9' }
  return (
    <span className="alog-action-badge" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}

function DataDiff({ oldData, newData }) {
  if (!oldData && !newData) return <span className="alog-no-data">—</span>
  return (
    <div className="alog-diff">
      {oldData && (
        <div className="alog-diff-block alog-diff-block--old">
          <div className="alog-diff-label">Trước</div>
          <pre className="alog-diff-json">{JSON.stringify(oldData, null, 2)}</pre>
        </div>
      )}
      {newData && (
        <div className="alog-diff-block alog-diff-block--new">
          <div className="alog-diff-label">Sau</div>
          <pre className="alog-diff-json">{JSON.stringify(newData, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

const LIMIT = 50

const EMPTY_FILTERS = { date_from: '', date_to: '', action: '', resource: '', search: '' }

const ARCHIVE_OPTIONS = [
  { value: 3,  label: 'Cũ hơn 3 tháng' },
  { value: 6,  label: 'Cũ hơn 6 tháng' },
  { value: 12, label: 'Cũ hơn 1 năm' },
  { value: 24, label: 'Cũ hơn 2 năm' },
  { value: 36, label: 'Cũ hơn 3 năm' },
  { value: 60, label: 'Cũ hơn 5 năm' },
]

export default function ActivityLogsPage() {
  const today   = fmt(new Date())
  const weekAgo = fmt(new Date(Date.now() - 6 * 86400_000))

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, date_from: weekAgo, date_to: today })
  const [draft, setDraft]         = useState({ ...filters })
  const [page, setPage]           = useState(1)
  const [data, setData]           = useState([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]     = useState(false)
  const [detail, setDetail]       = useState(null)
  const [archiveMonths, setArchiveMonths] = useState(12)
  const [archiving, setArchiving] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState(null)

  const load = useCallback(async (f, p) => {
    setLoading(true)
    try {
      const params = { page: p, limit: LIMIT }
      if (f.date_from) params.date_from = f.date_from
      if (f.date_to)   params.date_to   = f.date_to
      if (f.action)    params.action    = f.action
      if (f.resource)  params.resource  = f.resource
      if (f.search)    params.search    = f.search
      const res = await getAuditLogs(params)
      setData(res.data || [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 1)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(filters, page) }, [filters, page, load])

  function applyFilters() {
    setFilters({ ...draft })
    setPage(1)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  async function handleArchive() {
    const selected = ARCHIVE_OPTIONS.find(o => o.value === archiveMonths)
    const label = selected?.label.toLowerCase() || `cũ hơn ${archiveMonths} tháng`
    if (!window.confirm(`Lưu trữ toàn bộ log ${label}? Log sẽ được chuyển sang bảng archive để giảm tải bảng chính.`)) return

    setArchiving(true)
    setArchiveMsg(null)
    try {
      const res = await archiveAuditLogs(archiveMonths)
      setArchiveMsg({
        type: 'success',
        text: `Đã lưu trữ ${Number(res.archived || 0).toLocaleString('vi-VN')} bản ghi.`,
      })
      setPage(1)
      await load(filters, 1)
    } catch (err) {
      setArchiveMsg({
        type: 'error',
        text: err?.response?.data?.error || err.message || 'Không thể lưu trữ log cũ.',
      })
    } finally {
      setArchiving(false)
    }
  }

  function fmtDateTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div className="alog-page">

      {/* ── Header ── */}
      <div className="alog-page-header">
        <div>
          <div className="alog-page-title">Nhật ký hệ thống</div>
          <div className="alog-page-sub">Lịch sử thao tác và thay đổi dữ liệu toàn hệ thống</div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="alog-filter-bar">
        <div className="alog-filter-head">
          <div className="alog-filter-head__left">
            <span className="alog-filter-title">Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="alog-filter-badge">{activeFilterCount} đang bật</span>
            )}
          </div>
          <div className="alog-total-row">
            {loading ? 'Đang tải…' : `${total.toLocaleString('vi-VN')} bản ghi`}
          </div>
        </div>

        <div className="alog-filter-row">
          <div className="alog-filter-group">
            <label>Từ ngày</label>
            <input type="date" className="alog-input" value={draft.date_from}
              onChange={e => setDraft(d => ({ ...d, date_from: e.target.value }))} />
          </div>
          <div className="alog-filter-group">
            <label>Đến ngày</label>
            <input type="date" className="alog-input" value={draft.date_to}
              onChange={e => setDraft(d => ({ ...d, date_to: e.target.value }))} />
          </div>
          <div className="alog-filter-group">
            <label>Loại action</label>
            <select className="alog-input" value={draft.action}
              onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}>
              <option value="">Tất cả</option>
              {ACTION_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.values.map(v => (
                    <option key={v} value={v}>{ACTION_META[v]?.label || v}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="alog-filter-group">
            <label>Resource</label>
            <select className="alog-input" value={draft.resource}
              onChange={e => setDraft(d => ({ ...d, resource: e.target.value }))}>
              <option value="">Tất cả</option>
              {Object.entries(RESOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="alog-filter-group alog-filter-group--search">
            <label>Tìm user</label>
            <input type="text" className="alog-input" placeholder="Tên người dùng…"
              value={draft.search}
              onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()} />
          </div>
          <div className="alog-filter-actions">
            <button className="bbo-btn bbo-btn-sm bbo-btn-ghost alog-clear-btn" onClick={clearFilters}>
              Xóa bộ lọc
            </button>
            <button className="bbo-btn bbo-btn-sm bbo-btn-primary alog-apply-btn" onClick={applyFilters}>
              Áp dụng
            </button>
          </div>
        </div>
      </div>

      {/* ── Archive old logs ── */}
      <div className="alog-archive-card">
        <div className="alog-archive-info">
          <div className="alog-archive-title">Dọn log cũ</div>
          <div className="alog-archive-desc">
            Chuyển log cũ sang bảng archive để giảm tải bảng audit chính, dữ liệu vẫn được giữ để truy vết khi cần.
          </div>
        </div>
        <div className="alog-archive-controls">
          <select
            className="alog-input alog-archive-select"
            value={archiveMonths}
            onChange={e => setArchiveMonths(Number(e.target.value))}
            disabled={archiving}
          >
            {ARCHIVE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="alog-archive-btn" onClick={handleArchive} disabled={archiving}>
            {archiving ? 'Đang dọn…' : 'Lưu trữ log cũ'}
          </button>
        </div>
        {archiveMsg && (
          <div className={`alog-archive-msg alog-archive-msg--${archiveMsg.type}`}>
            {archiveMsg.text}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="alog-table-wrap">
        <table className="alog-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người dùng</th>
              <th>Action</th>
              <th>Resource</th>
              <th>IP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="alog-loading">Đang tải dữ liệu…</td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan={6} className="alog-empty">Không có bản ghi nào phù hợp</td></tr>
            )}
            {!loading && data.map(row => (
              <tr key={row.id} className="alog-row">
                <td className="alog-cell-time">{fmtDateTime(row.created_at)}</td>
                <td className="alog-cell-user">
                  <div className="alog-user-name">{row.user_name || <span className="alog-system">System</span>}</div>
                  {row.user_role && <div className="alog-user-role">{row.user_role}</div>}
                </td>
                <td><ActionBadge action={row.action} /></td>
                <td className="alog-cell-resource">
                  <span className="alog-resource">{RESOURCE_LABELS[row.resource] || row.resource || '—'}</span>
                  {row.resource_id && (
                    <span className="alog-resource-id" title={row.resource_id}>
                      #{row.resource_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="alog-cell-ip">{row.ip_address || '—'}</td>
                <td>
                  {(row.old_data || row.new_data) && (
                    <button className="alog-detail-btn" onClick={() => setDetail(row)}>
                      Chi tiết
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="alog-pagination">
          <button className="alog-page-btn" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
          <button className="alog-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="alog-page-info">Trang {page} / {totalPages}</span>
          <button className="alog-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="alog-page-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <div className="alog-modal-overlay" onClick={() => setDetail(null)}>
          <div className="alog-modal" onClick={e => e.stopPropagation()}>
            <div className="alog-modal-header">
              <div className="alog-modal-title">
                Chi tiết thay đổi — <ActionBadge action={detail.action} />
              </div>
              <button className="alog-modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="alog-modal-meta">
              <span><strong>User:</strong> {detail.user_name || 'System'}</span>
              <span><strong>Thời gian:</strong> {fmtDateTime(detail.created_at)}</span>
              <span><strong>IP:</strong> {detail.ip_address || '—'}</span>
              {detail.resource_id && <span><strong>ID:</strong> {detail.resource_id}</span>}
            </div>
            <div className="alog-modal-body">
              <DataDiff oldData={detail.old_data} newData={detail.new_data} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
