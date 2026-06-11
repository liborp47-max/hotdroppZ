'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, XCircle } from 'lucide-react'
import type { StageId } from '@/lib/hd-central/types'

// ─────────────────────────────────────────────────────────────────────────────
// RunFullPipelineButton
// Consolidated control: triggers all 9 active pipeline stages sequentially.
// Skips retired `translator` and auto-only `droppz-detector`.
// Fail-fast: a failed stage stops the sequence. 409 too_soon is auto-forced
// (the operator already confirmed the whole run via the modal).
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical full-run order — see lib/hd-central/stage-table.ts (STAGE_TABLE).
 * `translator` (retired) and `droppz-detector` (auto-only) are intentionally
 * excluded. */
const FULL_RUN_STAGES: { id: StageId; label: string }[] = [
  { id: 'scout', label: 'Scout' },
  { id: 'filter', label: 'Filter' },
  { id: 'curator', label: 'Curator' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'enrichment', label: 'Enrichment' },
  { id: 'writer', label: 'Writer' },
  { id: 'feed-engine', label: 'Feed Engine' },
  { id: 'multilang', label: 'Multilang' },
  { id: 'monetizer', label: 'Monetizer' },
]

const TOTAL = FULL_RUN_STAGES.length
/** Rough estimate shown in the confirm modal — informational only. */
const EST_DURATION_LABEL = '~3-6 min'

type RunState = 'idle' | 'confirm' | 'running' | 'done' | 'failed'

interface TriggerErrorBody {
  error?: { code?: string; message?: string }
}

interface RunFullPipelineButtonProps {
  /** Called once the whole sequence settles (success or failure) so the host
   * can refresh pipeline state. */
  onComplete?: () => void
}

async function triggerStage(stageId: StageId, force: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  const qs = force ? '?force=true' : ''
  const url = `/api/hd-central/pipeline-state/stage/${encodeURIComponent(stageId)}/trigger${qs}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch (e) {
    return { ok: false, message: (e as Error).message || 'Network error' }
  }

  // 409 too_soon during a full run → retry once with force. The operator
  // confirmed the whole sequence, so the 5-min guard does not apply here.
  if (res.status === 409 && !force) {
    return triggerStage(stageId, true)
  }

  if (!res.ok) {
    const body: TriggerErrorBody = await res.json().catch(() => ({}))
    return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` }
  }
  return { ok: true }
}

export function RunFullPipelineButton({ onComplete }: RunFullPipelineButtonProps = {}) {
  const [runState, setRunState] = useState<RunState>('idle')
  // currentIndex: 0-based index of the stage being triggered while running.
  const [currentIndex, setCurrentIndex] = useState(0)
  // completedCount: number of stages that finished OK (used for the result line).
  const [completedCount, setCompletedCount] = useState(0)
  const [failure, setFailure] = useState<{ index: number; label: string; message: string } | null>(null)

  const modalRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  // Guards against state updates after unmount mid-sequence.
  const aliveRef = useRef(true)
  const confirmTitleId = useId()

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Focus management for the confirm modal (pattern from actions-tab.tsx).
  useEffect(() => {
    if (runState !== 'confirm') return
    lastFocusedRef.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const dlg = modalRef.current
      if (!dlg) return
      const firstBtn = dlg.querySelector<HTMLElement>('button')
      ;(firstBtn ?? dlg).focus()
    }, 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setRunState('idle')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const prev = lastFocusedRef.current
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [runState])

  const runSequence = useCallback(async () => {
    setRunState('running')
    setCurrentIndex(0)
    setCompletedCount(0)
    setFailure(null)

    for (let i = 0; i < FULL_RUN_STAGES.length; i++) {
      if (!aliveRef.current) return
      const stage = FULL_RUN_STAGES[i]
      setCurrentIndex(i)

      const result = await triggerStage(stage.id, false)
      if (!aliveRef.current) return

      if (!result.ok) {
        // Fail-fast: stop the sequence, surface the error, do not continue.
        setFailure({ index: i, label: stage.label, message: result.message })
        setRunState('failed')
        onComplete?.()
        return
      }
      setCompletedCount(i + 1)
    }

    setRunState('done')
    onComplete?.()
  }, [onComplete])

  const handleConfirm = useCallback(() => {
    void runSequence()
  }, [runSequence])

  const handleCancel = useCallback(() => {
    setRunState('idle')
  }, [])

  const handleReset = useCallback(() => {
    setRunState('idle')
    setFailure(null)
  }, [])

  const running = runState === 'running'
  const progressPct = running ? Math.round((currentIndex / TOTAL) * 100) : 0
  const currentStage = FULL_RUN_STAGES[currentIndex]

  return (
    <div className="relative inline-flex items-center">
      <style>{`
        @keyframes hdFullRunFade {
          from { opacity: 0; transform: translateY(-2px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @media (prefers-reduced-motion: reduce) {
          .hd-fullrun-modal { animation: none !important }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setRunState('confirm')}
        disabled={running || runState === 'confirm'}
        aria-label="Run full pipeline"
        className={
          'inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-[10px] uppercase ' +
          'tracking-widest transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-[#00E085]/60 ' +
          (running
            ? 'cursor-not-allowed border-[#00E085]/30 text-[#6E6E6E]'
            : 'border-[#00E085]/40 bg-[#00E085]/10 text-[#1AEE99] hover:bg-[#00E085]/20')
        }
      >
        {running ? (
          <Loader2 aria-hidden className="h-3 w-3 motion-safe:animate-spin text-[#00E085]" />
        ) : (
          <Play aria-hidden className="h-3 w-3 text-[#00E085]" />
        )}
        Run full pipeline
      </button>

      {/* Progress / result line — announced to assistive tech. */}
      <div aria-live="polite" className="ml-2 min-w-0">
        {running && currentStage && (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[10px] font-mono text-[#A8A8A8]">
              Running [{currentIndex + 1}/{TOTAL}] {currentStage.label}…
            </span>
            <span
              aria-hidden
              className="relative inline-block h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[#00E085] motion-safe:transition-[width] motion-safe:duration-300"
                style={{ width: `${progressPct}%`, boxShadow: '0 0 6px rgba(0,224,133,0.6)' }}
              />
            </span>
          </div>
        )}
        {runState === 'done' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#1AEE99]">
            <CheckCircle2 aria-hidden className="h-3 w-3" />
            Pipeline run complete: {completedCount}/{TOTAL} stages
          </span>
        )}
        {runState === 'failed' && failure && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-[#FF6B6B] hover:underline focus:outline-2 focus:outline-[#FF6B6B]/60"
            title={failure.message}
          >
            <XCircle aria-hidden className="h-3 w-3" />
            Stopped at stage {failure.index + 1} ({failure.label}): {failure.message} — dismiss
          </button>
        )}
      </div>

      {/* Confirm modal — pattern mirrors actions-tab.tsx too_soon_confirm. */}
      {runState === 'confirm' && (
        <div
          ref={modalRef}
          role="alertdialog"
          aria-labelledby={confirmTitleId}
          aria-modal="false"
          tabIndex={-1}
          className="hd-fullrun-modal plastic-card-hi absolute right-0 top-9 z-50 w-72 rounded-md border border-[#00E085]/50 bg-[#0F0F0F] px-3 py-2.5 outline-none"
          style={{ animation: 'hdFullRunFade 120ms ease-out' }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#00E085]" />
            <div className="flex-1">
              <h4 id={confirmTitleId} className="text-[12px] font-semibold text-[#1AEE99]">
                Run full pipeline
              </h4>
              <p className="mt-0.5 text-[11px] text-[#E8E8E8]">
                Run all {TOTAL} active pipeline stages sequentially? ({EST_DURATION_LABEL})
              </p>
              <p className="mt-0.5 text-[10px] text-[#6E6E6E]">
                Scout → Filter → Curator → Cluster → Enrichment → Writer → Feed Engine → Multilang →
                Monetizer. A failed stage stops the run.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-[#A8A8A8] transition-colors hover:border-white/[0.15] hover:text-[#E8E8E8] focus:outline-2 focus:outline-white/40 focus:outline-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1 rounded-md border border-[#00E085]/40 bg-[#00E085]/10 px-2.5 py-1 text-[11px] text-[#1AEE99] transition-colors hover:bg-[#00E085]/20 focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
                >
                  <Play aria-hidden className="h-3 w-3" />
                  Run full pipeline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
