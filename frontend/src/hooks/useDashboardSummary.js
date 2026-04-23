import { useState, useEffect, useCallback } from 'react'
import { getDashboardSummary } from '../services/dashboard.service'

export default function useDashboardSummary(pollInterval = 30_000) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    try {
      const data = await getDashboardSummary()
      setSummary(data)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, pollInterval)
    return () => clearInterval(id)
  }, [fetch, pollInterval])

  return { summary, loading, error, refetch: fetch }
}
