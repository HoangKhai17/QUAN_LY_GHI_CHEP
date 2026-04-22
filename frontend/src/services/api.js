import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Đính access token vào mọi request nếu có
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth endpoints ──────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const { data } = await api.post('/api/auth/login', { username, password })
  return data // { access_token, refresh_token, user }
}

export async function apiLogout(refreshToken) {
  try {
    await api.post('/api/auth/logout', { refresh_token: refreshToken })
  } catch {
    // Bỏ qua lỗi logout — vẫn xóa token local
  }
}

export async function apiGetMe() {
  const { data } = await api.get('/api/auth/me')
  return data
}

export default api
