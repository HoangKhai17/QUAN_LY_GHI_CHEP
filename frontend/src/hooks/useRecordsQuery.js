import { useState, useEffect, useCallback } from 'react'
import { getRecords } from '../services/record.service'

export default function useRecordsQuery(initialFilters = {}, limit = 10) {
  const [records, setRecords] = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchRecords = useCallback(async (pg, flt) => {
    setLoading(true)
    try {
      const data = await getRecords({ ...flt, page: pg, limit })
      setRecords(data.data ?? [])
      setTotal(data.total ?? 0)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchRecords(page, filters)
  }, [page, filters, fetchRecords])

  function updateFilters(patch) {
    setFilters(prev => ({ ...prev, ...patch }))
    setPage(1)
  }

  function resetFilters() {
    setFilters(initialFilters)
    setPage(1)
  }

  function updateRecord(id, patch) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function removeRecord(id) {
    setRecords(prev => prev.filter(r => r.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  return {
    records, total, page, filters, loading, error,
    setPage, updateFilters, resetFilters,
    updateRecord, removeRecord,
    refetch: () => fetchRecords(page, filters),
  }
}
