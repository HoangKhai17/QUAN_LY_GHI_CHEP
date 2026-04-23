import api from './api'

export async function getDashboardSummary() {
  const { data } = await api.get('/api/dashboard/summary')
  return data
}

// 14-day activity chart — not in API, use mock bars
export function getMockActivityChart() {
  return [48, 72, 44, 101, 81, 117, 92, 108, 132, 107, 123, 98, 137, 111]
}
