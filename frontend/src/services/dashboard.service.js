import api from './api'

export async function getDashboardSummary() {
  const { data } = await api.get('/api/dashboard/summary')
  return data
}

export async function getReportsSummary(params = {}) {
  const { data } = await api.get('/api/reports/summary', { params })
  return data
}
