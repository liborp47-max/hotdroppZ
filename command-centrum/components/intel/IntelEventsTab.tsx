'use client'

/**
 * Intel Events Tab — composition of Search + Timeline + Event list + Drill-down.
 *
 * State owner for the SM-3/4/5 UI trio. Fetches via /api/intel/events with
 * `filter` as query params; refetches on filter change. Drill-down opens
 * when an event row is clicked.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IntelEvent, IntelEventFilter } from '@/lib/intel'
import { IntelSearch } from './IntelSearch'
import { IntelTimeline } from './IntelTimeline'
import { IntelDrillDown } from './IntelDrillDown'

interface IntelEventsTabProps {
  /** Base URL for /api/intel/* — undefined uses same-origin. */
  apiBaseUrl?: string
}

export function IntelEventsTab({ apiBaseUrl }: IntelEventsTabProps) {
  const [filter, setFilter] = useState<IntelEventFilter>({ limit: 100 })
  const [events, setEvents] = useState<IntelEvent[]>([])
  const [total, setTotal] = useState(0)
  const [degraded, setDegraded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<IntelEvent | null>(null)

  const apiUrl = useMemo(() => (apiBaseUrl ?? '') + '/api/intel/events', [apiBaseUrl])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filterToQuery(filter)
      const res = await fetch(`${apiUrl}?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as {
        events: IntelEvent[]
        total: number
        degraded: boolean
      }
      setEvents(body.events ?? [])
      setTotal(body.total ?? 0)
      setDegraded(Boolean(body.degraded))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, filter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadRelated = useCallback(
    async (correlationId: string): Promise<IntelEvent[]> => {
      const params = new URLSearchParams({ correlationId, limit: '50' })
      const res = await fetch(`${apiUrl}?${params.toString()}`)
      if (!res.ok) return []
      const body = (await res.json()) as { events: IntelEvent[] }
      return body.events ?? []
    },
    [apiUrl],
  )

  return (
    <div className="space-y-4 px-6 py-4">
      <IntelSearch
        filter={filter}
        onChange={setFilter}
        events={events}
        total={total}
        loading={loading}
        degraded={degraded}
      />

      <IntelTimeline
        events={events}
        onHourClick={(hourIso) => {
          const next = new Date(Date.parse(hourIso) + 60 * 60 * 1000).toISOString()
          setFilter({ ...filter, since: hourIso, until: next })
        }}
      />

      {error && (
        <div className="border border-[#EF4444]/40 bg-[#1A0808] px-3 py-2 text-xs text-[#F87171]">
          Chyba načtení: {error}
        </div>
      )}

      <ul className="border border-[#1A1A1A]">
        {events.length === 0 && !loading ? (
          <li className="px-3 py-4 text-center text-xs text-[#404040]">Žádné události</li>
        ) : (
          events.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => setSelected(ev)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs border-b border-[#1A1A1A] last:border-b-0 hover:bg-[#0A0A0A]"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="inline-block w-1.5 h-1.5"
                    style={{ background: severityColor(ev.severity) }}
                  />
                  <span className="font-mono text-[#A8A8A8] uppercase">{ev.kind}</span>
                  <span className="text-[#E8E8E8] truncate max-w-[420px]">{ev.message}</span>
                </span>
                <span className="font-mono text-[#404040]">{ev.startedAt.slice(0, 19)}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      <IntelDrillDown event={selected} onClose={() => setSelected(null)} loadRelated={loadRelated} />
    </div>
  )
}

function filterToQuery(filter: IntelEventFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (filter.kinds && filter.kinds.length > 0) p.set('kinds', filter.kinds.join(','))
  if (filter.severities && filter.severities.length > 0) p.set('severities', filter.severities.join(','))
  if (filter.stages && filter.stages.length > 0) p.set('stages', filter.stages.join(','))
  if (filter.actor) p.set('actor', filter.actor)
  if (filter.correlationId) p.set('correlationId', filter.correlationId)
  if (filter.since) p.set('since', filter.since)
  if (filter.until) p.set('until', filter.until)
  if (filter.q) p.set('q', filter.q)
  if (filter.limit) p.set('limit', String(filter.limit))
  if (filter.offset) p.set('offset', String(filter.offset))
  return p
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
