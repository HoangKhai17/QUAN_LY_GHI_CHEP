import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute  from './routes/ProtectedRoute'
import LoginPage       from './pages/Login'
import AppLayout       from './components/AppLayout'
import DashboardPage   from './pages/Dashboard'
import RecordsPage     from './pages/Records'
import PlaceholderPage from './pages/Placeholder'

export default function App() {
  return (
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
          <Route path="quick-review" element={<PlaceholderPage title="Rà soát nhanh" icon="⚡" phase="Phase 6" />} />
          <Route path="search"       element={<PlaceholderPage title="Tìm kiếm"       icon="🔍" phase="Phase 7" />} />
          <Route path="reports"      element={<PlaceholderPage title="Báo cáo"         icon="📊" phase="Phase 8" />} />
          <Route path="*"            element={<Navigate to="/app/dashboard" replace />} />
        </Route>

        {/* Fallback toàn cục */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
