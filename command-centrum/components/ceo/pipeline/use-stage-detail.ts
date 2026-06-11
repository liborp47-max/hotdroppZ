'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PipelineStageState, StageId } from '@/lib/hd-central/types'

export interface StageHistoryEntry {
  ts: string
  event: string
  note?: string
}

export interface StageRecentRun {
  runId: string
  startedAt: string
  finishedAt?: string
  status: string
  itemsProcessed?: number
  errorsCount?: number
}

export interface StageDetail {
  stage: PipelineStageState
  history: StageHistoryEntry[]
  recentRuns: StageRecentRun[]
}

export interface UseStageDetailResult {
  data: StageDetail | null
  error: Error | null
  isLoading: boolean
  /** Force a refetch (e.g. after a successful manual trigger). No-op when stageId is null. */
  refresh: () => void
}

export function useStageDetail(stageId: StageId | null): UseStageDetailResult {
  const [data, setData] = useState<StageDetail | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reload, setReload] = useState(0)

  const refresh = useCallback(() => {
    if (!stageId) return
    setReload((n) => n + 1)
  }, [stageId])

  useEffect(() => {
    if (!stageId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/hd-central/pipeline-state/stage/${encodeURIComponent(stageId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: StageDetail) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e)
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stageId, reload])

  return { data, error, isLoading, refresh }
}
