import { useState } from 'react'
import { message, Modal } from 'antd'
import StatusBadge from './StatusBadge'
import PlatformBadge from './PlatformBadge'
import FlagDialog from './FlagDialog'
import { updateRecordStatus, deleteRecord } from '../../services/record.service'
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
function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'
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
  const [flagOpen, setFlagOpen]     = useState(false)
  const [flagTarget, setFlagTarget] = useState(null)
  const [flagLoading, setFlagLoading] = useState(false)
  const [savingId, setSavingId]     = useState(null)

  async function handleApprove(e, record) {
    e.stopPropagation()
    if (record.status === 'approved') return
    setSavingId(record.id)
    try {
      await updateRecordStatus(record.id, 'approved')
      onRecordUpdate?.(record.id, { status: 'approved' })
      message.success('Đã duyệt thành công')
    } catch {
      message.error('Duyệt thất bại, thử lại')
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
      await updateRecordStatus(flagTarget.id, 'flagged', reason)
      onRecordUpdate?.(flagTarget.id, { status: 'flagged', flag_reason: reason })
      message.success('Đã gắn cờ')
      setFlagOpen(false)
      setFlagTarget(null)
    } catch {
      message.error('Gắn cờ thất bại, thử lại')
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
          message.success('Đã xóa')
        } catch {
          message.error('Xóa thất bại')
        }
      },
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  const show = col => !hideCols.includes(col)

  return (
    <div className="recList">
      {/* ── Table ── */}
      <div className="rec-table-wrap">
        {/* Head */}
        <div className="rec-table-head recListGrid">
          {show('thumb')    && <div />}
          {show('code')     && <div>Mã</div>}
          {show('note')     && <div>Ghi chú / Thông tin</div>}
          {show('sender')   && <div>Người gửi</div>}
          {show('amount')   && <div>Số tiền</div>}
          {show('platform') && <div>Kênh</div>}
          {show('status')   && <div>Trạng thái</div>}
          {show('time')     && <div>Thời gian</div>}
          <div />
        </div>

        {/* Skeleton rows */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rec-table-row recListGrid recListSkeleton">
            {show('thumb')    && <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 6 }} />}
            {show('code')     && <div className="skeleton" style={{ width: 72, height: 14 }} />}
            {show('note')     && <div className="skeleton" style={{ width: '80%', height: 14 }} />}
            {show('sender')   && <div className="skeleton" style={{ width: 90, height: 14 }} />}
            {show('amount')   && <div className="skeleton" style={{ width: 80, height: 14 }} />}
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
            className="rec-table-row recListGrid"
            onClick={() => onRowClick?.(r)}
          >
            {show('thumb') && (
              <div className="img-ph rec-table__thumb">
                {r.thumbnail_url
                  ? <img src={r.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  : 'IMG'}
              </div>
            )}
            {show('code') && (
              <div className="rec-table__code">{r.code ?? r.id?.slice(-6)?.toUpperCase()}</div>
            )}
            {show('note') && (
              <div className="recListNoteCell">
                <div className="rec-table__note">{r.note || '(không có ghi chú)'}</div>
                {r.category_name && (
                  <div className="recListSub">
                    {r.category_name}
                    {r.ocr_confidence != null && ` · OCR ${Math.round(r.ocr_confidence * 100)}%`}
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
            {show('amount') && (
              <div className="recListAmount">{r.amount ?? '—'}</div>
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
            {/* Row actions */}
            <div className="recListActions" onClick={e => e.stopPropagation()}>
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
        onCancel={() => { setFlagOpen(false); setFlagTarget(null) }}
        onConfirm={handleFlagConfirm}
      />
    </div>
  )
}
