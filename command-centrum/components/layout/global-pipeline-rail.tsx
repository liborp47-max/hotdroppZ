'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { LivePipelinePanel } from '@/components/hdcc/live-pipeline-panel'
import { getState, subscribe, startRun, stopRun, resetProcess } from '@/lib/stores/process-store'

export function GlobalPipelineRail() {
  const state = useSyncExternalStore(subscribe, getState, getState)

  const handleStart = useCallback(() => {
    void startRun()
  }, [])

  const handleStop = useCallback(() => {
    stopRun()
  }, [])

  const handleNuke = useCallback(() => {
    resetProcess()
  }, [])

  return (
    <aside className="hidden xl:block xl:w-80 xl:shrink-0 border-l border-white/[0.06] bg-black/60 backdrop-blur-2xl backdrop-saturate-150">
      <LivePipelinePanel state={state} onStart={handleStart} onStop={handleStop} onNuke={handleNuke} />
    </aside>
  )
}
