import { useState, useCallback } from 'react'
import { getRecordById } from '../services/record.service'

export default function useRecordDetail() {
  const [record,  setRecord]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const openById = useCallback(async (id) => {
    setLoading(true)
    setRecord(null)
    setError(null)
    try {
      const data = await getRecordById(id)
      setRecord(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const close   = useCallback(() => { setRecord(null); setError(null) }, [])
  const update  = useCallback((patch) => setRecord(prev => prev ? { ...prev, ...patch } : prev), [])
  const refetch = useCallback(async () => {
    setRecord(prev => {
      if (!prev?.id) return prev
      getRecordById(prev.id).then(setRecord).catch(() => {})
      return prev
    })
  }, [])

  return { record, loading, error, openById, close, update, refetch }
}
