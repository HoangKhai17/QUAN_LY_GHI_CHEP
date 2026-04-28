import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/auth.store'

/**
 * Chặn truy cập trang dựa trên role của user.
 * Nếu user.role không nằm trong danh sách roles → hiển thị trang "Không có quyền".
 *
 * Dùng trong App.jsx:
 *   <RoleGuard roles={['admin', 'manager']}>
 *     <SettingsPage />
 *   </RoleGuard>
 */
export default function RoleGuard({ roles = [], children }) {
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()

  const hasAccess = user && roles.includes(user.role)

  if (!hasAccess) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        textAlign: 'center',
        padding: 40,
      }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.2px' }}>
          Không có quyền truy cập
        </div>
        <div style={{
          fontSize: 13.5,
          color: 'var(--ink3)',
          maxWidth: 360,
          lineHeight: 1.65,
        }}>
          Trang này yêu cầu quyền{' '}
          <strong>{roles.join(' hoặc ')}</strong>.{' '}
          Tài khoản hiện tại của bạn ({user?.role ?? 'không xác định'}) không đủ điều kiện.
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: 8,
            height: 38,
            padding: '0 24px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(31,122,67,.08)',
            border: '1.5px solid var(--primary)',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          ← Quay lại
        </button>
      </div>
    )
  }

  return children
}
