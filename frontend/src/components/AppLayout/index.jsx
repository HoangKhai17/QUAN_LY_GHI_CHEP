import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/auth.store'
import logoImg from '../../assets/logo.png'
import './AppLayout.css'

// ── Nav icons ────────────────────────────────────────────────────────────────
function IconGrid() {
  return <svg className="navIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
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
function IconBell() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}

const NAV_ITEMS = [
  { to: '/app/dashboard',    label: 'Dashboard',      Icon: IconGrid   },
  { to: '/app/quick-review', label: 'Rà soát nhanh',  Icon: IconZap    },
  { to: '/app/search',       label: 'Tìm kiếm',       Icon: IconSearch },
  { to: '/app/reports',      label: 'Báo cáo',         Icon: IconChart  },
]

const PAGE_TITLES = {
  '/app/dashboard':    'Dashboard',
  '/app/quick-review': 'Rà soát nhanh',
  '/app/search':       'Tìm kiếm',
  '/app/reports':      'Báo cáo',
}

export default function AppLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()

  const title = PAGE_TITLES[location.pathname] ?? 'BBO Records'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Lấy chữ cái đầu tên làm avatar
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : '??'

  return (
    <div className="appShell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebarBrand">
          <div className="sidebarLogoWrap">
            <img src={logoImg} alt="BBO" />
          </div>
          <div className="sidebarBrandText">
            <div className="name">BBO Records</div>
            <div className="sub">Internal System</div>
          </div>
        </div>

        <nav className="sidebarNav">
          <div className="navSection">
            <div className="navSectionLabel">Menu chính</div>
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `navItem${isActive ? ' active' : ''}`}
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebarFooter">v1.0.3 · STAGING</div>
      </aside>

      {/* ── Main area ── */}
      <div className="mainArea">
        {/* Header */}
        <header className="header">
          <div className="headerTitle">{title}</div>

          <div className="headerMeta">
            {/* Bell placeholder */}
            <div className="bell" title="Thông báo (coming soon)">
              <IconBell />
            </div>

            {/* User info */}
            <div className="headerUser">
              <div className="userAvatar">{initials}</div>
              <div>
                <div className="userName">{user?.name ?? 'User'}</div>
              </div>
              <span className="userRole">{user?.role ?? '—'}</span>
            </div>

            {/* Logout */}
            <button className="btnLogout" onClick={handleLogout}>
              <IconLogout />
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Content — mỗi page render vào đây qua <Outlet> */}
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
