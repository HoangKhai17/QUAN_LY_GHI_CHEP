import { useEffect, useState } from 'react'
import useAuthStore from '../../store/auth.store'
import api from '../../services/api'
import './Dashboard.css'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [summary, setSummary] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoadingStats(false))
  }, [])

  const greeting = getGreeting()

  return (
    <div className="dashPage">
      {/* Welcome banner */}
      <div className="welcomeBanner">
        <div className="welcomeText">
          <h2>{greeting}, {user?.name?.split(' ').pop() ?? 'bạn'} 👋</h2>
          <p>Đây là tổng quan hệ thống ghi chép nội bộ BBO Records.</p>
        </div>
        <div className="welcomeBadge">
          <span className="dot" />
          Hệ thống đang hoạt động
        </div>
      </div>

      {/* Summary cards */}
      <div className="statsGrid">
        <StatCard
          label="Hôm nay — Tổng"
          value={loadingStats ? '…' : summary?.today?.total ?? '—'}
          sub="bản ghi nhận được"
          color="#1f8f3a"
        />
        <StatCard
          label="Chờ duyệt"
          value={loadingStats ? '…' : summary?.pending_review ?? '—'}
          sub="cần xem xét"
          color="#fa8c16"
          highlight
        />
        <StatCard
          label="Đã duyệt hôm nay"
          value={loadingStats ? '…' : summary?.today?.approved ?? '—'}
          sub="approved"
          color="#1890ff"
        />
        <StatCard
          label="Tuần này"
          value={loadingStats ? '…' : summary?.this_week?.total ?? '—'}
          sub="bản ghi tổng cộng"
          color="#722ed1"
        />
      </div>

      {/* Placeholder notice */}
      <div className="placeholderNotice">
        <div className="noticeIcon">🚧</div>
        <div className="noticeText">
          <b>Dashboard đang được phát triển.</b><br />
          Các widget chi tiết (danh sách records, biểu đồ, quick review...) sẽ được triển khai ở Phase 4.
          Hiện tại số liệu thống kê đã gọi API thật từ backend.
        </div>
      </div>

      {/* User info debug card */}
      <div className="userDebugCard">
        <div className="debugTitle">Thông tin phiên đăng nhập</div>
        <div className="debugGrid">
          <div><span>User ID</span><code>{user?.id ?? '—'}</code></div>
          <div><span>Tên</span><code>{user?.name ?? '—'}</code></div>
          <div><span>Role</span><code>{user?.role ?? '—'}</code></div>
          <div><span>Đổi mật khẩu</span><code>{user?.must_change_pw ? 'Cần đổi ngay' : 'Đã cập nhật'}</code></div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, highlight }) {
  return (
    <div className={`statCard ${highlight ? 'highlight' : ''}`} style={{ '--accent': color }}>
      <div className="statValue">{value}</div>
      <div className="statLabel">{label}</div>
      <div className="statSub">{sub}</div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Chào buổi sáng'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}
