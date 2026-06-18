'use client'

/**
 * SM-5 — Drill-down detail drawer.
 *
 * Click an event row → renders this drawer with:
 *   - Header: kind, severity, status, correlation id
 *   - Body: full message + metadata JSON
 *   - Related: other events sharing correlation_id (fetched on open)
 *
 * Plan-manager risk #4 (correlation_id propagation): drawer gracefully
 * handles correlationId=null (shows "no correlated events" instead of
 * empty list crash).
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { IntelEvent } from '@/lib/intel'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

interface IntelDrillDownProps {
  event: IntelEvent | null
  onClose: () => void
  /** Fetcher for related events; injectable so parent owns API config. */
  loadRelated?: (correlationId: string) => Promise<IntelEvent[]>
}

export function IntelDrillDown({ event, onClose, loadRelated }: IntelDrillDownProps) {
  const [related, setRelated] = useState<IntelEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!event || !event.correlationId || !loadRelated) {
      setRelated([])
      return
    }
    setLoading(true)
    loadRelated(event.correlationId)
      .then((events) => {
        if (cancelled) return
        setRelated(events.filter((e) => e.id !== event.id))
      })
      .catch(() => {
        if (cancelled) return
        setRelated([])
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event, loadRelated])

  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock (called unconditionally).
  const dialogRef = useModalA11y<HTMLElement>(!!event, onClose)

  if (!event) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-30 bg-black/40"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Intel event ${event.id}`}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-40 w-full max-w-[520px] overflow-y-auto border-l border-[#1A1A1A] bg-[#000000] shadow-[-10px_0_40px_rgba(0,0,0,0.8)] outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#00E085] font-mono">
              {event.kind}
            </p>
            <p className="text-sm text-[#E8E8E8] mt-1 font-mono">{event.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A8A8A8] hover:text-[#E8E8E8]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <Section label="Severity / Status">
            <span style={{ color: severityColor(event.severity) }}>
              {event.severity}
            </span>
            <span className="text-[#A8A8A8]"> · {event.status ?? 'unknown'}</span>
          </Section>

          <Section label="Actor / Source">
            {event.actor} · <span className="font-mono text-[#A8A8A8]">{event.sourceTable}</span>
            {event.stage && <span className="font-mono text-[#A8A8A8]"> · {event.stage}</span>}
          </Section>

          <Section label="Timeline">
            <span className="font-mono">{event.startedAt}</span>
            {event.endedAt && (
              <>
                {' → '}
                <span className="font-mono">{event.endedAt}</span>
              </>
            )}
            {event.durationMs !== null && (
              <span className="text-[#A8A8A8]"> · {event.durationMs} ms</span>
            )}
          </Section>

          <Section label="Message">
            <p className="text-[#E8E8E8] leading-relaxed">{event.message}</p>
          </Section>

          <Section label="Correlation">
            {event.correlationId ? (
              <span className="font-mono text-[#5C9A72]">{event.correlationId}</span>
            ) : (
              <span className="text-[#404040]">žádné correlation id</span>
            )}
          </Section>

          <Section label="Metadata">
            <pre className="bg-[#0A0A0A] border border-[#1A1A1A] p-2 text-[11px] text-[#A8A8A8] overflow-x-auto leading-tight">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </Section>

          <Section label={`Related events (${related.length}${loading ? ' loading…' : ''})`}>
            {event.correlationId === null ? (
              <p className="text-[#404040] text-xs">Bez correlation id — žádné related events.</p>
            ) : related.length === 0 && !loading ? (
              <p className="text-[#404040] text-xs">Žádné další události se stejným correlation_id.</p>
            ) : (
              <ul className="space-y-1.5">
                {related.map((r) => (
                  <li key={r.id} className="border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#A8A8A8]">{r.kind}</span>
                      <span className="font-mono text-[#404040]">{r.startedAt.slice(0, 19)}</span>
                    </div>
                    <p className="mt-1 text-[#E8E8E8] truncate">{r.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[#404040] font-mono mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function severityColor(sev: string): string {
  switch (sev) {
    case 'critical':
      return '#EF4444'
    case 'error':
      return '#F87171'
    case 'warn':
      return '#FFB020'
    default:
      return '#5C9A72'
  }
}
