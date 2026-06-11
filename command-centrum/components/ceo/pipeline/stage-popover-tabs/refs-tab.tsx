'use client'

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import type { PipelineStageState } from '@/lib/hd-central/types'
import type { StageHistoryEntry } from '../use-stage-detail'

export interface RefsTabProps {
  stage: PipelineStageState
  history?: StageHistoryEntry[]
  detailLoading?: boolean
  detailError?: Error | null
}

const MAX_HISTORY = 30

interface EventDescriptor {
  label: string
  icon: LucideIcon
  color: string
}

const EVENT_LABELS: Record<string, EventDescriptor> = {
  manual_trigger: { label: 'Manual trigger', icon: Play, color: '#1AEE99' },
  cron_trigger: { label: 'Cron trigger', icon: Clock, color: '#00B4FF' },
  run_complete: { label: 'Run complete', icon: CheckCircle2, color: '#00E085' },
  run_error: { label: 'Run error', icon: AlertTriangle, color: '#FF6B6B' },
  run_partial: { label: 'Run partial', icon: AlertCircle, color: '#F59E0B' },
  sync: { label: 'State sync', icon: RefreshCw, color: '#5DD6FF' },
}

function describeEvent(event: string): EventDescriptor {
  const direct = EVENT_LABELS[event]
  if (direct) return direct
  // Try a normalized key (lowercased, separators unified).
  const normalized = event.toLowerCase().replace(/[\s-]+/g, '_')
  const fuzzy = EVENT_LABELS[normalized]
  if (fuzzy) return fuzzy
  return { label: event, icon: Activity, color: '#A8A8A8' }
}

function formatHistoryTs(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, time }
}

export function RefsTab({ stage, history, detailLoading, detailError }: RefsTabProps) {
  const refs = stage.infoRefs ?? []
  // Newest first — history-log tail returns chronological, reverse for display.
  const entries = (history ?? []).slice(-MAX_HISTORY).reverse()

  return (
    <section aria-labelledby={`${stage.id}-refs-title`} className="space-y-4">
      <div>
        <h3
          id={`${stage.id}-refs-title`}
          className="text-[11px] uppercase tracking-[0.18em] text-[#A8A8A8] mb-2"
        >
          Audit references
        </h3>

        {refs.length === 0 ? (
          <p className="text-[11px] text-[#6E6E6E]">No references.</p>
        ) : (
          <ul className="space-y-1.5">
            {refs.map((ref) => (
              <li key={ref}>
                <a
                  href={`/file/${encodeURIComponent(ref)}`}
                  className="group inline-flex items-baseline gap-2 text-[11px] font-mono text-[#A8A8A8] hover:text-[#1AEE99] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
                >
                  <FileText
                    aria-hidden
                    className="h-3 w-3 shrink-0 self-center text-[#6E6E6E] group-hover:text-[#1AEE99]"
                  />
                  <span className="break-all">{ref}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#A8A8A8] mb-2">
          Recent history (last {MAX_HISTORY})
        </div>

        {detailLoading ? (
          <p className="text-[11px] text-[#6E6E6E] motion-safe:animate-pulse">loading history...</p>
        ) : detailError ? (
          <div className="flex items-start gap-2 rounded-md border border-[#FF6B6B]/40 bg-[#FF6B6B]/[0.06] px-2 py-1.5">
            <AlertCircle aria-hidden className="h-3 w-3 shrink-0 self-center text-[#FF6B6B]" />
            <span className="text-[11px] text-[#FF6B6B]">Failed to load history.</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-[11px] text-[#6E6E6E]">No history yet.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {entries.map((entry, idx) => {
              const { date, time } = formatHistoryTs(entry.ts)
              const desc = describeEvent(entry.event)
              const Icon = desc.icon
              return (
                <li
                  key={`${entry.ts}-${idx}`}
                  className="flex items-baseline gap-2 font-mono text-[11px] leading-tight"
                >
                  <span className="text-[#6E6E6E]">{date}</span>
                  <span className="text-[#6E6E6E]">{time}</span>
                  <Icon
                    aria-hidden
                    className="h-3 w-3 shrink-0 self-center"
                    style={{ color: desc.color }}
                  />
                  <span style={{ color: desc.color }}>{desc.label}</span>
                  {entry.note ? (
                    <span className="text-[#6E6E6E]">{entry.note}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
