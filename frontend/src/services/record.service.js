import api from './api'

export async function getRecords(params = {}) {
  const { data } = await api.get('/api/records', { params })
  return data // { data: [], total, page, total_pages }
}

export async function getRecordById(id) {
  const { data } = await api.get(`/api/records/${id}`)
  return data
}

export async function updateRecordStatus(id, status, flagReason) {
  const { data } = await api.patch(`/api/records/${id}/status`, {
    status,
    ...(flagReason ? { flag_reason: flagReason } : {}),
  })
  return data
}

export async function updateRecord(id, payload) {
  const { data } = await api.patch(`/api/records/${id}`, payload)
  return data
}

export async function deleteRecord(id) {
  const { data } = await api.delete(`/api/records/${id}`)
  return data
}

export async function createRecord(payload) {
  const { data } = await api.post('/api/records', payload)
  return data
}

export async function getCategories() {
  const { data } = await api.get('/api/categories')
  return data
}

export async function getSenders() {
  const { data } = await api.get('/api/records/senders')
  return data // { data: string[] }
}

export async function getDocumentTypes() {
  const { data } = await api.get('/api/document-types')
  return data // { data: [] }
}

export async function getRecordStats(params = {}) {
  const { data } = await api.get('/api/records/stats', { params })
  return data // { new, reviewed, approved, flagged, total }
}
