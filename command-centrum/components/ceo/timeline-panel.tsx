'use client'

import { memo, useState } from 'react'
import type { Mission } from '@/lib/hd-central/types'
import { missionLifecycleStatus } from '@/lib/hd-central/lifecycle'
import { cn } from '@/lib/utils'
import { InfoBadge } from '@/components/info/info-badge'
import {
  AlertTriangle,
  CheckCircle2,
  Filter as FilterIcon,
  RefreshCw,
  Snowflake,
  Trash2,
  ChevronDown,
  X,
  Zap,
} from 'lucide-react'

type UrgencyFilter = 'all' | 'P0' | 'P1' | 'P2' | 'P3'
type PhaseFilter = 'all' | 'Foundation' | 'Build' | 'Validate' | 'Launch' | 'Scale'
type DateFilter = 'all' | '24h' | '7d' | '30d'

function withinDateWindow(iso: string | undefined, window: DateFilter): boolean {
  if (window === 'all') return true
  if (!iso) return false
  const created = new Date(iso).getTime()
  if (Number.isNaN(created)) return false
  const ms =
    window === '24h' ? 86_400_000 : window === '7d' ? 604_800_000 : 2_592_000_000
  return Date.now() - created <= ms
}

/* ------------------------------------------------------------------ */
/* tone selection                                                      */
/* ------------------------------------------------------------------ */

type Tone = 'p0' | 'p1' | 'p2' | 'p3' | 'critical' | 'done' | 'simulated'

function pickTone(m: Mission): Tone {
  const lc = missionLifecycleStatus(m)
  if (lc === 'MISSION_DONE') return 'done'
  // UM-MISSION_TRUTH_GATE / #05 — SIMULATED_ONLY must NEVER share styling with
  // MISSION_DONE. Amber/yellow tone signals "sub-missions done, evidence pack
  // missing — re-validate before promoting".
  if (lc === 'SIMULATED_ONLY' || m.auditReport?.verdict === 'SIMULATED_ONLY') return 'simulated'
  const isCritical = m.status === 'blocked' || m.auditReport?.verdict === 'FAIL'
  if (isCritical) return 'critical'
  const u = m.urgencyScore ?? 0
  if (u >= 85 || m.priority === 'P0') return 'p0'
  if (u >= 60 || m.priority === 'P1') return 'p1'
  if (u >= 35 || m.priority === 'P2') return 'p2'
  return 'p3'
}

function pillClass(tone: Tone): string {
  switch (tone) {
    case 'done':
      return 'tl-ms-pill border-[#00E085]/40 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
    case 'simulated':
      return 'tl-ms-pill border-[#FFB020]/50 bg-[rgba(255,176,32,0.12)] text-[#FFB020]'
    case 'critical':
      return 'tl-ms-pill tl-ms-pill-critical'
    case 'p0':
      return 'tl-ms-pill tl-ms-pill-p0'
    case 'p1':
      return 'tl-ms-pill tl-ms-pill-p1'
    case 'p2':
      return 'tl-ms-pill tl-ms-pill-p2'
    case 'p3':
    default:
      return 'tl-ms-pill tl-ms-pill-p3'
  }
}

/* ------------------------------------------------------------------ */
/* Milestone row — pill | connector | arrow card                       */
/* ------------------------------------------------------------------ */

function MilestoneRow({
  mission,
  tone,
  selected,
  size = 'md',
  dim = false,
  onClick,
  onColdCase,
  onDelete,
  isBusy,
  style,
}: {
  mission: Mission
  tone: Tone
  selected: boolean
  size?: 'md' | 'lg'
  dim?: boolean
  onClick: () => void
  onColdCase: () => void
  onDelete: () => void
  isBusy: boolean
  style?: React.CSSProperties
}) {
  const isCritical = tone === 'critical'
  const isDone = tone === 'done'
  const purpose =
    mission.purpose?.trim() ||
    mission.description?.trim() ||
    'No purpose recorded.'

  return (
    <div
      className={cn(
        'tl-ms-row tl-ms-row-enter group',
        size === 'lg' && 'tl-ms-row-lg',
        dim && 'tl-ms-row-dim',
      )}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Open mission ${mission.name}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      style={style}
    >
      {/* Pill anchor on the central rail */}
      <div className={pillClass(tone)}>
        {mission.priority ? (
          <InfoBadge term={`priority-${mission.priority}`} noFocus className="!border-0">
            <span className="tl-ms-pill-priority">{mission.priority}</span>
          </InfoBadge>
        ) : (
          <span className="tl-ms-pill-priority">—</span>
        )}
        <InfoBadge term="urgency-score" noFocus className="!border-0">
          <span className="tl-ms-pill-urgency">{mission.urgencyScore ?? 0}</span>
        </InfoBadge>
      </div>

      {/* Horizontal connector with end dot */}
      <div
        className={cn(
          'tl-ms-connector',
          isCritical && 'tl-ms-connector-critical',
        )}
        aria-hidden
      />

      {/* Arrow-notch card */}
      <article
        className={cn(
          'tl-ms-card',
          selected && 'tl-ms-card-active',
          isCritical && 'tl-ms-card-critical',
          isDone && 'border-[#00E085]/40 bg-[rgba(0,224,133,0.05)]',
        )}
      >
        <span className="tl-ms-shimmer" aria-hidden />

        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={cn('tl-ms-name truncate', isDone && 'line-through text-[#6EC3A1]')}>
              {mission.name}
            </div>
            <p className="tl-ms-purpose">{purpose}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="tl-ms-id">{mission.id}</span>
            {isCritical && (
              <span className="tl-ms-critical-badge">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                CRITICAL
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-bold border border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                SPLNĚNO
              </span>
            )}
          </div>
        </header>

        <footer className="mt-2 flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            className="tl-ms-action"
            title="Move to cold case"
            aria-label="Move mission to cold case"
            disabled={isBusy || mission.coldCase}
            onClick={(event) => {
              event.stopPropagation()
              if (!isBusy) onColdCase()
            }}
          >
            <Snowflake className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            className="tl-ms-action"
            title="Delete mission"
            aria-label="Delete mission"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation()
              if (!isBusy) onDelete()
            }}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        </footer>
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* main panel                                                          */
/* ------------------------------------------------------------------ */

export const TimelinePanel = memo(function TimelinePanel({
  missions,
  selectedId,
  onSelect,
  onRefresh,
  onSolveAll,
  onMoveToColdCase,
  onDeleteMission,
  isBusy,
}: {
  missions: Mission[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
  onSolveAll: () => void
  onMoveToColdCase: (missionId: string) => void
  onDeleteMission: (missionId: string) => void
  isBusy: boolean
}) {
  const [coldCaseOpen, setColdCaseOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const filtersDirty = urgencyFilter !== 'all' || phaseFilter !== 'all' || dateFilter !== 'all'
  const resetFilters = () => {
    setUrgencyFilter('all')
    setPhaseFilter('all')
    setDateFilter('all')
  }

  const matchesFilters = (m: Mission): boolean => {
    if (urgencyFilter !== 'all' && m.priority !== urgencyFilter) return false
    if (phaseFilter !== 'all' && m.phase !== phaseFilter) return false
    if (!withinDateWindow(m.createdAt, dateFilter)) return false
    return true
  }

  // Chronological / execution order: sequenced missions first by sequenceIndex,
  // then by urgency. Used for every "in-flight" bucket so the rail reads top→down
  // in the order work actually happens.
  const bySequence = (a: Mission, b: Mission): number => {
    const aIdx = typeof a.sequenceIndex === 'number' ? a.sequenceIndex : Number.POSITIVE_INFINITY
    const bIdx = typeof b.sequenceIndex === 'number' ? b.sequenceIndex : Number.POSITIVE_INFINITY
    if (aIdx !== bIdx) return aIdx - bIdx
    return (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
  }

  // The timeline must contain EVERY non-deleted mission, grouped logically by
  // lifecycle (Active → Queue → Audit pending → Other → Cold case → Done) and
  // ordered chronologically within each bucket. Previously only PLAN missions
  // were shown, so AUDIT_PENDING + other states (the majority) were invisible.
  const live = missions.filter((m) => !m.isDeleted)
  const activeMission = live.find((m) => missionLifecycleStatus(m) === 'ACTIVE') ?? null
  const coldCaseMissions = live.filter(
    (m) => m.coldCase && missionLifecycleStatus(m) !== 'MISSION_DONE',
  )
  const inFlight = live.filter((m) => !m.coldCase && m !== activeMission)
  const timelineMissions = inFlight
    .filter((m) => missionLifecycleStatus(m) === 'PLAN' && matchesFilters(m))
    .sort(bySequence)
  const reviewMissions = inFlight
    .filter((m) => missionLifecycleStatus(m) === 'AUDIT_PENDING' && matchesFilters(m))
    .sort(bySequence)
  // Catch-all so no lifecycle state (e.g. SIMULATED_ONLY, CEO_REVIEW) can hide.
  const otherMissions = inFlight
    .filter((m) => {
      const lc = missionLifecycleStatus(m)
      return (
        lc !== 'ACTIVE' &&
        lc !== 'PLAN' &&
        lc !== 'AUDIT_PENDING' &&
        lc !== 'MISSION_DONE' &&
        matchesFilters(m)
      )
    })
    .sort(bySequence)
  const doneMissions = live
    .filter((m) => missionLifecycleStatus(m) === 'MISSION_DONE')
    .sort((a, b) => {
      const aTs = a.auditReport?.timestamp ?? a.createdAt ?? ''
      const bTs = b.auditReport?.timestamp ?? b.createdAt ?? ''
      return bTs.localeCompare(aTs)
    })

  const hasCriticalInTimeline = timelineMissions.some(
    (m) => pickTone(m) === 'critical',
  )

  return (
    <aside className="w-100 shrink-0 border-l border-white/10 bg-[#070707]/95 backdrop-blur-md flex flex-col h-full min-h-0">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 px-3.5 py-2.5 border-b border-white/10 bg-[#070707]/85 backdrop-blur-md flex items-center gap-2 shrink-0">
        <Zap
          className="h-3.5 w-3.5 text-[#00E085] filter-[drop-shadow(0_0_4px_rgba(0,224,133,0.55))]"
          aria-hidden
        />
        <span className="tl-ms-section-title">Mission Timeline</span>
        <span className="text-[10px] text-[#6E6E6E] font-mono">
          [{timelineMissions.length} fronta · {reviewMissions.length} ověření · {doneMissions.length} hotovo]
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            title="Filter timeline"
            className={cn(
              'h-7 w-7 inline-flex items-center justify-center border transition-all duration-200',
              filtersDirty
                ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]'
                : 'border-white/15 bg-white/3 text-[#A8A8A8] hover:text-[#1AEE99] hover:border-[#00E085]/40',
            )}
          >
            <FilterIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSolveAll}
            disabled={isBusy || timelineMissions.length === 0}
            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] font-bold bg-[rgba(0,224,133,0.10)] backdrop-blur-md border border-[#00E085]/45 text-[#00E085] hover:bg-[rgba(0,224,133,0.18)] hover:text-[#1AEE99] hover:border-[#00E085]/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[rgba(0,224,133,0.10)] disabled:hover:text-[#00E085] disabled:hover:border-[#00E085]/45"
            title="Solve all missions in urgency order"
          >
            Solve All
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            className="h-7 w-7 inline-flex items-center justify-center border border-white/15 bg-white/3 text-[#A8A8A8] hover:text-[#1AEE99] hover:border-[#00E085]/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sync timeline"
            aria-label="Sync timeline"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isBusy && 'animate-spin')}
            />
          </button>
        </div>
      </header>

      {/* Filter panel (collapsible) */}
      {filtersOpen && (
        <div className="px-3.5 py-2 border-b border-white/10 bg-black/40 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1 flex-wrap text-[9px] uppercase tracking-widest">
            <span className="text-[#6E6E6E] mr-1">date:</span>
            {(['all', '24h', '7d', '30d'] as DateFilter[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDateFilter(d)}
                className={cn(
                  'px-1.5 py-0.5 border transition-colors',
                  dateFilter === d
                    ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]'
                    : 'border-white/10 bg-white/3 text-[#A8A8A8] hover:text-[#E8E8E8]',
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap text-[9px] uppercase tracking-widest">
            <span className="text-[#6E6E6E] mr-1">urgency:</span>
            {(['all', 'P0', 'P1', 'P2', 'P3'] as UrgencyFilter[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgencyFilter(u)}
                className={cn(
                  'px-1.5 py-0.5 border transition-colors',
                  urgencyFilter === u
                    ? u === 'P0'
                      ? 'border-red-500/45 bg-red-500/12 text-red-300'
                      : u === 'P1'
                      ? 'border-amber-500/45 bg-amber-500/12 text-amber-300'
                      : u === 'P2'
                      ? 'border-blue-500/45 bg-blue-500/12 text-blue-300'
                      : 'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]'
                    : 'border-white/10 bg-white/3 text-[#A8A8A8] hover:text-[#E8E8E8]',
                )}
              >
                {u}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap text-[9px] uppercase tracking-widest">
            <span className="text-[#6E6E6E] mr-1">phase:</span>
            {(['all', 'Foundation', 'Build', 'Validate', 'Launch', 'Scale'] as PhaseFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhaseFilter(p)}
                className={cn(
                  'px-1.5 py-0.5 border transition-colors',
                  phaseFilter === p
                    ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]'
                    : 'border-white/10 bg-white/3 text-[#A8A8A8] hover:text-[#E8E8E8]',
                )}
              >
                {p === 'all' ? 'all' : p.slice(0, 4)}
              </button>
            ))}
          </div>
          {filtersDirty && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[10px] text-[#A8A8A8] hover:text-[#E8E8E8]"
            >
              <X className="h-3 w-3" /> Reset filters
            </button>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 min-h-0">
        {/* ACTIVE MISSION — pinned, larger */}
        <section>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span className="tl-ms-section-title">Active Mission</span>
            <div className="tl-ms-divider flex-1" />
          </div>

          {activeMission ? (
            <div className="tl-ms-rail-wrapper relative">
              <div className="tl-ms-rail" aria-hidden />
              <MilestoneRow
                mission={activeMission}
                tone={pickTone(activeMission)}
                selected={selectedId === activeMission.id}
                size="lg"
                onClick={() => onSelect(activeMission.id)}
                onColdCase={() => onMoveToColdCase(activeMission.id)}
                onDelete={() => onDeleteMission(activeMission.id)}
                isBusy={isBusy}
              />
            </div>
          ) : (
            <div className="text-[11px] text-[#6E6E6E] italic px-1 py-2">
              Idle. No mission promoted from PLAN.
            </div>
          )}
        </section>

        {/* TIMELINE — milestone rail */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="tl-ms-section-title">Timeline</span>
            <div className="tl-ms-divider flex-1" />
            <span className="font-mono text-[9px] text-[#6E6E6E]">
              {timelineMissions.length}
            </span>
          </div>

          {timelineMissions.length === 0 ? (
            <div className="text-[11px] text-[#6E6E6E] italic px-1 py-3">
              Queue is clear. No missions waiting in PLAN.
            </div>
          ) : (
            <div className="tl-ms-rail-wrapper relative">
              <div
                className={cn(
                  'tl-ms-rail',
                  hasCriticalInTimeline && 'tl-ms-rail-critical',
                )}
                aria-hidden
              />
              <div className="flex flex-col gap-4">
                {timelineMissions.map((mission, idx) => (
                  <MilestoneRow
                    key={mission.id}
                    mission={mission}
                    tone={pickTone(mission)}
                    selected={selectedId === mission.id}
                    onClick={() => onSelect(mission.id)}
                    onColdCase={() => onMoveToColdCase(mission.id)}
                    onDelete={() => onDeleteMission(mission.id)}
                    isBusy={isBusy}
                    style={{ animationDelay: `${idx * 70}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* AUDIT PENDING — solved, awaiting verification. Previously hidden. */}
        <section>
          <button
            type="button"
            onClick={() => setReviewOpen((value) => !value)}
            aria-expanded={reviewOpen}
            className="w-full flex items-center gap-2 px-1 py-1 group"
          >
            <AlertTriangle className="h-3 w-3 text-[#FFB020] shrink-0" aria-hidden />
            <span className="uppercase tracking-[0.18em] text-[10px] font-bold text-[#FFB020] group-hover:text-[#00E085] transition-colors">
              Čeká na ověření
            </span>
            <div className="tl-ms-divider flex-1" />
            <span className="font-mono text-[9px] text-[#6E6E6E]">{reviewMissions.length}</span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-[#6E6E6E] group-hover:text-[#A8A8A8] transition-all duration-200',
                reviewOpen && 'rotate-180',
              )}
            />
          </button>

          {reviewOpen && (
            <div className="mt-3">
              {reviewMissions.length === 0 ? (
                <div className="text-[11px] text-[#6E6E6E] italic px-1 py-2">
                  Nic nečeká na ověření.
                </div>
              ) : (
                <div className="tl-ms-rail-wrapper relative">
                  <div className="tl-ms-rail" aria-hidden />
                  <div className="flex flex-col gap-3">
                    {reviewMissions.map((mission, idx) => (
                      <MilestoneRow
                        key={mission.id}
                        mission={mission}
                        tone={pickTone(mission)}
                        selected={selectedId === mission.id}
                        onClick={() => onSelect(mission.id)}
                        onColdCase={() => onMoveToColdCase(mission.id)}
                        onDelete={() => onDeleteMission(mission.id)}
                        isBusy={isBusy}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* OTHER — any remaining lifecycle state, so nothing is ever hidden. */}
        {otherMissions.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setOtherOpen((value) => !value)}
              aria-expanded={otherOpen}
              className="w-full flex items-center gap-2 px-1 py-1 group"
            >
              <FilterIcon className="h-3 w-3 text-[#A8A8A8] shrink-0" aria-hidden />
              <span className="uppercase tracking-[0.18em] text-[10px] font-bold text-[#A8A8A8] group-hover:text-[#00E085] transition-colors">
                Ostatní
              </span>
              <div className="tl-ms-divider flex-1" />
              <span className="font-mono text-[9px] text-[#6E6E6E]">{otherMissions.length}</span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-[#6E6E6E] group-hover:text-[#A8A8A8] transition-all duration-200',
                  otherOpen && 'rotate-180',
                )}
              />
            </button>

            {otherOpen && (
              <div className="mt-3">
                <div className="tl-ms-rail-wrapper relative">
                  <div className="tl-ms-rail" aria-hidden />
                  <div className="flex flex-col gap-3">
                    {otherMissions.map((mission, idx) => (
                      <MilestoneRow
                        key={mission.id}
                        mission={mission}
                        tone={pickTone(mission)}
                        selected={selectedId === mission.id}
                        onClick={() => onSelect(mission.id)}
                        onColdCase={() => onMoveToColdCase(mission.id)}
                        onDelete={() => onDeleteMission(mission.id)}
                        isBusy={isBusy}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* COLD CASE — collapsed, dimmer rows, same milestone layout */}
        <section>
          <button
            type="button"
            onClick={() => setColdCaseOpen((value) => !value)}
            aria-expanded={coldCaseOpen}
            className="w-full flex items-center gap-2 px-1 py-1 group"
          >
            <Snowflake
              className="h-3 w-3 text-[#6EC3A1] shrink-0"
              aria-hidden
            />
            <span className="uppercase tracking-[0.18em] text-[10px] font-bold text-[#6EC3A1] group-hover:text-[#00E085] transition-colors">
              Cold Case
            </span>
            <div className="tl-ms-divider flex-1" />
            <span className="font-mono text-[9px] text-[#6E6E6E]">
              {coldCaseMissions.length}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-[#6E6E6E] group-hover:text-[#A8A8A8] transition-all duration-200',
                coldCaseOpen && 'rotate-180',
              )}
            />
          </button>

          {coldCaseOpen && (
            <div className="mt-3">
              {coldCaseMissions.length === 0 ? (
                <div className="text-[11px] text-[#6E6E6E] italic px-1 py-2">
                  Cold case shelf is empty.
                </div>
              ) : (
                <div className="tl-ms-rail-wrapper relative">
                  <div className="tl-ms-rail" aria-hidden />
                  <div className="flex flex-col gap-3">
                    {coldCaseMissions.map((mission, idx) => (
                      <MilestoneRow
                        key={mission.id}
                        mission={mission}
                        tone={pickTone(mission)}
                        selected={selectedId === mission.id}
                        dim
                        onClick={() => onSelect(mission.id)}
                        onColdCase={() => onMoveToColdCase(mission.id)}
                        onDelete={() => onDeleteMission(mission.id)}
                        isBusy={isBusy}
                        style={{ animationDelay: `${idx * 60}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SPLNĚNÉ — completed missions */}
        <section>
          <button
            type="button"
            onClick={() => setDoneOpen((value) => !value)}
            aria-expanded={doneOpen}
            className="w-full flex items-center gap-2 px-1 py-1 group"
          >
            <CheckCircle2
              className="h-3 w-3 text-[#1AEE99] shrink-0"
              aria-hidden
            />
            <span className="uppercase tracking-[0.18em] text-[10px] font-bold text-[#1AEE99] group-hover:text-[#00E085] transition-colors">
              Splněné
            </span>
            <div className="tl-ms-divider flex-1" />
            <span className="font-mono text-[9px] text-[#6E6E6E]">
              {doneMissions.length}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-[#6E6E6E] group-hover:text-[#A8A8A8] transition-all duration-200',
                doneOpen && 'rotate-180',
              )}
            />
          </button>

          {doneOpen && (
            <div className="mt-3">
              {doneMissions.length === 0 ? (
                <div className="text-[11px] text-[#6E6E6E] italic px-1 py-2">
                  Zatím nic nedokončeno.
                </div>
              ) : (
                <div className="tl-ms-rail-wrapper relative">
                  <div className="tl-ms-rail" aria-hidden />
                  <div className="flex flex-col gap-3">
                    {doneMissions.map((mission, idx) => (
                      <MilestoneRow
                        key={mission.id}
                        mission={mission}
                        tone={pickTone(mission)}
                        selected={selectedId === mission.id}
                        dim
                        onClick={() => onSelect(mission.id)}
                        onColdCase={() => onMoveToColdCase(mission.id)}
                        onDelete={() => onDeleteMission(mission.id)}
                        isBusy={isBusy}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Hard empty state */}
        {missions.length === 0 && (
          <div className="text-[11px] text-[#6E6E6E] italic px-1 py-3 text-center">
            No missions in the system. Add a mission to begin.
          </div>
        )}
      </div>
    </aside>
  )
})
