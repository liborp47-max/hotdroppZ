'use client'

// Scout HQ — DroppZ Scout dashboard (UM-SCOUT_HQ, re-scope: live data wiring).
// Live scout_items dashboard with bulk actions + manual P0/P1 override, plus
// a filterable scout-run history panel. Replaces the previous mock-data stub.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, Loader2, RotateCw, Square } from 'lucide-react'
import {
  BULK_ACTIONS,
  filterScoutItems,
  filterRuns,
  summarizeRuns,
  type BulkActionId,
  type ScoutItemRow,
  type ScoutRunRow,
} from '@/lib/scout-hq/scout-items'

type Tab = 'items' | 'discarded' | 'runs'

function priorityClass(p: string | null): string {
  if (p === 'P0') return 'bg-red-900/30 text-red-300'
  if (p === 'P1') return 'bg-amber-900/30 text-amber-300'
  if (p === 'P2') return 'bg-blue-900/30 text-blue-300'
  return 'bg-white/[0.06] text-[#A8A8A8]'
}

function runStatusClass(s: string): string {
  if (s === 'complete') return 'bg-green-900/30 text-[#1AEE99]'
  if (s === 'error') return 'bg-red-900/30 text-red-300'
  return 'bg-yellow-900/30 text-yellow-300'
}

export default function DroppZScoutPage() {
  const [tab, setTab] = useState<Tab>('items')
  const [items, setItems] = useState<ScoutItemRow[]>([])
  const [runs, setRuns] = useState<ScoutRunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [runStatusFilter, setRunStatusFilter] = useState('all')

  const loadItems = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scout-hq/items?status=${status}&limit=200`)
      if (res.ok) {
        const data = (await res.json()) as { items: ScoutItemRow[] }
        setItems(data.items ?? [])
      } else {
        setInfo('Nepodařilo se načíst scout items.')
      }
    } catch {
      setInfo('Síťová chyba při načítání items.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scout-hq/runs?limit=100')
      if (res.ok) {
        const data = (await res.json()) as { runs: ScoutRunRow[] }
        setRuns(data.runs ?? [])
      } else {
        setInfo('Nepodařilo se načíst scout runs.')
      }
    } catch {
      setInfo('Síťová chyba při načítání runs.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    setSelected(new Set())
    setInfo(null)
    if (tab === 'items') void loadItems('SCOUTED')
    else if (tab === 'discarded') void loadItems('discarded')
    else void loadRuns()
  }, [tab, loadItems, loadRuns])

  useEffect(() => {
    refresh()
  }, [refresh])

  const visibleItems = useMemo(
    () => filterScoutItems(items, { priority: priorityFilter }),
    [items, priorityFilter],
  )
  const visibleRuns = useMemo(
    () => filterRuns(runs, { status: runStatusFilter }),
    [runs, runStatusFilter],
  )
  const runSummary = useMemo(() => summarizeRuns(runs), [runs])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(visibleItems.map((i) => i.id)))
  const clearSel = () => setSelected(new Set())

  const runBulk = async (action: BulkActionId, ids: string[]) => {
    if (ids.length === 0) return
    setBusy(true)
    setInfo(null)
    try {
      const res = await fetch('/api/scout-hq/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInfo(data.error ?? 'Bulk akce selhala.')
        return
      }
      setInfo(`${BULK_ACTIONS[action].label}: ${data.updated} OK, ${data.skipped} přeskočeno.`)
      clearSel()
      void loadItems(tab === 'discarded' ? 'discarded' : 'SCOUTED')
    } catch {
      setInfo('Síťová chyba při bulk akci.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">DroppZ Scout</h1>
        <p className="text-sm text-[#A8A8A8]">Live scout queue — bulk actions, P0/P1 override, run history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['items', 'discarded', 'runs'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-green-500 text-[#00E085]'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            }`}
          >
            {t === 'items' ? 'Scout Queue' : t === 'discarded' ? 'Discarded' : 'Run History'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {(loading || busy) && <Loader2 className="h-4 w-4 animate-spin text-[#6E6E6E]" />}
          {info && <span className="text-xs text-[#A8A8A8] max-w-md truncate">{info}</span>}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="h-8 px-2 inline-flex items-center gap-1 text-xs border border-white/10 text-[#A8A8A8] hover:text-[#1AEE99] disabled:opacity-30"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Items / Discarded tabs */}
      {tab !== 'runs' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-black/50 border border-white/10 text-[#D0D0D0]"
            >
              <option value="all">All priorities</option>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
            <button type="button" onClick={selectAll} className="text-[11px] text-[#A8A8A8] hover:text-[#E8E8E8] px-2 h-8">
              Select all ({visibleItems.length})
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={clearSel} className="text-[11px] text-[#A8A8A8] hover:text-[#E8E8E8] px-2 h-8">
                Clear ({selected.size})
              </button>
            )}
            {tab === 'items' && (
              <>
                <button
                  type="button"
                  onClick={() => runBulk('move_to_translated', Array.from(selected))}
                  disabled={selected.size === 0 || busy}
                  className="h-8 px-3 text-xs bg-[rgba(0,224,133,0.12)] text-[#00E085] border border-[rgba(0,224,133,0.35)] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-40"
                >
                  Move to Translated
                </button>
                <button
                  type="button"
                  onClick={() => runBulk('discard', Array.from(selected))}
                  disabled={selected.size === 0 || busy}
                  className="h-8 px-3 text-xs bg-red-900/30 text-red-300 border border-red-500/35 hover:bg-red-900/50 disabled:opacity-40"
                >
                  Discard
                </button>
              </>
            )}
          </div>

          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Priority</th>
                  <th className="px-2 py-2">Release</th>
                  <th className="px-2 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[#6E6E6E]">
                      {loading ? 'Načítám…' : 'Žádné položky.'}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => {
                    const isSel = selected.has(item.id)
                    return (
                      <tr key={item.id} className={`border-b border-white/[0.06] hover:bg-white/[0.025] ${isSel ? 'bg-[#0d1f10]' : ''}`}>
                        <td className="pl-3 py-2">
                          <button type="button" onClick={() => toggle(item.id)} aria-label={`Select ${item.id}`} className="text-[#A8A8A8] hover:text-[#1AEE99]">
                            {isSel ? <CheckSquare className="h-4 w-4 text-[#00E085]" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-2 py-2 max-w-[320px]">
                          <p className="text-[#E8E8E8] truncate">{item.title_en || item.title}</p>
                        </td>
                        <td className="px-2 py-2 text-[#A8A8A8] truncate max-w-[120px]">{item.source ?? '—'}</td>
                        <td className="px-2 py-2 text-[#A8A8A8]">{item.category ?? '—'}</td>
                        <td className="px-2 py-2">
                          <span className={`px-1.5 py-0.5 ${priorityClass(item.priority)}`}>{item.priority ?? '—'}</span>
                        </td>
                        <td className="px-2 py-2 text-[#A8A8A8]">{item.is_release ? (item.release_type ?? 'release') : '—'}</td>
                        <td className="px-2 py-2">
                          {tab === 'items' && (
                            <button
                              type="button"
                              onClick={() => runBulk('discard', [item.id])}
                              disabled={busy}
                              className="h-7 px-2 text-[10px] border border-white/10 text-[#A8A8A8] hover:text-red-300 disabled:opacity-40"
                            >
                              Discard
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Run history tab */}
      {tab === 'runs' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={runStatusFilter}
              onChange={(e) => setRunStatusFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-black/50 border border-white/10 text-[#D0D0D0]"
            >
              <option value="all">All runs</option>
              <option value="complete">Complete</option>
              <option value="error">Error</option>
              <option value="running">Running</option>
            </select>
            <span className="text-xs text-[#A8A8A8]">
              {runSummary.total} runs · {runSummary.complete} OK · {runSummary.errors} error ·{' '}
              {runSummary.itemsFound} items · error rate {(runSummary.errorRate * 100).toFixed(0)}%
            </span>
          </div>

          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                <tr>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Sources</th>
                  <th className="px-2 py-2">Items</th>
                  <th className="px-2 py-2">Duration</th>
                  <th className="px-2 py-2">Trigger</th>
                  <th className="px-2 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[#6E6E6E]">
                      {loading ? 'Načítám…' : 'Žádné scout runs.'}
                    </td>
                  </tr>
                ) : (
                  visibleRuns.map((run) => (
                    <tr key={run.id} className="border-b border-white/[0.06] hover:bg-white/[0.025]">
                      <td className="px-3 py-2 text-[#D0D0D0] font-mono">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 ${runStatusClass(run.status)}`}>{run.status}</span>
                      </td>
                      <td className="px-2 py-2 text-[#A8A8A8]">{run.sources_count}</td>
                      <td className="px-2 py-2 text-[#E8E8E8] font-mono">{run.items_found}</td>
                      <td className="px-2 py-2 text-[#A8A8A8]">
                        {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-2 py-2 text-[#A8A8A8]">{run.triggered_by}</td>
                      <td className="px-2 py-2 text-red-300 truncate max-w-[200px]">{run.error_message ?? ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
