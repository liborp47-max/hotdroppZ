'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlertsResponse } from '@/app/api/hd-central/alerts/route'

const ENDPOINT = '/api/hd-central/alerts'
// 30s — alerts shift slower than live-metrics (10s); 15s server cache absorbs it.
const REFRESH_MS = 30_000

export type { AlertsResponse }

export interface UseAlertsResult {
  data: AlertsResponse | undefined
  error: Error | undefined
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Vanilla polling hook for the alert center. Mirrors `useLiveMetrics` but at a
 * slower 30s cadence — see the `/api/hd-central/alerts` route cache (15s).
 */
export function useAlerts(): UseAlertsResult {
  const [data, setData] = useState<AlertsResponse | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to fetch alerts (${res.status})`)
      const json = (await res.json()) as AlertsResponse
      if (!mountedRef.current) return
      setData(json)
      setError(undefined)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchOnce()
    const id = window.setInterval(() => {
      void fetchOnce()
    }, REFRESH_MS)

    const onFocus = () => { void fetchOnce() }
    const onOnline = () => { void fetchOnce() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      mountedRef.current = false
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [fetchOnce])

  const refresh = useCallback(async () => {
    await fetchOnce()
  }, [fetchOnce])

  return { data, error, isLoading, refresh }
}
