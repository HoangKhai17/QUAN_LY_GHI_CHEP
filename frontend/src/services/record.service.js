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

export async function getCategories() {
  const { data } = await api.get('/api/categories')
  return data
}
