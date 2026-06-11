'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import type { PipelineStageState } from '@/lib/hd-central/types'
import type { StageRecentRun } from '../use-stage-detail'

export interface ActionsTabProps {
  stage: PipelineStageState
  recentRuns?: StageRecentRun[]
  detailLoading?: boolean
  onTriggerSuccess?: (correlationId: string) => void
  onTriggerError?: (message: string) => void
}

type TriggerState = 'idle' | 'triggering' | 'success' | 'error' | 'too_soon_confirm'

interface TriggerResultOk {
  ok: boolean
  stage: string
  correlationId: string
  triggeredAt: string
  upstreamStatus?: number
}

interface TriggerErrorBody {
  error?: {
    code?: string
    message?: string
    details?: { lastRunAt?: string; retryAfterSec?: number }
  }
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  hint: string
  disabled?: boolean
  disabledReason?: string
  onClick?: () => void
  primary?: boolean
  busy?: boolean
}

function ActionButton({
  icon,
  label,
  hint,
  disabled,
  disabledReason,
  onClick,
  primary,
  busy,
}: ActionButtonProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-label={label}
        aria-busy={busy ? true : undefined}
        className={
          'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] ' +
          'transition-colors focus:outline-2 focus:outline-offset-2 ' +
          (primary
            ? 'border-[#00E085]/40 bg-[#00E085]/10 text-[#1AEE99] hover:bg-[#00E085]/20 focus:outline-[#00E085]/60 '
            : 'border-white/[0.08] bg-white/[0.02] text-[#A8A8A8] hover:border-white/[0.15] focus:outline-white/40 ') +
          (disabled ? 'cursor-not-allowed opacity-40 hover:!bg-transparent hover:!border-white/[0.08]' : '')
        }
      >
        <span aria-hidden className="inline-flex">{icon}</span>
        {label}
      </button>
      <span className="text-[10px] font-mono text-[#6E6E6E]">{hint}</span>
    </div>
  )
}

function formatAgo(iso: string | undefined): string {
  if (!iso) return 'unknown'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(mm)}:${pad(ss)} ago`
}

export function ActionsTab({
  stage,
  recentRuns,
  detailLoading,
  onTriggerSuccess,
  onTriggerError,
}: ActionsTabProps) {
  const [copied, setCopied] = useState(false)
  const [triggerState, setTriggerState] = useState<TriggerState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastCorrelationId, setLastCorrelationId] = useState<string | null>(null)
  const [tooSoonDetails, setTooSoonDetails] = useState<{ lastRunAt?: string; retryAfterSec?: number }>({})
  const [flashSuccess, setFlashSuccess] = useState(false)
  const successResetTimerRef = useRef<number | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const confirmTitleId = useId()

  const retired = stage.status === 'retired'
  const autoOnly = stage.manualTriggerEndpoint === null
  const latestRun = recentRuns && recentRuns.length > 0 ? recentRuns[0] : null
  // Prefer real correlationId from latest run; fall back to last triggered id.
  const correlationId = lastCorrelationId ?? latestRun?.runId ?? null

  useEffect(() => {
    return () => {
      if (successResetTimerRef.current !== null) {
        window.clearTimeout(successResetTimerRef.current)
      }
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current)
      }
    }
  }, [])

  // Focus management for too_soon modal.
  useEffect(() => {
    if (triggerState !== 'too_soon_confirm') return
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
        setTriggerState('idle')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      const prev = lastFocusedRef.current
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [triggerState])

  const triggerOnce = useCallback(
    async (force: boolean) => {
      setErrorMessage(null)
      setTriggerState('triggering')

      const qs = force ? '?force=true' : ''
      const url = `/api/hd-central/pipeline-state/stage/${encodeURIComponent(stage.id)}/trigger${qs}`

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })

        if (res.status === 409) {
          const body: TriggerErrorBody = await res.json().catch(() => ({}))
          const details = body.error?.details ?? {}
          setTooSoonDetails({
            lastRunAt: details.lastRunAt,
            retryAfterSec: details.retryAfterSec,
          })
          setTriggerState('too_soon_confirm')
          return
        }

        if (!res.ok) {
          const body: TriggerErrorBody = await res.json().catch(() => ({}))
          const msg = body.error?.message ?? `HTTP ${res.status}`
          setErrorMessage(msg)
          setTriggerState('error')
          onTriggerError?.(msg)
          return
        }

        const body = (await res.json()) as TriggerResultOk
        setLastCorrelationId(body.correlationId)
        setTriggerState('success')
        setFlashSuccess(true)
        onTriggerSuccess?.(body.correlationId)

        if (successResetTimerRef.current !== null) {
          window.clearTimeout(successResetTimerRef.current)
        }
        successResetTimerRef.current = window.setTimeout(() => {
          setTriggerState('idle')
        }, 3000)

        if (flashTimerRef.current !== null) {
          window.clearTimeout(flashTimerRef.current)
        }
        flashTimerRef.current = window.setTimeout(() => {
          setFlashSuccess(false)
        }, 800)
      } catch (e) {
        const msg = (e as Error).message || 'Network error'
        setErrorMessage(msg)
        setTriggerState('error')
        onTriggerError?.(msg)
      }
    },
    [stage.id, onTriggerSuccess, onTriggerError],
  )

  const handleRun = useCallback(() => {
    void triggerOnce(false)
  }, [triggerOnce])

  const handleForceRun = useCallback(() => {
    void triggerOnce(true)
  }, [triggerOnce])

  const handleCancelConfirm = useCallback(() => {
    setTriggerState('idle')
  }, [])

  const handleRetry = useCallback(() => {
    setTriggerState('idle')
    setErrorMessage(null)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!correlationId) return
    try {
      await navigator.clipboard?.writeText(correlationId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore — clipboard rejected (permissions, secure-context)
    }
  }, [correlationId])

  const triggerHint = stage.manualTriggerEndpoint ?? `POST /api/${stage.id}/run`

  let primaryDisabled = false
  let primaryDisabledReason: string | undefined
  if (retired) {
    primaryDisabled = true
    primaryDisabledReason = 'Retired stage'
  } else if (autoOnly) {
    primaryDisabled = true
    primaryDisabledReason = 'Auto-only'
  } else if (triggerState === 'triggering') {
    primaryDisabled = true
    primaryDisabledReason = 'Running...'
  }

  const primaryHidden = triggerState === 'too_soon_confirm'

  const primaryIcon =
    triggerState === 'triggering' ? (
      <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
    ) : triggerState === 'success' ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : (
      <Play className="h-3.5 w-3.5" />
    )

  const primaryLabel =
    triggerState === 'triggering'
      ? 'running...'
      : triggerState === 'success'
        ? 'Triggered'
        : 'Run now'

  const containerClass =
    'space-y-3 rounded-md border p-2 transition-colors ' +
    (flashSuccess
      ? 'border-[#00E085]/60 shadow-[0_0_12px_rgba(0,224,133,0.35)]'
      : 'border-transparent')

  return (
    <section
      aria-labelledby={`${stage.id}-actions-title`}
      className={containerClass}
      style={{ transitionDuration: '800ms' }}
    >
      <h3 id={`${stage.id}-actions-title`} className="sr-only">
        Actions
      </h3>

      {!primaryHidden && (
        <ActionButton
          primary
          icon={primaryIcon}
          label={primaryLabel}
          hint={triggerHint}
          disabled={primaryDisabled}
          disabledReason={primaryDisabledReason}
          onClick={primaryDisabled ? undefined : handleRun}
          busy={triggerState === 'triggering'}
        />
      )}

      {triggerState === 'success' && lastCorrelationId && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-[#00E085]/40 bg-[#00E085]/[0.06] px-2 py-1.5"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#1AEE99]" />
          <span className="text-[11px] text-[#E8E8E8]">
            Triggered. Correlation:{' '}
            <code className="font-mono text-[#1AEE99]">{lastCorrelationId}</code>
          </span>
        </div>
      )}

      {triggerState === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#FF6B6B]/50 bg-[#FF6B6B]/[0.08] px-2 py-1.5"
        >
          <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#FF6B6B]" />
          <div className="flex-1">
            <p className="text-[11px] text-[#FF6B6B]">{errorMessage ?? 'Trigger failed.'}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[10px] text-[#A8A8A8] transition-colors hover:border-white/[0.15] hover:text-[#E8E8E8] focus:outline-2 focus:outline-white/40 focus:outline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {triggerState === 'too_soon_confirm' && (
        <div
          ref={modalRef}
          role="alertdialog"
          aria-labelledby={confirmTitleId}
          aria-modal="false"
          tabIndex={-1}
          className="plastic-card-hi rounded-md border border-[#F59E0B]/50 bg-[#F59E0B]/[0.04] px-3 py-2.5 outline-none"
          style={{ animation: 'hdConfirmFade 120ms ease-out' }}
        >
          <style>{`
            @keyframes hdConfirmFade {
              from { opacity: 0; transform: translateY(-2px) }
              to   { opacity: 1; transform: translateY(0) }
            }
            @media (prefers-reduced-motion: reduce) {
              [role="alertdialog"] { animation: none !important }
            }
          `}</style>
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 self-center text-[#F59E0B]" />
            <div className="flex-1">
              <h4 id={confirmTitleId} className="text-[12px] font-semibold text-[#F59E0B]">
                Recent run detected
              </h4>
              <p className="mt-0.5 text-[11px] text-[#E8E8E8]">
                Last run: <span className="font-mono">{formatAgo(tooSoonDetails.lastRunAt)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[#A8A8A8]">
                Run anyway? (this skips the 5min guard)
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-[#A8A8A8] transition-colors hover:border-white/[0.15] hover:text-[#E8E8E8] focus:outline-2 focus:outline-white/40 focus:outline-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleForceRun}
                  className="inline-flex items-center rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20 focus:outline-2 focus:outline-[#F59E0B]/60 focus:outline-offset-2"
                >
                  Force run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionButton
        icon={<Pause className="h-3.5 w-3.5" />}
        label="Pause"
        hint="(coming soon)"
        disabled
        disabledReason="Not yet implemented"
      />

      <ActionButton
        icon={<RotateCcw className="h-3.5 w-3.5" />}
        label="Reset"
        hint="(coming soon)"
        disabled
        disabledReason="Not yet implemented"
      />

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#6E6E6E] mb-1.5">
          correlation id (last run)
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate font-mono text-[11px] text-[#A8A8A8]">
            {detailLoading && !correlationId ? 'loading...' : (correlationId ?? '--')}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!correlationId}
            aria-label="Copy correlation id"
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10px] text-[#A8A8A8] transition-colors hover:border-white/[0.15] hover:text-[#1AEE99] focus:outline-2 focus:outline-white/40 focus:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy aria-hidden className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  )
}
