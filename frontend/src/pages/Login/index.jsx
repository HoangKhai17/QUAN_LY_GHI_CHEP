import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import useAuthStore from '../../store/auth.store'
import logoImg from '../../assets/logo.png'
import './Login.css'

// Icons inline — không import thêm lib chỉ cho 2 icon nhỏ
function IconUser() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
function IconArrow() {
  return (
    <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, transition: 'transform .15s' }}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}
function IconCircleAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h0" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate     = useNavigate()
  const { isLoggedIn, loading, error, login, clearError } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(true)

  // Đã login → vào dashboard
  if (isLoggedIn) return <Navigate to="/app/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    const result = await login(username.trim(), password)
    if (result.success) navigate('/app/dashboard', { replace: true })
  }

  // Phân tích lỗi để hiển thị đúng
  const isLocked  = error?.status === 423
  const isDisabled = error?.status === 403
  const isPwError  = error?.status === 401

  function getErrorTitle() {
    if (isLocked)   return 'Tài khoản bị khoá tạm thời.'
    if (isDisabled) return 'Tài khoản bị vô hiệu hoá.'
    return 'Sai tên đăng nhập hoặc mật khẩu.'
  }
  function getErrorSub() {
    if (isLocked)   return 'Tài khoản đã bị khoá do nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.'
    if (isDisabled) return 'Tài khoản của bạn đã bị vô hiệu hoá. Liên hệ quản trị viên để được hỗ trợ.'
    return 'Vui lòng kiểm tra lại thông tin. Tài khoản sẽ bị khoá tạm thời sau 5 lần thử sai.'
  }

  const hasError = !!error

  return (
    <div className="loginPage">
      {/* Background layers */}
      <div className="bgLayer" />
      <div className="bgGrid" />
      <div className="shape s1" />
      <div className="shape s2" />
      <div className="shape s3" />

      {/* Top meta bar */}
      <div className="topbar">
        <div className="tag">bbo-records-internal · v1.0.3</div>
        <div className="env">STAGING</div>
      </div>

      {/* Login card */}
      <div className="card">
        {/* Brand row */}
        <div className="brand">
          <div className="logoWrap">
            <img src={logoImg} alt="BBO logo" />
          </div>
          <div className="brandText">
            <div className="system">Internal System</div>
            <div className="company">
              BBO Records <span> — Quản lý ghi chép</span>
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="heading">
          <h1>Đăng nhập hệ thống</h1>
          <p>Đăng nhập để truy cập hệ thống quản lý ghi chép nội bộ của BBO.</p>
        </div>

        {/* Error banner */}
        {hasError && (
          <div className="errorBanner">
            <span className="icon">!</span>
            <div className="msg">
              <b>{getErrorTitle()}</b><br />
              {getErrorSub()}
            </div>
          </div>
        )}

        {/* Form */}
        <form className="form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <div className={`inputWrap ${hasError && !isLocked && !isDisabled ? 'hasError' : ''}`}>
              <span className="prefix"><IconUser /></span>
              <input
                id="username"
                type="text"
                placeholder="vd: hoangkhai"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) clearError() }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <div className={`inputWrap ${isPwError ? 'hasError' : ''}`}>
              <span className="prefix"><IconLock /></span>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) clearError() }}
                disabled={loading}
              />
              <span className="suffix" onClick={() => setShowPw((v) => !v)}>
                {showPw ? 'ẨN' : 'HIỆN'}
              </span>
            </div>
            {isPwError && (
              <div className="fieldError">
                <IconCircleAlert /> Mật khẩu không chính xác
              </div>
            )}
          </div>

          {/* Row: remember + forgot */}
          <div className="rowBetween">
            <label className="remember" onClick={() => setRemember((v) => !v)}>
              <span className={`check ${remember ? 'on' : ''}`}>{remember ? '✓' : ''}</span>
              Ghi nhớ đăng nhập
            </label>
            <a href="#" className="forgot" onClick={(e) => e.preventDefault()}>Quên mật khẩu</a>
          </div>

          {/* Submit */}
          <button type="submit" className="cta" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            {!loading && <IconArrow />}
          </button>
        </form>

        <div className="divider">BẢO MẬT NỘI BỘ</div>

        <div className="helperCard">
          <svg className="lock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <div className="text">
            <b>Chỉ dành cho nhân sự nội bộ.</b><br />
            Chưa có tài khoản? Liên hệ quản trị viên tại{' '}
            <a href="mailto:contact@bbotech.vn">contact@bbotech.vn</a>
          </div>
        </div>

        <div className="cardFoot">
          <span>© 2026 BBO Technology</span>
          <span className="version">Version 1.0.3</span>
        </div>
      </div>

      {/* Page footer */}
      <div className="pageFoot">
        BBOTECH <span className="sep">·</span> Hệ thống nội bộ
        <span className="sep">·</span> Version 1.0.3
      </div>
    </div>
  )
}
