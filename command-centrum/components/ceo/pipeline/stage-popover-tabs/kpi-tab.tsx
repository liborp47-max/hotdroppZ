'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { Sparkline } from '../sparkline'
import type { StageRecentRun } from '../use-stage-detail'

export interface KpiTabProps {
  stage: PipelineStageState
  recentRuns?: StageRecentRun[]
  detailLoading?: boolean
  detailError?: Error | null
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[18px] font-mono text-[#1AEE99] venom-glow">{value}</span>
      <span className="mt-1 text-[9px] uppercase tracking-widest text-[#6E6E6E]">{label}</span>
    </div>
  )
}

const STATUS_COLOR: Record<string, { text: string; dot: string }> = {
  complete: { text: '#1AEE99', dot: '#00E085' },
  completed: { text: '#1AEE99', dot: '#00E085' },
  success: { text: '#1AEE99', dot: '#00E085' },
  error: { text: '#FF6B6B', dot: '#FF6B6B' },
  failed: { text: '#FF6B6B', dot: '#FF6B6B' },
  running: { text: '#00B4FF', dot: '#00B4FF' },
  in_progress: { text: '#00B4FF', dot: '#00B4FF' },
}

function statusColor(status: string): { text: string; dot: string } {
  return STATUS_COLOR[status] ?? { text: '#A8A8A8', dot: '#6E6E6E' }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function durationMs(startedAt: string, finishedAt?: string): number | null {
  if (!finishedAt) return null
  const s = Date.parse(startedAt)
  const f = Date.parse(finishedAt)
  if (Number.isNaN(s) || Number.isNaN(f)) return null
  return Math.max(0, f - s)
}

function RunRow({ run }: { run: StageRecentRun }) {
  const { text, dot } = statusColor(run.status)
  const dur = durationMs(run.startedAt, run.finishedAt)
  const items = run.itemsProcessed
  const itemsLabel = items === undefined ? null : `${items} item${items === 1 ? '' : 's'}`
  const durLabel = dur === null ? null : `${dur}ms`

  return (
    <li className="flex items-center gap-2 py-0.5 font-mono text-[11px] text-[#A8A8A8]">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: dot, boxShadow: `0 0 4px ${dot}` }}
      />
      <span className="w-10 shrink-0 text-[#6E6E6E]">{formatTime(run.startedAt)}</span>
      <span className="w-16 shrink-0" style={{ color: text }}>
        {run.status}
      </span>
      <span className="truncate text-[#A8A8A8]">
        {[itemsLabel, durLabel].filter(Boolean).join(' · ')}
      </span>
    </li>
  )
}

export function KpiTab({ stage, recentRuns, detailLoading, detailError }: KpiTabProps) {
  const k = stage.kpi
  const items = k.itemsToday
  const week = k.itemsWeek
  const throughputPerMin = items > 0 ? (items / (24 * 60)).toFixed(2) : '0.00'
  const errorRate =
    items + k.errorsToday > 0
      ? ((k.errorsToday / (items + k.errorsToday)) * 100).toFixed(1)
      : '0.0'

  const runs = (recentRuns ?? []).slice(0, 10)

  return (
    <section aria-labelledby={`${stage.id}-kpi-title`} className="space-y-4">
      <h3 id={`${stage.id}-kpi-title`} className="sr-only">
        KPI
      </h3>

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#6E6E6E] mb-2">TODAY</div>
        <div className="flex items-start gap-8">
          <Stat value={items} label="items" />
          <Stat value={k.errorsToday} label="errors" />
          <Stat value={`${k.latencyP95Ms}ms`} label="p95 latency" />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#6E6E6E] mb-2">
          7 DAY TREND ({week} total)
        </div>
        <Sparkline
          values={k.spark7d}
          width={200}
          height={40}
          ariaLabel={`7-day trend for ${stage.displayName}, ${week} items this week`}
        />
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">throughput</span>
          <span className="font-mono text-[12px] text-[#E8E8E8]">{throughputPerMin}/min</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">error rate</span>
          <span className="font-mono text-[12px] text-[#E8E8E8]">{errorRate}%</span>
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#6E6E6E] mb-2">
          Recent runs (last 10)
        </div>
        {detailLoading ? (
          <p className="text-[11px] text-[#6E6E6E] motion-safe:animate-pulse">loading runs...</p>
        ) : detailError ? (
          <p className="text-[11px] text-[#FF6B6B]">Failed to load runs.</p>
        ) : runs.length === 0 ? (
          <p className="text-[11px] text-[#6E6E6E]">No recent runs.</p>
        ) : (
          <ul className="space-y-0.5">
            {runs.map((r) => (
              <RunRow key={r.runId} run={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
