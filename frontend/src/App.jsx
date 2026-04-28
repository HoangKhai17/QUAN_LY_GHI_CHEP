import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import ProtectedRoute  from './routes/ProtectedRoute'
import RoleGuard       from './routes/RoleGuard'
import LoginPage       from './pages/Login'
import AppLayout       from './components/AppLayout'
import DashboardPage   from './pages/Dashboard'
import RecordsPage     from './pages/Records'
import DocTypeViewPage from './pages/DocTypeView'
import SettingsPage    from './pages/Settings'
import ReportsPage      from './pages/Reports'
import ActivityLogsPage from './pages/ActivityLogs'
import PlaceholderPage  from './pages/Placeholder'

const ANT_THEME = {
  token: {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
    colorPrimary: '#1f7a43',
    borderRadius: 10,
  },
}

export default function App() {
  return (
    <ConfigProvider theme={ANT_THEME}>
    <BrowserRouter>
      <Routes>
        {/* Redirect root → login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — App shell */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="records"      element={<RecordsPage />} />
          <Route path="doc-types"    element={<DocTypeViewPage />} />
          <Route path="quick-review" element={<PlaceholderPage title="Rà soát nhanh" icon="⚡" phase="Phase 6" />} />
          <Route path="search"       element={<PlaceholderPage title="Tìm kiếm"       icon="🔍" phase="Phase 7" />} />
          <Route path="reports"       element={<ReportsPage />} />
          <Route path="activity-logs" element={<RoleGuard roles={['admin']}><ActivityLogsPage /></RoleGuard>} />
          <Route path="settings"      element={<RoleGuard roles={['admin','manager']}><SettingsPage /></RoleGuard>} />
          <Route path="*"            element={<Navigate to="/app/dashboard" replace />} />
        </Route>

        {/* Fallback toàn cục */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </ConfigProvider>
  )
}
