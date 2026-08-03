import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './api'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

interface UseApiOptions {
  /** Skip fetching entirely while false — e.g. a role that can't see a given nav badge shouldn't call its endpoint. */
  enabled?: boolean
}

/** Fetches `path` on mount and whenever `deps` change; re-runs on demand via refetch(). */
export function useApi<T>(path: string, deps: unknown[] = [], options: UseApiOptions = {}): UseApiResult<T> {
  const enabled = options.enabled ?? true
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<T>(path)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [path, tick, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => load(), [load, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: () => setTick((t) => t + 1) }
}
