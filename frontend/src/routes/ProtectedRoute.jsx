import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/auth.store'

export default function ProtectedRoute({ children }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return children
}
