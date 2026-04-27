import { useState, useEffect } from 'react'
import { Drawer, message, Modal } from 'antd'
import StatusBadge from './StatusBadge'
import PlatformBadge from './PlatformBadge'
import FlagDialog from './FlagDialog'
import { updateRecordStatus, updateRecord, deleteRecord, getCategories } from '../../services/record.service'
import './RecordDetailDrawer.css'

function fmtDatetime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function initials(name) {
  return (name ?? '').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '??'
}

function ConfidenceBadge({ value }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const cls = pct >= 85 ? 'conf--high' : pct >= 60 ? 'conf--mid' : 'conf--low'
  return <span className={`conf ${cls}`}>Confidence {pct}%</span>
}

function ExtractionStatusBadge({ status }) {
  if (!status || status === 'pending') return null
  const map = {
    done:         { label: 'AI hoàn thành',   cls: 'exBadge--done' },
    needs_review: { label: 'Cần rà soát',      cls: 'exBadge--warn' },
    failed:       { label: 'Trích xuất lỗi',  cls: 'exBadge--err'  },
  }
  const m = map[status]
  if (!m) return null
  return <span className={`exBadge ${m.cls}`}>{m.label}</span>
}

function formatFieldValue(dataType, value) {
  if (value == null) return '—'
  if (dataType === 'money' || dataType === 'number') {
    return typeof value === 'number'
      ? value.toLocaleString('vi-VN')
      : value
  }
  if (dataType === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, d] = String(value).split('-')
      return `${d}/${m}/${y}`
    }
    return String(value)
  }
  if (dataType === 'boolean') return value ? 'Có' : 'Không'
  if (dataType === 'json') return JSON.stringify(value, null, 2)
  return String(value)
}

export default function RecordDetailDrawer({
  record,
  loading,
  open,
  onClose,
  onStatusChange,
  onDelete,
  onRefreshRecord,
}) {
  const [note,        setNote]        = useState('')
  const [noteChanged, setNoteChanged] = useState(false)
  const [savingNote,  setSavingNote]  = useState(false)
  const [flagOpen,    setFlagOpen]    = useState(false)
  const [flagLoading, setFlagLoading] = useState(false)
  const [savingStatus,setSavingStatus]= useState(false)
  const [categories,  setCategories]  = useState([])
  const [catId,       setCatId]       = useState('')
  const [imgTab,      setImgTab]      = useState(0)

  useEffect(() => {
    if (record) {
      setNote(record.note ?? '')
      setNoteChanged(false)
      setCatId(record.category_id ?? '')
    }
  }, [record?.id])

  useEffect(() => {
    getCategories().then(data => {
      setCategories(Array.isArray(data) ? data : (data?.data ?? []))
    }).catch(() => {})
  }, [])

  // Auto-poll when OCR is still processing (manual records with uploaded image)
  useEffect(() => {
    if (record?.ocr_status !== 'pending' || !record?.image_url || !onRefreshRecord) return
    const timer = setInterval(onRefreshRecord, 3000)
    return () => clearInterval(timer)
  }, [record?.ocr_status, record?.image_url, onRefreshRecord])

  async function handleApprove() {
    setSavingStatus(true)
    try {
      await updateRecordStatus(record.id, 'approved')
      onStatusChange?.(record.id, { status: 'approved' })
      message.success('Đã duyệt thành công')
    } catch {
      message.error('Duyệt thất bại')
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleFlagConfirm(reason) {
    setFlagLoading(true)
    try {
      await updateRecordStatus(record.id, 'flagged', reason)
      onStatusChange?.(record.id, { status: 'flagged', flag_reason: reason })
      message.success('Đã gắn cờ')
      setFlagOpen(false)
    } catch {
      message.error('Gắn cờ thất bại')
    } finally {
      setFlagLoading(false)
    }
  }

  async function handleSaveNote() {
    setSavingNote(true)
    try {
      await updateRecord(record.id, { note, category_id: catId || null })
      onStatusChange?.(record.id, { note, category_id: catId })
      setNoteChanged(false)
      message.success('Đã lưu thay đổi')
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSavingNote(false)
    }
  }

  async function handleCategoryChange(e) {
    const val = e.target.value
    setCatId(val)
    try {
      await updateRecord(record.id, { category_id: val || null })
      onStatusChange?.(record.id, { category_id: val })
      message.success('Đã cập nhật danh mục')
      onRefreshRecord?.()
    } catch {
      message.error('Cập nhật danh mục thất bại')
    }
  }

  function handleDelete() {
    Modal.confirm({
      title: 'Xóa record này?',
      content: `"${record?.note ?? '(không có ghi chú)'}" — thao tác không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      centered: true,
      async onOk() {
        try {
          await deleteRecord(record.id)
          onDelete?.(record.id)
          onClose?.()
          message.success('Đã xóa record')
        } catch {
          message.error('Xóa thất bại')
        }
      },
    })
  }

  const isApproved = record?.status === 'approved'
  const isFlagged  = record?.status === 'flagged'

  // Build ordered field entries for display
  const fieldEntries = (() => {
    if (!record?.field_values) return []
    const defs = record.field_definitions ?? []
    const vals = record.field_values ?? {}
    if (defs.length > 0) {
      return defs
        .filter(d => vals[d.field_key] != null)
        .map(d => ({ ...d, ...vals[d.field_key] }))
    }
    return Object.entries(vals).map(([key, fv]) => ({ field_key: key, ...fv }))
  })()

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="min(960px, 92vw)"
        styles={{
          header: { display: 'none' },
          body:   { padding: 0, display: 'flex', flexDirection: 'column' },
        }}
        destroyOnHide
      >
        {loading && (
          <div className="rdd-loading">
            <div className="rdd-loading__spinner" />
            <div>Đang tải…</div>
          </div>
        )}

        {!loading && !record && (
          <div className="rdd-loading">Không tìm thấy record</div>
        )}

        {!loading && record && (
          <div className="rdd-shell">
            {/* ── Toolbar ── */}
            <div className="rdd-toolbar">
              <div className="rdd-toolbar__left">
                <button className="bbo-btn bbo-btn-sm" onClick={onClose}>← Đóng</button>
                <div>
                  <div className="rdd-toolbar__title">{record.note || record.document_type_name || '(không có ghi chú)'}</div>
                  <div className="rdd-toolbar__meta">
                    {record.code ?? record.id?.slice(-6)?.toUpperCase()} · Gửi lúc {fmtDatetime(record.received_at)}
                  </div>
                </div>
                <StatusBadge status={record.status} />
                <ExtractionStatusBadge status={record.extraction_status} />
              </div>
              <div className="rdd-toolbar__right">
                <button className="bbo-btn bbo-btn-sm bbo-btn-danger" onClick={() => setFlagOpen(true)} disabled={isFlagged || savingStatus}>
                  🚩 Flag
                </button>
                <button
                  className="bbo-btn bbo-btn-sm bbo-btn-primary"
                  onClick={handleApprove}
                  disabled={isApproved || savingStatus}
                >
                  {savingStatus ? 'Đang lưu…' : '✓ Duyệt record'}
                </button>
                <button className="bbo-btn bbo-btn-sm" onClick={handleDelete} title="Xóa record" style={{ color: 'var(--danger)' }}>
                  🗑
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="rdd-body">
              {/* Left — image + OCR */}
              <div className="rdd-main">
                {/* Image preview */}
                <div className="bbo-card">
                  <div className="rdd-img-header">
                    <div className="rdd-img-tabs">
                      {['Ảnh gốc', 'OCR overlay'].map((t, i) => (
                        <span
                          key={t}
                          className={`rdd-img-tab${imgTab === i ? ' active' : ''}`}
                          onClick={() => setImgTab(i)}
                        >{t}</span>
                      ))}
                    </div>
                    <div className="rdd-img-controls">
                      {record.image_url && (
                        <a href={record.image_url} target="_blank" rel="noreferrer" className="bbo-btn bbo-btn-sm">
                          ↗ Mở full
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="rdd-img-body">
                    {record.image_url ? (
                      <img
                        src={record.image_url}
                        alt="Record"
                        className="rdd-img"
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                      />
                    ) : null}
                    <div className="img-ph rdd-img-ph" style={{ display: record.image_url ? 'none' : 'flex' }}>
                      ẢNH CHỨNG TỪ / TÀI LIỆU
                    </div>
                  </div>
                </div>

                {/* OCR text */}
                <div className="bbo-card">
                  <div className="bbo-card-header">
                    <div className="bbo-card-title">Văn bản OCR / AI trích xuất</div>
                    {record.ocr_status !== 'pending' && (
                      <ConfidenceBadge value={record.ocr_confidence ?? record.confidence} />
                    )}
                  </div>
                  <div className="bbo-card-body">
                    {record.ocr_status === 'pending' && record.image_url ? (
                      <div className="rdd-ocr-processing">
                        <span className="rdd-ocr-spinner" />
                        Đang phân tích ảnh bằng AI, vui lòng chờ…
                      </div>
                    ) : record.ocr_text ? (
                      <pre className="rdd-ocr-box">{record.ocr_text}</pre>
                    ) : (
                      <div className="rdd-ocr-empty">Không có dữ liệu OCR</div>
                    )}
                  </div>
                </div>

                {/* Extracted field values */}
                {fieldEntries.length > 0 && (
                  <div className="bbo-card">
                    <div className="bbo-card-header">
                      <div className="bbo-card-title">Dữ liệu trích xuất</div>
                      {record.classification_confidence != null && (
                        <ConfidenceBadge value={record.classification_confidence} />
                      )}
                    </div>
                    <div className="bbo-card-body rdd-fields">
                      {fieldEntries.map(f => (
                        <div key={f.field_key} className="rdd-field-row">
                          <div className="rdd-field-label">{f.label || f.field_key}</div>
                          <div className="rdd-field-value">
                            <span className={`rdd-field-val${f.data_type === 'money' ? ' rdd-field-val--money' : ''}`}>
                              {formatFieldValue(f.data_type, f.value)}
                            </span>
                            {f.unit && <span className="rdd-field-unit">{f.unit}</span>}
                            {f.source === 'human' && <span className="rdd-field-src rdd-field-src--human">chỉnh tay</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right — info + note + timeline */}
              <div className="rdd-side">
                {/* Record metadata */}
                <div className="bbo-card">
                  <div className="bbo-card-header">
                    <div className="bbo-card-title">Thông tin record</div>
                  </div>
                  <div className="bbo-card-body rdd-meta">
                    <MetaRow label="Mã record">
                      <code className="rdd-code">{record.code ?? record.id?.slice(-6)?.toUpperCase()}</code>
                    </MetaRow>
                    {record.document_type_name && (
                      <MetaRow label="Loại tài liệu">
                        <span className="rdd-doctype-badge">{record.document_type_name}</span>
                      </MetaRow>
                    )}
                    <MetaRow label="Phân loại">
                      <select
                        className="rdd-select"
                        value={catId}
                        onChange={handleCategoryChange}
                      >
                        <option value="">— Chưa phân loại —</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </MetaRow>
                    <MetaRow label="Người gửi">
                      <div className="rdd-sender">
                        <div className="avatar-sm">{initials(record.sender_name)}</div>
                        <span>{record.sender_name ?? '—'}</span>
                      </div>
                    </MetaRow>
                    <MetaRow label="Nền tảng">
                      <PlatformBadge platform={record.platform} />
                    </MetaRow>
                    <MetaRow label="Thời gian gửi">
                      <span className="rdd-mono">{fmtDatetime(record.received_at)}</span>
                    </MetaRow>
                    {record.flag_reason && (
                      <MetaRow label="Lý do flag">
                        <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>{record.flag_reason}</span>
                      </MetaRow>
                    )}
                  </div>
                </div>

                {/* Note editor */}
                <div className="bbo-card">
                  <div className="bbo-card-header">
                    <div className="bbo-card-title">Ghi chú</div>
                  </div>
                  <div className="bbo-card-body">
                    {record.user_note && (
                      <div className="rdd-user-note">
                        <div className="rdd-user-note__label">Ghi chú từ người gửi</div>
                        <div className="rdd-user-note__text">"{record.user_note}"</div>
                      </div>
                    )}
                    <label className="rdd-note-label">Ghi chú nội bộ (admin)</label>
                    <textarea
                      className="rdd-note-ta"
                      rows={4}
                      placeholder="Nhập ghi chú để lưu vào audit log…"
                      value={note}
                      onChange={e => { setNote(e.target.value); setNoteChanged(true) }}
                    />
                    {noteChanged && (
                      <div className="rdd-note-actions">
                        <button
                          className="bbo-btn bbo-btn-sm bbo-btn-primary"
                          onClick={handleSaveNote}
                          disabled={savingNote}
                        >
                          {savingNote ? 'Đang lưu…' : '✓ Lưu ghi chú'}
                        </button>
                        <button
                          className="bbo-btn bbo-btn-sm"
                          onClick={() => { setNote(record.note ?? ''); setNoteChanged(false) }}
                        >Hủy</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                {record.timeline?.length > 0 && (
                  <div className="bbo-card">
                    <div className="bbo-card-header">
                      <div className="bbo-card-title">Lịch sử thao tác</div>
                    </div>
                    <div className="bbo-card-body">
                      <div className="rdd-timeline">
                        {record.timeline.map((item, i) => (
                          <div key={i} className="rdd-timeline__item">
                            <div className="rdd-timeline__dot-wrap">
                              <div className="rdd-timeline__dot" />
                              {i < record.timeline.length - 1 && <div className="rdd-timeline__line" />}
                            </div>
                            <div className="rdd-timeline__content">
                              <div className="rdd-timeline__text" dangerouslySetInnerHTML={{ __html: item.text }} />
                              <div className="rdd-timeline__time">{item.time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <FlagDialog
        open={flagOpen}
        loading={flagLoading}
        onCancel={() => setFlagOpen(false)}
        onConfirm={handleFlagConfirm}
      />
    </>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className="rdd-meta-row">
      <div className="rdd-meta-label">{label}</div>
      <div className="rdd-meta-value">{children}</div>
    </div>
  )
}
