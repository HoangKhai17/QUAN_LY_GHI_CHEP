import { create } from 'zustand'

export function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 10)   return 'Vừa xong'
  if (diff < 60)   return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

const useNotificationStore = create((set) => ({
  pendingCount: 0,
  events: [],          // [{id, type, record, time}] — last 20

  setPendingCount: (n) => set({ pendingCount: Math.max(0, n ?? 0) }),

  // Called when socket emits 'new_record'
  pushNewRecord: (payload) => set((state) => ({
    pendingCount: payload.pending ?? state.pendingCount + 1,
    events: [
      {
        id:     Date.now() + Math.random(),
        type:   'new_record',
        record: payload.record,
        time:   new Date().toISOString(),
      },
      ...state.events,
    ].slice(0, 20),
  })),

  // Called when socket emits 'record_updated' (approve/flag/review)
  syncPending: (pending) => set((state) => ({
    pendingCount: pending ?? state.pendingCount,
  })),

  clearEvents: () => set({ events: [] }),
}))

export default useNotificationStore
