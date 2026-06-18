'use client'

/**
 * HDUA-10 — HDCC Live Pipeline Monitor.
 *
 * Detailed real-time panel over the REAL pipeline stages (STAGE_TABLE), not an
 * idealized list. Polls the two existing aggregation endpoints every 8s (no
 * reload) and renders one card per stage with status/latency/queue/processed/
 * errors/warnings/last-run + a 7-day history sparkline. Colored ok/warn/error.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Pause, Play, RefreshCw, Loader2 } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { Sparkline } from '@/components/ceo/pipeline/sparkline'
import {
  buildMonitorStages,
  summarizeMonitor,
  type MonitorLevel,
  type MonitorStage,
} from '@/lib/hd-central/pipeline-monitor'
import type { PipelineAggregate } from '@/lib/hd-central/types'
import type { LiveMetrics } from '@/app/api/hd-central/pipeline-state/live-metrics/route'

const POLL_MS = 8000

const LEVEL_DOT: Record<MonitorLevel, string> = {
  ok: '#00E085',
  warn: '#F59E0B',
  error: '#EF4444',
}
const LEVEL_BORDER: Record<MonitorLevel, string> = {
  ok: 'border-l-[#00E085]/60',
  warn: 'border-l-[#F59E0B]/70',
  error: 'border-l-[#EF4444]/70',
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return (await res.json()) as T
}

export function LivePipelineMonitor() {
  const [stages, setStages] = useState<MonitorStage[]>([])
  const [live, setLive] = useState<LiveMetrics | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paused, setPaused] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      const [agg, lm] = await Promise.all([
        getJson<PipelineAggregate>('/api/hd-central/pipeline-state/aggregate'),
        getJson<LiveMetrics>('/api/hd-central/pipeline-state/live-metrics').catch(() => null),
      ])
      setStages(buildMonitorStages(agg, lm))
      setLive(lm)
      setUpdatedAt(agg.generatedAt)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline state')
    } finally {
      setLoading(false)
      setRefreshing(false)
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [paused, load])

  const sum = summarizeMonitor(stages)

  return (
    <div className="min-h-screen bg-black p-5 text-[#E8E8E8]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#00E085]" />
          <h1 className="text-base font-semibold tracking-tight">Live Pipeline Monitor</h1>
          {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6E6E6E]" />}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#A8A8A8]">
          <span>
            {updatedAt ? `updated ${timeAgo(updatedAt)}` : '—'} · refresh {POLL_MS / 1000}s
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 hover:bg-white/[0.04] transition-colors"
            aria-label={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Roll-up */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Stages" value={sum.total} />
        <Kpi label="OK" value={sum.ok} dot={LEVEL_DOT.ok} />
        <Kpi label="Warn" value={sum.warn} dot={LEVEL_DOT.warn} />
        <Kpi label="Error" value={sum.error} dot={LEVEL_DOT.error} />
        <Kpi label="Queued" value={sum.queued} />
        <Kpi label="Processed (24h)" value={sum.processedToday} />
        <Kpi label="Active runs" value={live?.activeRunsCount ?? 0} />
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {loading && stages.length === 0 ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-[#6E6E6E]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline state…
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stages.map((s) => (
            <StageCard key={s.id} stage={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6E6E6E]">
        {dot && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function StageCard({ stage }: { stage: MonitorStage }) {
  const dot = LEVEL_DOT[stage.level]
  return (
    <div className={`rounded-lg border border-l-2 border-white/10 ${LEVEL_BORDER[stage.level]} bg-white/[0.02] p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#6E6E6E]">{String(stage.index).padStart(2, '0')}</span>
          <span className="text-sm font-semibold">{stage.displayName}</span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider"
          style={{ color: dot }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
          {stage.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Latency p95" value={`${stage.latencyMs} ms`} />
        <Metric label="Queue" value={stage.queue == null ? '—' : String(stage.queue)} />
        <Metric label="Errors" value={String(stage.errorsToday)} warn={stage.errorsToday > 0} />
        <Metric label="Today" value={String(stage.processedToday)} />
        <Metric label="Week" value={String(stage.processedWeek)} />
        <Metric label="Warnings" value={String(stage.warnings.length)} warn={stage.warnings.length > 0} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-[10px] text-[#6E6E6E]">
          <div>last run {stage.lastRunAt ? timeAgo(stage.lastRunAt) : '—'}</div>
          {stage.runStatus && (
            <div>
              {stage.runStatus}
              {stage.runDurationMs != null ? ` · ${stage.runDurationMs} ms` : ''}
            </div>
          )}
        </div>
        <Sparkline values={stage.spark7d} stroke={dot} ariaLabel={`${stage.displayName} 7-day items`} />
      </div>

      {stage.warnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {stage.warnings.map((w) => (
            <span key={w} className="rounded bg-[#F59E0B]/10 px-1.5 py-0.5 text-[10px] text-[#F59E0B]">
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-[#6E6E6E]">{label}</div>
      <div className={`mt-0.5 tabular-nums ${warn ? 'text-[#F59E0B]' : 'text-[#E8E8E8]'}`}>{value}</div>
    </div>
  )
}
