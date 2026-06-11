'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react'
import type { PipelineStageState, ScoutWorkerState, StageId } from '@/lib/hd-central/types'
import { PipelineSpotlight } from './pipeline-spotlight'
import { PipelineStageNode } from './pipeline-stage-node'
import { WorkerCarousel } from './worker-carousel'
import { EntryCloudNode, ExitFeedNode } from './entry-exit-nodes'
import { StagePopover } from './stage-popover'
import { RunFullPipelineButton } from './run-full-pipeline-button'
import { usePipelineState } from './use-pipeline-state'

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export interface PipelineDiagramProps {
  /** Controlled selected stage. When provided, callers own the open/close
   * lifecycle (e.g. to close the dock when the parent section collapses). */
  selectedStageId?: StageId | null
  /** Fires when the user picks a stage node, or when a controlled caller
   * should clear its own state (passes `null`). */
  onSelectStage?: (stageId: StageId | null) => void
  /** When true, the diagram does NOT render its own <StagePopover> dock.
   * The caller is expected to render stage detail itself (e.g. inline below
   * the chain). Selection state is still emitted via `onSelectStage`. */
  inline?: boolean
}

export function PipelineDiagram({
  selectedStageId,
  onSelectStage,
  inline = false,
}: PipelineDiagramProps = {}) {
  const { data, error, isLoading, refresh } = usePipelineState()
  const isControlled = selectedStageId !== undefined
  const [internalSelected, setInternalSelected] = useState<StageId | null>(null)
  const selectedStage = isControlled ? selectedStageId : internalSelected
  const [workersExpanded, setWorkersExpanded] = useState(false)
  const nodeRefs = useRef<Map<StageId, HTMLDivElement | null>>(new Map())
  // 409 too_soon collision → custom in-component confirm modal (replaces the
  // old globalThis.confirm() — PR-7 known limitation). null = no modal open.
  const [pendingTrigger, setPendingTrigger] = useState<
    { stage: PipelineStageState; retryAfterSec: number } | null
  >(null)
  const confirmModalRef = useRef<HTMLDivElement>(null)
  const confirmLastFocusedRef = useRef<HTMLElement | null>(null)
  const confirmTitleId = useId()

  const stages = useMemo(
    () => (data?.stages ?? []).slice().sort((a, b) => a.index - b.index),
    [data?.stages],
  )
  const workers = data?.workers ?? []
  const activeRunSet = useMemo(
    () => new Set((data?.activeRuns ?? []).map((r) => r.stage)),
    [data?.activeRuns],
  )

  const handleSelectStage = useCallback((stage: PipelineStageState) => {
    if (!isControlled) setInternalSelected(stage.id)
    onSelectStage?.(stage.id)
  }, [isControlled, onSelectStage])

  const handleClosePopover = useCallback(() => {
    if (!isControlled) setInternalSelected(null)
    onSelectStage?.(null)
  }, [isControlled, onSelectStage])

  /** Reads a numeric retryAfterSec from a 409 body. The trigger route nests
   * it under error.details; tolerate a flat shape too. */
  const parseRetryAfter = (body: unknown): number => {
    if (typeof body === 'object' && body !== null) {
      const b = body as { retryAfterSec?: unknown; error?: { details?: { retryAfterSec?: unknown } } }
      const nested = b.error?.details?.retryAfterSec
      if (typeof nested === 'number') return nested
      if (typeof b.retryAfterSec === 'number') return b.retryAfterSec
    }
    return 300
  }

  const handleTrigger = useCallback(async (stage: PipelineStageState, force = false) => {
    if (!stage.manualTriggerEndpoint) return
    const qs = force ? '?force=true' : ''
    try {
      const res = await fetch(
        `/api/hd-central/pipeline-state/stage/${encodeURIComponent(stage.id)}/trigger${qs}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      )
      if (res.status === 409 && !force) {
        const body: unknown = await res.json().catch(() => ({}))
        // Surface a custom in-component modal instead of globalThis.confirm().
        setPendingTrigger({ stage, retryAfterSec: parseRetryAfter(body) })
        return
      }
      void refresh()
    } catch (e) {
      console.warn('[pipeline-diagram] trigger failed', e)
    }
  }, [refresh])

  const handleConfirmForce = useCallback(() => {
    const pending = pendingTrigger
    if (!pending) return
    setPendingTrigger(null)
    void handleTrigger(pending.stage, true)
  }, [pendingTrigger, handleTrigger])

  const handleCancelTrigger = useCallback(() => {
    setPendingTrigger(null)
  }, [])

  // Focus management for the too_soon confirm modal (pattern from actions-tab).
  useEffect(() => {
    if (!pendingTrigger) return
    confirmLastFocusedRef.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const dlg = confirmModalRef.current
      if (!dlg) return
      const firstBtn = dlg.querySelector<HTMLElement>('button')
      ;(firstBtn ?? dlg).focus()
    }, 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPendingTrigger(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const prev = confirmLastFocusedRef.current
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [pendingTrigger])

  // Cross-link from MissionCentrum → focus a specific stage node. Triggered by
  // window.dispatchEvent(new CustomEvent('hd:focus-stage', { detail: { stageId } })).
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ stageId: string }>
      const stageId = ce.detail?.stageId as StageId | undefined
      if (!stageId) return
      const el = nodeRefs.current.get(stageId)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      el.classList.add('hd-stage-flash')
      window.setTimeout(() => el.classList.remove('hd-stage-flash'), 800)
    }
    window.addEventListener('hd:focus-stage', handler)
    return () => window.removeEventListener('hd:focus-stage', handler)
  }, [])

  const handleWorkerTrigger = useCallback(async (w: ScoutWorkerState) => {
    if (!w.manualTriggerEndpoint) return
    try {
      await fetch(w.manualTriggerEndpoint, { method: 'POST' })
      void refresh()
    } catch (e) {
      console.warn('[pipeline-diagram] worker trigger failed', e)
    }
  }, [refresh])

  const selectedStageObj = selectedStage
    ? stages.find((s) => s.id === selectedStage) ?? null
    : null

  const summary = data ? (
    <>
      <span className="text-[#1AEE99]">{data.stages.length}</span> stages ·{' '}
      <span className="text-[#1AEE99]">{data.workers.length}</span> workers · health{' '}
      <span className="text-[#1AEE99]">{data.health.green}g</span>{' '}
      <span className="text-[#F59E0B]">{data.health.amber}a</span>{' '}
      <span className="text-[#FF6B6B]">{data.health.red}r</span>
      {data.lastSyncAt && (
        <>
          {' · sync '}
          <span className="text-[#A8A8A8]">{timeAgo(data.lastSyncAt)}</span>
        </>
      )}
    </>
  ) : (
    <span className="text-[#6E6E6E]">loading…</span>
  )

  return (
    <div className="relative overflow-hidden">
      <PipelineSpotlight intensity={0.10} spreadPct={70} />

      {/* Inline header strip (CollapsibleSection owns outer header) */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-4 py-2">
        <span className="text-[10px] font-mono text-[#A8A8A8]">{summary}</span>
        <div className="ml-auto flex items-center gap-2">
          <RunFullPipelineButton onComplete={() => void refresh()} />
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh pipeline state"
            className="inline-flex h-7 items-center gap-1 rounded border border-white/[0.10] px-2 text-[10px] uppercase tracking-widest text-[#A8A8A8] transition-colors hover:border-[#00E085]/40 hover:text-[#1AEE99] focus:outline-2 focus:outline-[#00E085]/60"
          >
            <RefreshCw aria-hidden className="h-3 w-3" />
            refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 px-4 py-4">
        {isLoading && !data && (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="flex h-[160px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.04] motion-safe:animate-pulse"
              >
                <span className="text-[10px] font-mono text-[#4A4A4A]">loading stage {i + 1}…</span>
                <span className="h-6 w-24 rounded bg-white/[0.06]" />
                <span className="h-2 w-16 rounded bg-white/[0.05]" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-3 py-2 text-[11px] text-[#FFB3B3]">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            <span>Failed to load pipeline state.</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-auto rounded border border-white/[0.15] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#E8E8E8] hover:bg-white/[0.06]"
            >
              retry
            </button>
          </div>
        )}

        {data && stages.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-[#6E6E6E]">
            No pipeline stages configured.
          </div>
        )}

        {data && stages.length > 0 && (
          <>
            <div className="relative">
              <div className="flex items-stretch gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                <EntryCloudNode />
                <ChainArrow />
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-stretch gap-2">
                    <PipelineStageNode
                      ref={(el) => {
                        nodeRefs.current.set(stage.id, el)
                      }}
                      stage={stage}
                      selected={selectedStage === stage.id}
                      onSelect={() => handleSelectStage(stage)}
                      onTrigger={() => handleTrigger(stage)}
                      onExpandWorkers={
                        stage.id === 'scout' ? () => setWorkersExpanded((v) => !v) : undefined
                      }
                      workersExpanded={stage.id === 'scout' ? workersExpanded : undefined}
                      active={activeRunSet.has(stage.id)}
                    />
                    {i < stages.length - 1 && <ChainArrow />}
                  </div>
                ))}
                <ChainArrow />
                <ExitFeedNode />
              </div>
              {/* Edge fade hints — signal that more content scrolls */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-10"
                style={{ background: 'linear-gradient(to right, #0F0F0F, transparent)' }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-10"
                style={{ background: 'linear-gradient(to left, #0F0F0F, transparent)' }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-[#A8A8A8]"
              >
                scroll →
              </span>
            </div>

            <WorkerCarousel
              workers={workers}
              expanded={workersExpanded}
              onWorkerTrigger={handleWorkerTrigger}
            />
          </>
        )}
      </div>

      {!inline && selectedStageObj && (
        <StagePopover
          stage={selectedStageObj}
          open={!!selectedStage}
          onClose={handleClosePopover}
        />
      )}

      {/* 409 too_soon confirm modal — replaces globalThis.confirm() (PR-7).
          Pattern mirrors actions-tab.tsx too_soon_confirm. */}
      {pendingTrigger && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={handleCancelTrigger}
        >
          <style>{`
            @keyframes hdTriggerFade {
              from { opacity: 0; transform: translateY(-2px) }
              to   { opacity: 1; transform: translateY(0) }
            }
            @media (prefers-reduced-motion: reduce) {
              .hd-trigger-modal { animation: none !important }
            }
          `}</style>
          <div
            ref={confirmModalRef}
            role="alertdialog"
            aria-labelledby={confirmTitleId}
            aria-modal="true"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="hd-trigger-modal plastic-card-hi w-80 rounded-md border border-[#F59E0B]/50 bg-[#0F0F0F] px-3 py-2.5 outline-none"
            style={{ animation: 'hdTriggerFade 120ms ease-out' }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#F59E0B]" />
              <div className="flex-1">
                <h4 id={confirmTitleId} className="text-[12px] font-semibold text-[#F59E0B]">
                  Recent run detected
                </h4>
                <p className="mt-0.5 text-[11px] text-[#E8E8E8]">
                  Stage {pendingTrigger.stage.displayName} ran less than 5 min ago (retry in{' '}
                  <span className="font-mono">{pendingTrigger.retryAfterSec}s</span>). Run anyway?
                </p>
                <p className="mt-0.5 text-[10px] text-[#6E6E6E]">
                  Force run skips the 5min guard.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelTrigger}
                    className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-[#A8A8A8] transition-colors hover:border-white/[0.15] hover:text-[#E8E8E8] focus:outline-2 focus:outline-white/40 focus:outline-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmForce}
                    className="inline-flex items-center rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20 focus:outline-2 focus:outline-[#F59E0B]/60 focus:outline-offset-2"
                  >
                    Force run
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChainArrow() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      <ArrowRight className="h-4 w-4 text-[#00E085]" style={{ filter: 'drop-shadow(0 0 4px rgba(0,224,133,0.5))' }} />
    </div>
  )
}
