import { useState } from 'react'
import { Modal } from 'antd'
import './FlagDialog.css'

export default function FlagDialog({ open, onCancel, onConfirm, loading }) {
  const [reason, setReason] = useState('')

  function handleOk() {
    if (!reason.trim()) return
    onConfirm(reason.trim())
  }

  function handleCancel() {
    setReason('')
    onCancel()
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={440}
      centered
      title={null}
      styles={{ body: { padding: 0 } }}
    >
      <div className="flagDialog">
        <div className="flagDialog__header">
          <div className="flagDialog__icon">🚩</div>
          <div>
            <div className="flagDialog__title">Gắn cờ record</div>
            <div className="flagDialog__sub">Nhập lý do để lưu vào audit log và thông báo cho nhân viên</div>
          </div>
        </div>

        <div className="flagDialog__body">
          <label className="flagDialog__label">Lý do gắn cờ <span>*</span></label>
          <textarea
            className={`flagDialog__textarea ${!reason.trim() && reason !== '' ? 'flagDialog__textarea--err' : ''}`}
            rows={4}
            placeholder="Vd: Ảnh mờ, không đọc được số tiền. Đề nghị chụp lại."
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
          {reason !== '' && !reason.trim() && (
            <div className="flagDialog__err">Lý do không được để trống</div>
          )}
        </div>

        <div className="flagDialog__footer">
          <button className="bbo-btn bbo-btn-md" onClick={handleCancel} disabled={loading}>
            Hủy
          </button>
          <button
            className="bbo-btn bbo-btn-md bbo-btn-danger"
            onClick={handleOk}
            disabled={!reason.trim() || loading}
          >
            {loading ? 'Đang lưu…' : '🚩 Xác nhận gắn cờ'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
