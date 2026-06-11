'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

export type StepStatus = 'idle' | 'running' | 'done' | 'error'

export type PipelineLogEntry = {
  id: number
  ts: number
  level: 'info' | 'success' | 'error' | 'source'
  message: string
}

export type PipelineRunResult = {
  itemsFound: number
  curatedItems: number
  clusteredStories: number
  enrichedClusters: number
  writtenPosts: number
  localizedPosts: number
  durationMs: number
  sourceErrors: number
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    calls: number
    estimatedCostUsd: number
  }
}

export type PipelineState = {
  isRunning: boolean
  stepStatuses: Record<string, StepStatus>
  logs: PipelineLogEntry[]
  result: PipelineRunResult | null
  error: string | null
  activeRunId: string | null
  startedAt: number | null
}

type PipelineContextValue = PipelineState & {
  start: () => void
  stop: () => void
  setStep: (key: string, status: StepStatus) => void
  pushLog: (level: PipelineLogEntry['level'], message: string) => void
  setResult: (result: PipelineRunResult) => void
  setError: (error: string) => void
  setActiveRunId: (id: string) => void
  reset: () => void
}

const INITIAL: PipelineState = {
  isRunning: false,
  stepStatuses: {},
  logs: [],
  result: null,
  error: null,
  activeRunId: null,
  startedAt: null,
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PipelineState>(INITIAL)
  const logIdRef = useRef(0)

  const start = useCallback(() => {
    setState({ ...INITIAL, isRunning: true, startedAt: Date.now() })
  }, [])

  const stop = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const setStep = useCallback((key: string, status: StepStatus) => {
    setState((prev) => ({
      ...prev,
      stepStatuses: { ...prev.stepStatuses, [key]: status },
    }))
  }, [])

  const pushLog = useCallback((level: PipelineLogEntry['level'], message: string) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, { id: logIdRef.current++, ts: Date.now(), level, message }],
    }))
  }, [])

  const setResult = useCallback((result: PipelineRunResult) => {
    setState((prev) => ({ ...prev, result, isRunning: false }))
  }, [])

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error, isRunning: false }))
  }, [])

  const setActiveRunId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeRunId: id }))
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL)
  }, [])

  return (
    <PipelineContext.Provider
      value={{ ...state, start, stop, setStep, pushLog, setResult, setError, setActiveRunId, reset }}
    >
      {children}
    </PipelineContext.Provider>
  )
}

export function usePipeline() {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error('usePipeline must be used inside <PipelineProvider>')
  return ctx
}
