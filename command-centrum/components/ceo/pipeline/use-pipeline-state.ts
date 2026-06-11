'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipelineAggregate } from '@/lib/hd-central/types'

const ENDPOINT = '/api/hd-central/pipeline-state/aggregate'
const REFRESH_MS = 30_000

export interface UsePipelineStateResult {
  data: PipelineAggregate | undefined
  error: Error | undefined
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Vanilla polling hook. SWR not in deps — `swr` would need install.
 * Mirrors SWR shape (data/error/isLoading/refresh) so PR-5 swap is trivial.
 */
export function usePipelineState(): UsePipelineStateResult {
  const [data, setData] = useState<PipelineAggregate | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to fetch pipeline state (${res.status})`)
      const json = (await res.json()) as PipelineAggregate
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
