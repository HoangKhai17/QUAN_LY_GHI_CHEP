import api from './api'

export async function getReportsSummary(params = {}) {
  const { data } = await api.get('/api/reports/summary', { params })
  return data
}

export async function getReportsFinancial(params = {}) {
  const { data } = await api.get('/api/reports/financial', { params })
  return data
}

export async function getReportsStaff(params = {}) {
  const { data } = await api.get('/api/reports/staff', { params })
  return data
}

export async function getReportsHeatmap(params = {}) {
  const { data } = await api.get('/api/reports/heatmap', { params })
  return data
}

export async function getReportsQuality(params = {}) {
  const { data } = await api.get('/api/reports/quality', { params })
  return data
}

export async function getReportsSla(params = {}) {
  const { data } = await api.get('/api/reports/sla', { params })
  return data
}

export async function getReportsBacklog(params = {}) {
  const { data } = await api.get('/api/reports/backlog', { params })
  return data
}

export async function getReportsDocTrend(params = {}) {
  const { data } = await api.get('/api/reports/doc-trend', { params })
  return data
}

export async function getReportsAudit(params = {}) {
  const { data } = await api.get('/api/reports/audit', { params })
  return data
}

export async function archiveAuditLogs(months = 12) {
  const { data } = await api.post('/api/reports/audit/archive', {}, { params: { months } })
  return data
}

export async function getAuditLogs(params = {}) {
  const { data } = await api.get('/api/reports/audit/logs', { params })
  return data
}

export async function exportReport(params = {}) {
  const response = await api.get('/api/reports/export', { params, responseType: 'blob' })
  return response
}
