'use client'

/**
 * SM-3 — Intel search + filter UI.
 *
 * Wraps the queryEvents() API. Controlled inputs: free-text search, kind
 * checkboxes, severity filter, date range. Calls onChange whenever filters
 * change so parent can re-fetch. Export buttons emit current event list as
 * CSV/JSON via download anchor.
 */

import { useMemo, useState } from 'react'
import { Search, Download } from 'lucide-react'
import type { IntelEvent, IntelEventFilter, IntelEventKind, IntelSeverity } from '@/lib/intel'

const KINDS: IntelEventKind[] = ['pipeline_run', 'worker_run', 'scout_run', 'audit_record']
const SEVERITIES: IntelSeverity[] = ['info', 'warn', 'error', 'critical']

interface IntelSearchProps {
  filter: IntelEventFilter
  onChange: (next: IntelEventFilter) => void
  events: IntelEvent[]
  total: number
  loading: boolean
  degraded: boolean
}

export function IntelSearch({ filter, onChange, events, total, loading, degraded }: IntelSearchProps) {
  const [localQ, setLocalQ] = useState(filter.q ?? '')

  const handleApplyQ = () => onChange({ ...filter, q: localQ.trim() || undefined })

  const toggleKind = (kind: IntelEventKind) => {
    const current = filter.kinds ?? []
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]
    onChange({ ...filter, kinds: next.length > 0 ? next : undefined })
  }

  const toggleSeverity = (sev: IntelSeverity) => {
    const current = filter.severities ?? []
    const next = current.includes(sev) ? current.filter((s) => s !== sev) : [...current, sev]
    onChange({ ...filter, severities: next.length > 0 ? next : undefined })
  }

  const exportCsv = () => downloadFile(eventsToCsv(events), 'intel-events.csv', 'text/csv')
  const exportJson = () =>
    downloadFile(JSON.stringify(events, null, 2), 'intel-events.json', 'application/json')

  return (
    <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-3 w-3 text-[#5C9A72]" />
        <input
          type="text"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleApplyQ()
          }}
          placeholder="Hledat: message / actor / stage"
          className="flex-1 bg-[#000000] border border-[#1A1A1A] px-3 py-1.5 text-sm text-[#E8E8E8] placeholder-[#404040] focus:border-[#00E085]/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleApplyQ}
          className="border border-[#1A1A1A] bg-[#000000] px-3 py-1.5 text-xs uppercase tracking-widest text-[#A8A8A8] hover:border-[#00E085]/40 hover:text-[#E8E8E8]"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest text-[#404040] font-mono">Kind:</span>
        {KINDS.map((kind) => {
          const active = (filter.kinds ?? []).includes(kind)
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`text-[11px] uppercase tracking-widest px-2 py-1 border ${
                active
                  ? 'border-[#00E085]/40 bg-[#00E085]/5 text-[#00E085]'
                  : 'border-[#1A1A1A] text-[#A8A8A8]'
              }`}
            >
              {kind}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest text-[#404040] font-mono">Severity:</span>
        {SEVERITIES.map((sev) => {
          const active = (filter.severities ?? []).includes(sev)
          const color = severityColor(sev)
          return (
            <button
              key={sev}
              type="button"
              onClick={() => toggleSeverity(sev)}
              className={`text-[11px] uppercase tracking-widest px-2 py-1 border ${
                active ? 'border-current' : 'border-[#1A1A1A]'
              }`}
              style={{ color: active ? color : '#A8A8A8' }}
            >
              {sev}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateInput
          label="Since"
          value={filter.since}
          onChange={(v) => onChange({ ...filter, since: v })}
        />
        <DateInput
          label="Until"
          value={filter.until}
          onChange={(v) => onChange({ ...filter, until: v })}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[#1A1A1A]">
        <div className="text-[11px] text-[#A8A8A8] font-mono">
          {loading ? 'Loading…' : `${events.length} / ${total} events`}
          {degraded && (
            <span className="ml-2 text-[#FFB020]">[degraded — intel_events view missing]</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> JSON
          </button>
        </div>
      </div>
    </div>
  )
}

interface DateInputProps {
  label: string
  value: string | undefined
  onChange: (next: string | undefined) => void
}

function DateInput({ label, value, onChange }: DateInputProps) {
  const display = useMemo(() => (value ? value.slice(0, 16) : ''), [value])
  return (
    <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#404040] font-mono">
      {label}:
      <input
        type="datetime-local"
        value={display}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        className="bg-[#000000] border border-[#1A1A1A] px-2 py-1 text-xs text-[#E8E8E8]"
      />
    </label>
  )
}

function severityColor(sev: IntelSeverity): string {
  switch (sev) {
    case 'critical':
      return '#EF4444'
    case 'error':
      return '#F87171'
    case 'warn':
      return '#FFB020'
    case 'info':
    default:
      return '#5C9A72'
  }
}

function eventsToCsv(events: IntelEvent[]): string {
  const header = ['id', 'kind', 'sourceTable', 'stage', 'status', 'severity', 'actor', 'correlationId', 'startedAt', 'durationMs', 'message']
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const rows = events.map((e) =>
    [e.id, e.kind, e.sourceTable, e.stage, e.status, e.severity, e.actor, e.correlationId, e.startedAt, e.durationMs, e.message]
      .map(escape)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function downloadFile(content: string, name: string, mime: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
