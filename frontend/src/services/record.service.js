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

export async function createRecord(payload, files = []) {
  const form = new FormData()
  if (payload.note)             form.append('note',             payload.note)
  if (payload.category_id)      form.append('category_id',      payload.category_id)
  if (payload.document_type_id) form.append('document_type_id', payload.document_type_id)
  if (payload.platform)         form.append('platform',         payload.platform)
  if (payload.sender_name)      form.append('sender_name',      payload.sender_name)
  if (payload.sender_id)        form.append('sender_id',        payload.sender_id)
  files.forEach(file => form.append('images', file))
  const { data } = await api.post('/api/records', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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

export async function getRecordYears() {
  const { data } = await api.get('/api/records/years')
  return data // { data: number[] }
}

export async function getDocumentTypes() {
  const { data } = await api.get('/api/document-types')
  return data // { data: [] }
}

export async function getUsers() {
  const { data } = await api.get('/api/users/list')
  return data // { data: [{id, name, username, role}] }
}

export async function getRecordStats(params = {}) {
  const { data } = await api.get('/api/records/stats', { params })
  return data // { new, reviewed, approved, flagged, total }
}
