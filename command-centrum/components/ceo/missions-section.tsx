'use client'

// CEO / Missions — unified surface (HD Central UI upgrade).
//
// One live data source (usePlanStream/SSE), one filter model + bar
// (mission-filters / MissionFilterBar), one table for every scope, and a detail
// slide-over (MissionDetailDrawer) for rich per-mission work. Replaces the old
// split between this component and the 1265-line UserMissionsPanel.

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronRight,
  Flag,
  Layers,
  Loader2,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Mission, Phase, Plan, Priority } from '@/lib/hd-central/types'
import { getEvidenceSummary, type EvidenceSummary } from '@/lib/hd-central/evidence-summary'
import { computeSlaAlerts } from '@/lib/hd-central/mission-sla'
import { usePlanStream } from '@/lib/hd-central/use-plan-stream'
import {
  applyMissionFilters,
  computeScopeCounts,
  DEFAULT_MISSION_FILTERS,
  DEFAULT_SORT_DIR,
  type MissionFilters,
  type MissionSortKey,
  type SortDir,
} from '@/lib/hd-central/mission-filters'
import { MissionFilterBar } from './mission-filter-bar'
import { MissionDetailDrawer } from './mission-detail-drawer'

const EVIDENCE_TEXT_TONE: Record<EvidenceSummary['tone'], string> = {
  green: 'text-[#1AEE99]',
  amber: 'text-[#F0C040]',
  red: 'text-[#F06868]',
  slate: 'text-[#9AA4B2]',
  gray: 'text-[#A8A8A8]',
}

function priorityBadgeClass(p?: Priority): string {
  if (p === 'P0') return 'border-red-500/35 bg-red-500/12 text-red-300'
  if (p === 'P1') return 'border-amber-500/35 bg-amber-500/12 text-amber-300'
  if (p === 'P2') return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}
function phaseBadgeClass(phase?: Phase): string {
  if (phase === 'Foundation') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (phase === 'Build') return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
  if (phase === 'Validate') return 'border-emerald-500/30 bg-emerald-500/10 text-[#1AEE99]'
  if (phase === 'Launch') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}
function domainBadgeClass(domain?: string): string {
  const map: Record<string, string> = {
    SECURITY: 'text-red-300 border-red-500/30 bg-red-500/10',
    PIPELINE: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
    DISTRIBUTION: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    ANALYTICS: 'text-teal-300 border-teal-500/30 bg-teal-500/10',
    INFRASTRUCTURE: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    DATABASE: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
    FRONTEND: 'text-pink-300 border-pink-500/30 bg-pink-500/10',
    BACKEND: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
    QUALITY: 'text-[#1AEE99] border-lime-500/30 bg-[rgba(0,224,133,0.10)]',
    OPERATIONS: 'text-[#D0D0D0] border-white/20 bg-white/[0.12]',
  }
  if (!domain) return 'text-[#A8A8A8] border-white/15 bg-white/[0.05]'
  return map[domain] ?? 'text-[#A8A8A8] border-white/15 bg-white/[0.05]'
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string
  col: MissionSortKey
  sortKey: MissionSortKey
  sortDir: SortDir
  onSort: (key: MissionSortKey) => void
  className?: string
}) {
  const active = sortKey === col
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(col)}
        aria-label={`Řadit podle ${label}`}
        className={`inline-flex items-center gap-1 uppercase tracking-widest transition-colors ${
          active ? 'text-[#1AEE99]' : 'hover:text-[#E8E8E8]'
        }`}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-25" />
        )}
      </button>
    </th>
  )
}

export function MissionsSection() {
  const { plan, loading, setPlan, refresh } = usePlanStream()
  const [filters, setFilters] = useState<MissionFilters>(DEFAULT_MISSION_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [scheduledAt, setScheduledAt] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [detailMission, setDetailMission] = useState<Mission | null>(null)

  const allMissions = useMemo(() => (plan?.missions ?? []).filter((m) => !m.isDeleted), [plan])
  const counts = useMemo(() => computeScopeCounts(allMissions), [allMissions])
  const visibleMissions = useMemo(() => applyMissionFilters(allMissions, filters), [allMissions, filters])
  const slaAlerts = useMemo(() => computeSlaAlerts(allMissions), [allMissions])

  const patchFilters = useCallback((patch: Partial<MissionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }, [])

  // Column-header sort: same column toggles direction, new column uses its
  // sensible default direction (urgency/created desc, text asc, …).
  const sortByColumn = useCallback((key: MissionSortKey) => {
    setFilters((f) =>
      f.sortKey === key
        ? { ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' }
        : { ...f, sortKey: key, sortDir: DEFAULT_SORT_DIR[key] },
    )
  }, [])

  // ── selection ──
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const selectAllVisible = () => setSelectedIds(new Set(visibleMissions.map((m) => m.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // ── push / pull / delete (responses are the updated plan → feed the stream) ──
  const callPush = async (
    mode: 'one' | 'selected' | 'all' | 'pull',
    missionIds: string[] | undefined,
    label: string,
  ) => {
    setBusyAction(label)
    setActionInfo(null)
    try {
      const res = await fetch('/api/hd-central/missions/push-to-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          missionIds,
          actorAgent: 'plan-manager',
          scheduledFor: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        setActionInfo(`${label} selhalo — chyba API.`)
        return
      }
      setPlan((await res.json()) as Plan)
      clearSelection()
      setActionInfo(`${label}: OK.`)
    } catch {
      setActionInfo(`${label} selhalo — síťová chyba.`)
    } finally {
      setBusyAction(null)
    }
  }
  const pushOne = (id: string) => callPush('one', [id], `Poslat ${id}`)
  const pushSelected = () => callPush('selected', Array.from(selectedIds), `Poslat vybrané (${selectedIds.size})`)
  const pushAll = () => callPush('all', undefined, `Poslat vše (${counts.inbox})`)
  const pullOne = (id: string) => callPush('pull', [id], `Vrátit ${id}`)

  const deleteMission = async (id: string) => {
    if (!globalThis.confirm(`Smazat misi ${id}?`)) return
    setBusyAction(`del-${id}`)
    try {
      const res = await fetch(`/api/hd-central/mission/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        setActionInfo('Smazání selhalo.')
        return
      }
      await refresh()
      setActionInfo(`Mise ${id} smazána.`)
    } catch {
      setActionInfo('Smazání selhalo — síťová chyba.')
    } finally {
      setBusyAction(null)
    }
  }

  const allVisibleSelected = visibleMissions.length > 0 && visibleMissions.every((m) => selectedIds.has(m.id))

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <section className="plastic-card-hi flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#00E085]">CEO / Mise</p>
          <h1 className="text-lg font-light uppercase tracking-[2px] text-[#f0f0f0]">Velín misí</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#A8A8A8]">
          {actionInfo && <span className="max-w-md truncate">{actionInfo}</span>}
          <span>{counts.all} celkem</span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Obnovit"
            className="inline-flex h-8 w-8 items-center justify-center border border-white/10 bg-black/50 text-[#A8A8A8] hover:text-[#1AEE99] disabled:opacity-30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* SLA alerts */}
      {slaAlerts.length > 0 && (
        <section className="plastic-card border-l-2 border-red-500/50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] uppercase tracking-widest text-red-300">SLA výstraha</span>
            <span className="text-[#D0D0D0]">
              {slaAlerts.filter((a) => a.status === 'breached').length} po termínu ·{' '}
              {slaAlerts.filter((a) => a.status === 'at_risk').length} blízko termínu
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {slaAlerts.slice(0, 8).map((a) => (
              <span
                key={a.missionId}
                title={`${a.ownerAgent} · severity ${a.severity} · deadline ${a.slaDeadline}`}
                className={`border px-1.5 py-0.5 text-[10px] ${
                  a.status === 'breached'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                {a.missionId} ({a.status === 'breached' ? `+${a.hoursOverdue}h` : 'blízko'})
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Unified filter bar */}
      <section className="plastic-card px-3 py-2.5">
        <MissionFilterBar filters={filters} counts={counts} onChange={patchFilters} />

        {/* Bulk action row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5">
          <button
            type="button"
            onClick={allVisibleSelected ? clearSelection : selectAllVisible}
            className="h-8 px-2 text-[11px] text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            {allVisibleSelected ? 'Zrušit výběr' : 'Vybrat vše'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-[11px] text-[#6E6E6E]">{selectedIds.size} vybráno</span>
          )}

          <span className="ml-auto" />

          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            title="Vlastní plánování — poslané mise dostanou tento čas startu"
            className="h-8 w-44 border border-white/10 bg-black/50 px-2 text-xs text-[#D0D0D0] backdrop-blur-xl"
          />
          {scheduledAt && (
            <button
              type="button"
              onClick={() => setScheduledAt('')}
              className="h-8 px-1 text-[11px] text-[#A8A8A8] hover:text-[#E8E8E8]"
            >
              zrušit čas
            </button>
          )}
          <Button
            onClick={pushSelected}
            disabled={selectedIds.size === 0 || !!busyAction}
            size="sm"
            className="h-8 gap-1.5 border border-[rgba(0,224,133,0.35)] bg-[rgba(0,224,133,0.12)] text-xs text-[#00E085] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-40"
          >
            {busyAction?.startsWith('Poslat vybrané') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Poslat vybrané
          </Button>
          <Button
            onClick={pushAll}
            disabled={counts.inbox === 0 || !!busyAction}
            size="sm"
            className="h-8 gap-1.5 border border-[rgba(0,224,133,0.45)] bg-[rgba(0,224,133,0.18)] text-xs text-[#1AEE99] hover:bg-[rgba(0,224,133,0.30)] disabled:opacity-40"
          >
            {busyAction?.startsWith('Poslat vše') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
            Poslat vše ({counts.inbox})
          </Button>
        </div>
      </section>

      {/* Listing */}
      <section className="plastic-card">
        {visibleMissions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#6E6E6E]">
            {filters.scope === 'inbox'
              ? 'Příchozí je prázdné. Plan Manager zatím nic neposlal.'
              : 'Žádné mise neodpovídají filtru.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] text-[#6E6E6E]">
                  <th className="w-8 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
                      className="accent-[#00E085]"
                      aria-label="Vybrat vše viditelné"
                    />
                  </th>
                  {(
                    [
                      ['Poř.', 'sequence', 'w-12 px-2 py-2'],
                      ['ID', 'id', 'px-2 py-2'],
                      ['Název', 'name', 'px-2 py-2'],
                      ['Fáze', 'phase', 'px-2 py-2'],
                      ['Doména', 'domain', 'px-2 py-2'],
                      ['Prio', 'priority', 'px-2 py-2'],
                      ['Urg.', 'urgency', 'px-2 py-2'],
                      ['Stav', 'status', 'px-2 py-2'],
                    ] as [string, MissionSortKey, string][]
                  ).map(([label, col, cls]) => (
                    <SortHeader
                      key={col}
                      label={label}
                      col={col}
                      sortKey={filters.sortKey}
                      sortDir={filters.sortDir}
                      onSort={sortByColumn}
                      className={cls}
                    />
                  ))}
                  <th className="w-28 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleMissions.map((m) => {
                  const isSelected = selectedIds.has(m.id)
                  const isInbox = m.inTimeline === false
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setDetailMission(m)}
                      className={`cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-white/[0.025] ${
                        isSelected ? 'bg-[#0d1f10]' : ''
                      }`}
                    >
                      <td className="py-2 pl-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(m.id)}
                          aria-label={`Vybrat ${m.id}`}
                          className="text-[#A8A8A8] hover:text-[#1AEE99]"
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4 text-[#00E085]" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-mono text-[#6E6E6E]">
                        {typeof m.sequenceIndex === 'number' ? `#${m.sequenceIndex + 1}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-[#A8A8A8]">
                        {m.id.length > 24 ? `${m.id.slice(0, 24)}…` : m.id}
                      </td>
                      <td className="max-w-[280px] px-2 py-2">
                        <p className="truncate text-[#E8E8E8]">{m.name}</p>
                        <p className="truncate text-[10px] text-[#6E6E6E]">{m.purpose}</p>
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`px-1.5 py-0 text-[10px] ${phaseBadgeClass(m.phase)}`}>{m.phase ?? '—'}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`px-1.5 py-0 text-[10px] ${domainBadgeClass(m.domains?.[0])}`}>
                          {m.domains?.[0] ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`px-1.5 py-0 text-[10px] ${priorityBadgeClass(m.priority)}`}>
                          {m.priority ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 font-mono text-[#D0D0D0]">{m.urgencyScore ?? 0}</td>
                      <td className="px-2 py-2">
                        {isInbox ? (
                          <span className="text-[10px] text-amber-300">příchozí</span>
                        ) : m.coldCase ? (
                          <span className="text-[10px] text-[#6EC3A1]">cold</span>
                        ) : (() => {
                          // P1-UI-001 — evidence-aware status: SIMULATED_ONLY must NOT
                          // read as green/DONE. Reasons surfaced on hover.
                          const ev = getEvidenceSummary(m)
                          return (
                            <span
                              className={`text-[10px] ${EVIDENCE_TEXT_TONE[ev.tone]}`}
                              title={ev.reasons.length ? `${ev.label}\n${ev.reasons.join('\n')}` : ev.label}
                            >
                              {m.lifecycleStatus ?? 'PLAN'}
                              {ev.state === 'simulated' && ' ⚠'}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isInbox ? (
                            <button
                              type="button"
                              onClick={() => pushOne(m.id)}
                              disabled={!!busyAction}
                              title="Poslat do Timeline"
                              className="inline-flex h-7 items-center gap-1 border border-[rgba(0,224,133,0.30)] bg-[rgba(0,224,133,0.10)] px-2 text-[10px] text-[#00E085] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-40"
                            >
                              {busyAction === `Poslat ${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                              → TL
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => pullOne(m.id)}
                              disabled={!!busyAction}
                              title="Vrátit do příchozích"
                              className="inline-flex h-7 items-center gap-1 border border-white/10 px-2 text-[10px] text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
                            >
                              {busyAction === `Vrátit ${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                              zpět
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteMission(m.id)}
                            disabled={!!busyAction}
                            title="Smazat"
                            aria-label={`Smazat ${m.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center text-[#404040] hover:text-red-400 disabled:opacity-40"
                          >
                            {busyAction === `del-${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                          <ChevronRight className="h-3.5 w-3.5 text-[#404040]" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-[#6E6E6E]">
          <span>
            {visibleMissions.length} z {counts.all} misí
            {selectedIds.size > 0 && ` · ${selectedIds.size} vybráno`}
          </span>
          <span className="flex items-center gap-1">
            {filters.scope === 'inbox' ? (
              <>
                <Send className="h-3 w-3" /> Poslat přesune misi do Timeline
              </>
            ) : filters.scope === 'timeline' ? (
              <>
                <Undo2 className="h-3 w-3" /> Zpět vrátí misi do příchozích
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" /> Klikni na řádek pro detail
              </>
            )}
          </span>
        </div>
      </section>

      <MissionDetailDrawer mission={detailMission} onClose={() => setDetailMission(null)} onPlanUpdate={setPlan} />
    </div>
  )
}
