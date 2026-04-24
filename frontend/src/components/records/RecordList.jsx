import { useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import StatusBadge from './StatusBadge'
import PlatformBadge from './PlatformBadge'
import FlagDialog from './FlagDialog'
import { updateRecordStatus, deleteRecord } from '../../services/record.service'
import notify from '../../utils/notify'
import './RecordList.css'

// Format received_at  →  "22/04/2026\n10:31"
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${date}\n${time}`
}

// Initials from name
function initials(name) {
  return (name ?? '').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'
}

export default function RecordList({
  records,
  total,
  page,
  loading,
  onPageChange,
  onRowClick,
  onRecordUpdate,  // (id, patch) => void
  onRecordRemove,  // (id)        => void
  pageSize = 10,
  // columns to hide
  hideCols = [],
}) {
  const [flagOpen, setFlagOpen]         = useState(false)
  const [flagTarget, setFlagTarget]     = useState(null)
  const [flagLoading, setFlagLoading]   = useState(false)
  const [savingId, setSavingId]         = useState(null)
  const [selected, setSelected]         = useState(new Set())
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [flagBulkMode, setFlagBulkMode] = useState(false)
  const checkAllRef                     = useRef(null)

  // Reset selection whenever records list changes (page/filter)
  useEffect(() => { setSelected(new Set()) }, [records])

  // Sync indeterminate state on "select all" checkbox
  useEffect(() => {
    if (!checkAllRef.current) return
    const some = selected.size > 0 && selected.size < records.length
    checkAllRef.current.indeterminate = some
  }, [selected, records])

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

  async function handleBulkApprove() {
    const ids = [...selected].filter(id => records.find(r => r.id === id)?.status !== 'approved')
    if (!ids.length) { notify.warning('Các record đã chọn đều đã được duyệt'); return }
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id => updateRecordStatus(id, 'approved')))
      ids.forEach(id => onRecordUpdate?.(id, { status: 'approved' }))
      setSelected(new Set())
      notify.success(`Đã duyệt ${ids.length} record thành công`)
    } catch {
      notify.error('Duyệt thất bại, thử lại')
    } finally {
      setBulkLoading(false)
    }
  }

  function openBulkFlag() {
    setFlagBulkMode(true)
    setFlagOpen(true)
  }

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
          ids.forEach(id => onRecordRemove?.(id))
          setSelected(new Set())
          notify.success(`Đã xóa ${ids.length} record`)
        } catch {
          notify.error('Xóa thất bại, thử lại')
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  async function handleApprove(e, record) {
    e.stopPropagation()
    if (record.status === 'approved') return
    setSavingId(record.id)
    try {
      await updateRecordStatus(record.id, 'approved')
      onRecordUpdate?.(record.id, { status: 'approved' })
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
    setFlagOpen(true)
  }

  async function handleFlagConfirm(reason) {
    setFlagLoading(true)
    try {
      if (flagBulkMode) {
        const ids = [...selected]
        await Promise.all(ids.map(id => updateRecordStatus(id, 'flagged', reason)))
        ids.forEach(id => onRecordUpdate?.(id, { status: 'flagged', flag_reason: reason }))
        setSelected(new Set())
        notify.success(`Đã gắn cờ ${ids.length} record`)
      } else {
        await updateRecordStatus(flagTarget.id, 'flagged', reason)
        onRecordUpdate?.(flagTarget.id, { status: 'flagged', flag_reason: reason })
        notify.success('Đã gắn cờ record', `Lý do: ${reason}`)
      }
      setFlagOpen(false)
      setFlagTarget(null)
      setFlagBulkMode(false)
    } catch {
      notify.error('Gắn cờ thất bại', 'Vui lòng thử lại')
    } finally {
      setFlagLoading(false)
    }
  }

  function confirmDelete(e, record) {
    e.stopPropagation()
    Modal.confirm({
      title: 'Xóa record này?',
      content: `REC ${record.code ?? record.id} — "${record.note ?? '(không có ghi chú)'}"`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      centered: true,
      async onOk() {
        try {
          await deleteRecord(record.id)
          onRecordRemove?.(record.id)
          notify.success('Đã xóa record')
        } catch {
          notify.error('Xóa thất bại', 'Vui lòng thử lại')
        }
      },
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  const show = col => !hideCols.includes(col)

  return (
    <div className="recList">
      {/* ── Bulk action bar ── */}
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

      {/* ── Table ── */}
      <div className="rec-table-wrap">
        {/* Head */}
        <div className="rec-table-head recListGrid">
          {show('select') && (
            <div className="recListCheckboxCell" onClick={e => e.stopPropagation()}>
              <input
                ref={checkAllRef}
                type="checkbox"
                className="recListCheckbox"
                checked={allSelected}
                onChange={toggleAll}
                title="Chọn tất cả"
              />
            </div>
          )}
          {show('code')     && <div>Mã</div>}
          {show('note')     && <div>Ghi chú / Thông tin</div>}
          {show('sender')   && <div>Người gửi</div>}
          {show('category') && <div>Phân loại</div>}
          {show('doctype')  && <div>Loại tài liệu</div>}
          {show('platform') && <div>Kênh</div>}
          {show('status')   && <div>Trạng thái</div>}
          {show('time')     && <div>Thời gian</div>}
          <div>Action</div>
        </div>

        {/* Skeleton rows */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rec-table-row recListGrid recListSkeleton">
            {show('select')   && <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 3, margin: 'auto' }} />}
            {show('code')     && <div className="skeleton" style={{ width: 72, height: 14 }} />}
            {show('note')     && <div className="skeleton" style={{ width: '80%', height: 14 }} />}
            {show('sender')   && <div className="skeleton" style={{ width: 90, height: 14 }} />}
            {show('category') && <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 6 }} />}
            {show('doctype')  && <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 6 }} />}
            {show('platform') && <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />}
            {show('status')   && <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 999 }} />}
            {show('time')     && <div className="skeleton" style={{ width: 64, height: 14 }} />}
            <div />
          </div>
        ))}

        {/* Empty */}
        {!loading && records.length === 0 && (
          <div className="recListEmpty">
            <div className="recListEmpty__icon">📭</div>
            <div className="recListEmpty__title">Chưa có record nào</div>
            <div className="recListEmpty__sub">Nhân viên gửi ảnh qua Telegram hoặc Zalo để bắt đầu</div>
          </div>
        )}

        {/* Data rows */}
        {!loading && records.map(r => (
          <div
            key={r.id}
            className={`rec-table-row recListGrid${selected.has(r.id) ? ' recListRow--selected' : ''}`}
            onClick={() => onRowClick?.(r)}
          >
            {show('select') && (
              <div className="recListCheckboxCell" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="recListCheckbox"
                  checked={selected.has(r.id)}
                  onChange={e => toggleOne(e, r.id)}
                />
              </div>
            )}
            {show('code') && (
              <div className="rec-table__code">{r.code ?? r.id?.slice(-6)?.toUpperCase()}</div>
            )}
            {show('note') && (
              <div className="recListNoteCell">
                <div className="rec-table__note">{r.note || r.document_type_name || '(không có ghi chú)'}</div>
                {(r.category_name || r.extraction_status) && (
                  <div className="recListSub">
                    {r.category_name}
                    {r.category_name && r.extraction_status && ' · '}
                    {r.extraction_status === 'needs_review' && <span style={{ color: '#d97706' }}>Cần rà soát</span>}
                    {r.extraction_status === 'failed' && <span style={{ color: 'var(--danger)' }}>Lỗi trích xuất</span>}
                    {r.classification_confidence != null && r.extraction_status === 'done' &&
                      ` · AI ${Math.round(r.classification_confidence * 100)}%`}
                  </div>
                )}
              </div>
            )}
            {show('sender') && (
              <div className="rec-table__sender">
                <div className="avatar-sm">{initials(r.sender_name)}</div>
                <span className="rec-table__sender-name">{r.sender_name ?? '—'}</span>
              </div>
            )}
            {show('category') && (
              <div className="recListCategoryCell">
                {r.category_name
                  ? <span
                      className="recListCategoryPill"
                      style={{ color: r.category_color || '#666', borderColor: r.category_color || '#ccc' }}
                    >{r.category_name}</span>
                  : <span style={{ color: 'var(--ink3)', fontSize: 12 }}>—</span>}
              </div>
            )}
            {show('doctype') && (
              <div className="recListDocType">
                {r.document_type_name
                  ? <span className="recListDocTypePill">{r.document_type_name}</span>
                  : <span style={{ color: 'var(--ink3)', fontSize: 12 }}>—</span>}
              </div>
            )}
            {show('platform') && (
              <div><PlatformBadge platform={r.platform} /></div>
            )}
            {show('status') && (
              <div><StatusBadge status={r.status} /></div>
            )}
            {show('time') && (
              <div className="rec-table__time" style={{ whiteSpace: 'pre-line' }}>
                {fmtTime(r.received_at)}
              </div>
            )}
            {/* Row actions — always visible */}
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

      {/* ── Pagination ── */}
      {!loading && total > pageSize && (
        <div className="recListPagination">
          <span className="recListPagination__info">
            Hiển thị {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} / {total} record
          </span>
          <div className="pager">
            <button
              className="pager-btn"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i
              if (p < 1 || p > totalPages) return null
              return (
                <button
                  key={p}
                  className={`pager-btn${p === page ? ' active' : ''}`}
                  onClick={() => onPageChange?.(p)}
                >{p}</button>
              )
            })}
            <button
              className="pager-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >›</button>
          </div>
        </div>
      )}

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
