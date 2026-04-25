import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/auth.store'
import useNotificationStore, { relativeTime } from '../../store/notification.store'
import { connectSocket, disconnectSocket } from '../../services/socket'
import notify from '../../utils/notify'
import api from '../../services/api'
import logoImg from '../../assets/logo.png'
import './AppLayout.css'

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconGrid() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
}
function IconList() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
}
function IconZap() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
}
function IconSearch() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
}
function IconChart() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-4 4"/></svg>
}
function IconTable() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
}
function IconSettings() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function IconBell() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function IconChevronDown() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function IconPanelCollapse() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><polyline points="16 8 11 12 16 16"/></svg>
}
function IconPanelExpand() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><polyline points="12 8 17 12 12 16"/></svg>
}
function IconUser() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconMagnify() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
}
function IconHome() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>
}

// ── Nav groups ────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { to: '/app/dashboard',    label: 'Dashboard',          Icon: IconGrid   },
  { to: '/app/records',      label: 'Danh sách Record',   Icon: IconList   },
  { to: '/app/doc-types',    label: 'Theo loại tài liệu', Icon: IconTable  },
  { to: '/app/quick-review', label: 'Rà soát nhanh',     Icon: IconZap    },
  { to: '/app/search',       label: 'Tìm kiếm',          Icon: IconSearch },
]
const NAV_ADMIN = [
  { to: '/app/reports',      label: 'Báo cáo',         Icon: IconChart    },
  { to: '/app/settings',     label: 'Cài đặt',         Icon: IconSettings },
]

const PAGE_TITLES = {
  '/app/dashboard':    'Dashboard',
  '/app/records':      'Danh sách Record',
  '/app/doc-types':    'Theo loại tài liệu',
  '/app/quick-review': 'Rà soát nhanh',
  '/app/search':       'Tìm kiếm',
  '/app/reports':      'Báo cáo',
  '/app/settings':     'Cài đặt',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout, accessToken } = useAuthStore()
  const { pendingCount, events, setPendingCount, pushNewRecord, syncPending } = useNotificationStore()

  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [bellOpen,  setBellOpen]  = useState(false)
  const pillRef = useRef(null)
  const bellRef = useRef(null)

  const title = PAGE_TITLES[location.pathname] ?? 'BBO Records'

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : '??'

  async function handleLogout() {
    setMenuOpen(false)
    disconnectSocket()
    await logout()
    navigate('/login', { replace: true })
  }

  // Socket connection lifecycle
  useEffect(() => {
    const token = accessToken || localStorage.getItem('access_token')
    if (!token) return

    api.get('/api/notifications/summary')
      .then(res => setPendingCount(res.data.pending))
      .catch(() => {})

    const socket = connectSocket(token)

    socket.on('new_record', (payload) => {
      pushNewRecord(payload)
      notify.info('Record mới', `${payload.record?.sender_name || 'Người dùng'} vừa gửi record mới`)
    })

    socket.on('record_updated', (payload) => {
      syncPending(payload.pending)
    })

    return () => {
      socket.off('new_record')
      socket.off('record_updated')
    }
  }, [accessToken])

  // Close bell on outside click
  useEffect(() => {
    if (!bellOpen) return
    function onClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [bellOpen])

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e) {
      if (pillRef.current && !pillRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  return (
    <div className="appShell" style={collapsed ? { '--sidebar-w': '64px' } : {}}>

      {/* ── Sidebar ── */}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
        {/* Brand */}
        <div className="sidebarBrand">
          <div className="sidebarLogoWrap">
            <img src={logoImg} alt="BBO" />
          </div>
          <div className="sidebarBrandText">
            <div className="name">BBO Records</div>
            <div className="sub">Internal System</div>
          </div>
          <button
            className="sidebarToggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {collapsed ? <IconPanelExpand /> : <IconPanelCollapse />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebarNav">
          <div className="navSection">
            <div className="navSectionLabel">Điều hướng</div>
            {NAV_MAIN.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `navItem${isActive ? ' active' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon />
                <span className="navLabel">{label}</span>
              </NavLink>
            ))}
          </div>

          <hr className="navDivider" />

          <div className="navSection">
            <div className="navSectionLabel">Quản trị hệ thống</div>
            {NAV_ADMIN.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `navItem${isActive ? ' active' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon />
                <span className="navLabel">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sidebar user card */}
        <div className="sidebarUser" title={collapsed ? (user?.name ?? 'User') : undefined}>
          <div className="sidebarUserAvatar">{initials}</div>
          <div className="sidebarUserInfo">
            <div className="sidebarUserName">{user?.name ?? 'User'}</div>
            <div className="sidebarUserMeta">Workspace: BBO HQ</div>
          </div>
        </div>

        <div className="sidebarVersion">v1.0.3 · STAGING</div>
      </aside>

      {/* ── Main area ── */}
      <div className="mainArea">

        {/* Header */}
        <header className="header">
          {/* Breadcrumb */}
          <div className="headerBreadcrumb">
            <span className="breadcrumbHomeIcon"><IconHome /></span>
            <span className="breadcrumbSep">/</span>
            <span className="breadcrumbCurrent">{title}</span>
          </div>

          {/* Right controls */}
          <div className="headerRight">
            {/* Search */}
            <div className="headerSearch">
              <span className="headerSearchIcon"><IconMagnify /></span>
              <input
                className="headerSearchInput"
                type="text"
                placeholder="Tìm kiếm record, người gửi…"
              />
            </div>
            {/* Bell */}
            <div className="bellWrap" ref={bellRef}>
              <div
                className={`bell${bellOpen ? ' bell--open' : ''}`}
                title="Thông báo"
                onClick={() => setBellOpen(v => !v)}
              >
                <IconBell />
                {pendingCount > 0 && (
                  <span className="bellBadge">{pendingCount > 99 ? '99+' : pendingCount}</span>
                )}
              </div>

              {bellOpen && (
                <div className="bellDropdown" onClick={e => e.stopPropagation()}>
                  <div className="bellDropdown__header">
                    <span>Thông báo</span>
                    {pendingCount > 0 && (
                      <span className="bellDropdown__pending">{pendingCount} cần xử lý</span>
                    )}
                  </div>
                  <div className="bellDropdown__list">
                    {events.length === 0 ? (
                      <div className="bellDropdown__empty">Không có thông báo mới</div>
                    ) : (
                      events.map(ev => (
                        <div key={ev.id} className="bellDropdown__item"
                          onClick={() => { setBellOpen(false); navigate('/app/records') }}>
                          <div className="bellDropdown__itemIcon">📄</div>
                          <div className="bellDropdown__itemBody">
                            <div className="bellDropdown__itemTitle">
                              Record mới từ <strong>{ev.record?.sender_name || '—'}</strong>
                            </div>
                            <div className="bellDropdown__itemMeta">
                              {ev.record?.platform && <span className="bellDropdown__itemPlatform">{ev.record.platform}</span>}
                              <span className="bellDropdown__itemTime">{relativeTime(ev.time)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="bellDropdown__footer">
                    <button onClick={() => { setBellOpen(false); navigate('/app/records') }}>
                      Xem tất cả record →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User pill + dropdown */}
            <div className={`userPill${menuOpen ? ' open' : ''}`}
              ref={pillRef}
              onClick={() => setMenuOpen(v => !v)}
            >
              <div className="userAvatar">{initials}</div>
              <div className="userInfo">
                <div className="userName">{user?.name ?? 'User'}</div>
                <div className="userRole">{user?.role ?? '—'}</div>
              </div>
              <span className="pillChevron"><IconChevronDown /></span>

              {menuOpen && (
                <div className="userDropdown" onClick={e => e.stopPropagation()}>
                  <button className="dropdownItem" disabled style={{ opacity: .55, cursor: 'default' }}>
                    <IconUser /> Hồ sơ cá nhân
                  </button>
                  <hr className="dropdownDivider" />
                  <button className="dropdownItem dropdownItem--danger" onClick={handleLogout}>
                    <IconLogout /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="content">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="footer">
          <span>© 2026 BBO Technology<span className="sep">·</span>Hệ thống nội bộ</span>
          <span className="version">Version 1.0.3</span>
        </footer>
      </div>
    </div>
  )
}
