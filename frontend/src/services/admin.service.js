import api from './api'

// ── Users ──────────────────────────────────────────────────────────────────────
export async function getUsers(params = {}) {
  const { data } = await api.get('/api/users', { params })
  return data // { data: [], total, page }
}

export async function createUser(payload) {
  const { data } = await api.post('/api/users', payload)
  return data // { id, username, name, role, is_active, temp_password? }
}

export async function setUserActive(id, is_active) {
  const { data } = await api.patch(`/api/users/${id}/activate`, { is_active })
  return data
}

export async function resetUserPassword(id) {
  const { data } = await api.post(`/api/users/${id}/reset-password`)
  return data // { temp_password }
}

export async function changeUserRole(id, role) {
  const { data } = await api.patch(`/api/users/${id}/role`, { role })
  return data
}

// ── Document Types ─────────────────────────────────────────────────────────────
export async function getDocumentTypesAll() {
  const { data } = await api.get('/api/document-types', { params: { include_inactive: 'true' } })
  return data // { data: [] }
}

export async function getDocumentTypeFields(id) {
  const { data } = await api.get(`/api/document-types/${id}/fields`)
  return data // { data: [] }
}

export async function createDocumentType(payload) {
  const { data } = await api.post('/api/document-types', payload)
  return data
}

export async function updateDocumentType(id, payload) {
  const { data } = await api.patch(`/api/document-types/${id}`, payload)
  return data
}

export async function addDocumentTypeField(typeId, payload) {
  const { data } = await api.post(`/api/document-types/${typeId}/fields`, payload)
  return data // field object
}

export async function updateDocumentTypeField(typeId, fieldId, payload) {
  const { data } = await api.patch(`/api/document-types/${typeId}/fields/${fieldId}`, payload)
  return data
}

export async function deleteDocumentTypeField(typeId, fieldId) {
  const { data } = await api.delete(`/api/document-types/${typeId}/fields/${fieldId}`)
  return data
}

// ── Categories ─────────────────────────────────────────────────────────────────
export async function getCategoriesAll() {
  const { data } = await api.get('/api/categories', { params: { include_inactive: 'true' } })
  return data // { data: [] }
}

export async function createCategory(payload) {
  const { data } = await api.post('/api/categories', payload)
  return data
}

export async function updateCategory(id, payload) {
  const { data } = await api.put(`/api/categories/${id}`, payload)
  return data
}

// ── System Settings ────────────────────────────────────────────────────────────
export async function getSettings() {
  const { data } = await api.get('/api/settings')
  return data // { data: { [key]: { value, is_set, is_secret, source, description, updated_at } } }
}

export async function updateSetting(key, value) {
  const { data } = await api.patch(`/api/settings/${key}`, { value })
  return data
}

export async function clearSetting(key) {
  const { data } = await api.delete(`/api/settings/${key}`)
  return data
}

// ── Database Backup ────────────────────────────────────────────────────────────
export async function listBackups() {
  const { data } = await api.get('/api/backup')
  return data // { data: [{ filename, size_bytes, size_label, created_at }] }
}

export async function createBackup() {
  const { data } = await api.post('/api/backup')
  return data // { data: { filename, size_bytes, size_label, created_at } }
}

export async function downloadBackup(filename) {
  const response = await api.get(`/api/backup/${encodeURIComponent(filename)}/download`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/octet-stream' }))
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function deleteBackup(filename) {
  const { data } = await api.delete(`/api/backup/${encodeURIComponent(filename)}`)
  return data
}
