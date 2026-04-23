import { create } from 'zustand'
import { apiLogin, apiLogout } from '../services/api'

function loadFromStorage() {
  try {
    return {
      accessToken:  localStorage.getItem('access_token')  || null,
      refreshToken: localStorage.getItem('refresh_token') || null,
      user:         JSON.parse(localStorage.getItem('user') || 'null'),
    }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

function saveToStorage(accessToken, refreshToken, user) {
  localStorage.setItem('access_token',  accessToken)
  localStorage.setItem('refresh_token', refreshToken)
  localStorage.setItem('user',          JSON.stringify(user))
}

function clearStorage() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

const { accessToken, refreshToken, user } = loadFromStorage()

const useAuthStore = create((set, get) => {
  // Lắng nghe event từ api.js khi silent refresh thành công
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:tokens-refreshed', (e) => {
      const { accessToken: newAccess, refreshToken: newRefresh } = e.detail
      // Chỉ cập nhật token, giữ nguyên user info
      saveToStorage(newAccess, newRefresh, get().user)
      set({ accessToken: newAccess, refreshToken: newRefresh, isLoggedIn: true })
    })

    // Lắng nghe event khi refresh thất bại (token bị revoke / hết hạn)
    window.addEventListener('auth:session-expired', () => {
      clearStorage()
      set({ accessToken: null, refreshToken: null, user: null, isLoggedIn: false, error: null })
    })
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn: !!accessToken,
    loading: false,
    error: null,

    login: async (username, password) => {
      set({ loading: true, error: null })
      try {
        const data = await apiLogin(username, password)
        saveToStorage(data.access_token, data.refresh_token, data.user)
        set({
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          user:         data.user,
          isLoggedIn:   true,
          loading:      false,
          error:        null,
        })
        return { success: true }
      } catch (err) {
        const status  = err.response?.status
        const message = err.response?.data?.error || 'Không thể kết nối tới máy chủ'
        set({ loading: false, error: { message, status } })
        return { success: false, status, message }
      }
    },

    logout: async () => {
      const { refreshToken: rt } = get()
      await apiLogout(rt)
      clearStorage()
      set({ accessToken: null, refreshToken: null, user: null, isLoggedIn: false, error: null })
    },

    clearError: () => set({ error: null }),
  }
})

export default useAuthStore
