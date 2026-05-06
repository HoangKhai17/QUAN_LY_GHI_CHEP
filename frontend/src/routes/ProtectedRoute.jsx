import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/auth.store'
import api from '../services/api'

function PasswordField({ label, value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={show ? 'text' : 'password'}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: 52 }}
        />
        <span
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 12,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            color: '#6b7280', cursor: 'pointer', userSelect: 'none',
            padding: '2px 4px',
          }}
        >
          {show ? 'ẨN' : 'HIỆN'}
        </span>
      </div>
    </div>
  )
}

function ForceChangePasswordModal() {
  const clearMustChangePw = useAuthStore(s => s.clearMustChangePw)
  const [form, setForm]   = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.next.length < 8) {
      setError('Mật khẩu mới phải ít nhất 8 ký tự')
      return
    }
    if (form.next !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    if (form.current === form.next) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/change-password', {
        current_password: form.current,
        new_password:     form.next,
      })
      clearMustChangePw()
    } catch (err) {
      setError(err.response?.data?.error || 'Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '32px 36px',
        width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#111' }}>
          Đặt lại mật khẩu
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
          Tài khoản của bạn đang dùng mật khẩu tạm thời. Vui lòng đổi mật khẩu trước khi tiếp tục.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PasswordField
            label="Mật khẩu hiện tại"
            value={form.current}
            onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
            placeholder="Nhập mật khẩu tạm thời"
            autoFocus
          />
          <PasswordField
            label="Mật khẩu mới"
            value={form.next}
            onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
            placeholder="Tối thiểu 8 ký tự"
          />
          <PasswordField
            label="Xác nhận mật khẩu mới"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            placeholder="Nhập lại mật khẩu mới"
          />

          {error && (
            <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#1f7a43', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Đang xử lý…' : 'Xác nhận đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box',
}

export default function ProtectedRoute({ children }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const user       = useAuthStore(s => s.user)

  if (!isLoggedIn) return <Navigate to="/login" replace />

  return (
    <>
      {children}
      {user?.must_change_pw && <ForceChangePasswordModal />}
    </>
  )
}
