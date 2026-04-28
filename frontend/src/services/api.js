import axios from 'axios'
import notify from '../utils/notify'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: đính access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Silent token refresh ─────────────────────────────────────────────────────
// Dùng biến module-level để tránh gửi nhiều refresh request khi nhiều call cùng lúc 401
let isRefreshing = false
let pendingQueue = [] // [{ resolve, reject }]

function flushQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  )
  pendingQueue = []
}

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    const status          = error.response?.status

    // Bỏ qua các endpoint auth để tránh vòng lặp vô hạn
    const isAuthEndpoint  = originalRequest.url?.includes('/api/auth/')
    const isExportRequest = originalRequest.responseType === 'blob'
    const is401 = status === 401

    if (!is401 || isAuthEndpoint || originalRequest._retry) {
      // ── Hiển thị thông báo toàn cục cho các lỗi đặc thù ──────────────────
      if (!isAuthEndpoint) {
        if (status === 403) {
          // Thử đọc error message từ body (kể cả blob)
          let detail = null
          if (isExportRequest && error.response?.data instanceof Blob) {
            try {
              const txt = await error.response.data.text()
              detail = JSON.parse(txt).error
            } catch {}
          } else {
            detail = error.response?.data?.error
          }
          notify.permissionDenied(detail)
        } else if (status === 429) {
          const retryAfter = error.response?.headers?.['retry-after']
          notify.rateLimit(retryAfter)
        } else if (status >= 500) {
          let detail = null
          if (!isExportRequest) detail = error.response?.data?.error
          notify.serverError(detail)
        } else if (!status) {
          // Lỗi mạng / timeout — không có HTTP response
          notify.networkError()
        }
      }
      return Promise.reject(error)
    }

    // Nếu đang có refresh request khác, queue request này lại
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then(newToken => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      flushQueue(error, null)
      isRefreshing = false
      _forceLogout()
      return Promise.reject(error)
    }

    try {
      // Dùng axios thuần (không phải instance api) để tránh interceptor loop
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      })

      const { access_token: newAccessToken, refresh_token: newRefreshToken } = data

      // Cập nhật localStorage — request interceptor sẽ đọc token mới cho request sau
      localStorage.setItem('access_token', newAccessToken)
      localStorage.setItem('refresh_token', newRefreshToken)

      // Thông báo để auth store cập nhật state (không import store trực tiếp → tránh circular dep)
      window.dispatchEvent(new CustomEvent('auth:tokens-refreshed', {
        detail: { accessToken: newAccessToken, refreshToken: newRefreshToken },
      }))

      // Giải phóng các request đang chờ
      flushQueue(null, newAccessToken)

      // Retry request gốc với token mới
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)

    } catch (refreshError) {
      // Refresh thất bại → phiên hết hạn hoặc token bị revoke
      flushQueue(refreshError, null)
      _forceLogout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

function _forceLogout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  window.dispatchEvent(new CustomEvent('auth:session-expired'))
  // Delay nhỏ để event kịp xử lý trước khi redirect
  setTimeout(() => {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login')
    }
  }, 100)
}

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
