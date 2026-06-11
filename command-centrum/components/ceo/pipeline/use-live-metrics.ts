'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveMetrics } from '@/app/api/hd-central/pipeline-state/live-metrics/route'

const ENDPOINT = '/api/hd-central/pipeline-state/live-metrics'
const REFRESH_MS = 10_000

export type { LiveMetrics }

export interface UseLiveMetricsResult {
  data: LiveMetrics | undefined
  error: Error | undefined
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Vanilla polling hook mirroring `usePipelineState`. SWR-shaped surface so a
 * future swap is trivial. Runs faster than the aggregate (10s vs 30s) — see
 * `live-metrics` route cache (5s + 10s SWR).
 */
export function useLiveMetrics(): UseLiveMetricsResult {
  const [data, setData] = useState<LiveMetrics | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to fetch live metrics (${res.status})`)
      const json = (await res.json()) as LiveMetrics
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
