/**
 * Unified mission filtering (HD Central UI upgrade).
 *
 * One filter model + one pure selector shared by every Missions surface
 * (CEO Missions, Timeline, Mission Centrum). Replaces the previously divergent
 * `InboxFilter` (missions-section) and `LocationFilter` (user-missions-panel)
 * models. Pure + framework-free → unit-testable under `node --test`.
 */

import type { Mission, Phase, Priority } from './types'

/** Where a mission sits in the lifecycle — the primary segment of the filter bar. */
export type MissionScope = 'inbox' | 'timeline' | 'spec_ops' | 'done' | 'all'

/** Sortable columns — drives clickable table headers. */
export type MissionSortKey =
  | 'sequence'
  | 'id'
  | 'name'
  | 'phase'
  | 'domain'
  | 'priority'
  | 'urgency'
  | 'status'
  | 'created'

export type SortDir = 'asc' | 'desc'

export interface MissionFilters {
  scope: MissionScope
  priority: 'all' | Priority
  phase: 'all' | Phase
  search: string
  sortKey: MissionSortKey
  sortDir: SortDir
  /**
   * Hide MISSION_DONE missions across every scope except the dedicated "done"
   * segment. Lets the CEO clear finished noise from inbox/timeline/all without
   * losing the ability to inspect the archive via the Hotové tab.
   */
  hideDone: boolean
}

export const DEFAULT_MISSION_FILTERS: MissionFilters = {
  scope: 'inbox',
  priority: 'all',
  phase: 'all',
  search: '',
  sortKey: 'sequence',
  sortDir: 'asc',
  hideDone: false,
}

/** Sensible initial direction when a column is first selected. */
export const DEFAULT_SORT_DIR: Record<MissionSortKey, SortDir> = {
  sequence: 'asc',
  id: 'asc',
  name: 'asc',
  phase: 'asc',
  domain: 'asc',
  priority: 'asc', // P0 first
  urgency: 'desc', // highest first
  status: 'asc',
  created: 'desc', // newest first
}

const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

/** A mission is "in the timeline" unless explicitly flagged out (back-compat: undefined = true). */
export function isInTimeline(m: Mission): boolean {
  return m.inTimeline !== false
}
export function isInbox(m: Mission): boolean {
  return m.inTimeline === false
}
export function isDone(m: Mission): boolean {
  return m.lifecycleStatus === 'MISSION_DONE'
}
/** SPEC OPS = open user-curated missions (done ones graduate to the DONE scope). */
export function isSpecOps(m: Mission): boolean {
  return m.userMission === true && m.lifecycleStatus !== 'MISSION_DONE'
}

/** Does a mission belong to the given scope? (deleted missions never match.) */
export function matchesScope(m: Mission, scope: MissionScope): boolean {
  if (m.isDeleted) return false
  switch (scope) {
    case 'inbox':
      return isInbox(m)
    case 'timeline':
      return isInTimeline(m)
    case 'spec_ops':
      return isSpecOps(m)
    case 'done':
      return isDone(m)
    case 'all':
      return true
  }
}

function matchesSearch(m: Mission, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    m.id.toLowerCase().includes(needle) ||
    m.name.toLowerCase().includes(needle) ||
    (m.purpose ?? '').toLowerCase().includes(needle) ||
    (m.moduleId ?? '').toLowerCase().includes(needle)
  )
}

/** Ascending comparator for a single column (direction is applied by the caller). */
function compareByKey(a: Mission, b: Mission, key: MissionSortKey): number {
  switch (key) {
    case 'urgency':
      return (a.urgencyScore ?? 0) - (b.urgencyScore ?? 0)
    case 'priority': {
      const ar = a.priority ? PRIORITY_RANK[a.priority] : 99
      const br = b.priority ? PRIORITY_RANK[b.priority] : 99
      return ar - br
    }
    case 'id':
      return a.id.localeCompare(b.id)
    case 'name':
      return a.name.localeCompare(b.name)
    case 'phase':
      return (a.phase ?? '').localeCompare(b.phase ?? '')
    case 'domain':
      return (a.domains?.[0] ?? '').localeCompare(b.domains?.[0] ?? '')
    case 'status':
      return (a.lifecycleStatus ?? '').localeCompare(b.lifecycleStatus ?? '')
    case 'created':
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    case 'sequence':
    default: {
      const ai = typeof a.sequenceIndex === 'number' ? a.sequenceIndex : Number.POSITIVE_INFINITY
      const bi = typeof b.sequenceIndex === 'number' ? b.sequenceIndex : Number.POSITIVE_INFINITY
      return ai - bi
    }
  }
}

/**
 * Apply the full filter set to a mission list. Pure — returns a new sorted array.
 * Sort = chosen column × direction, with a stable urgency-desc tiebreak.
 */
export function applyMissionFilters(missions: readonly Mission[], filters: MissionFilters): Mission[] {
  const dir = filters.sortDir === 'desc' ? -1 : 1
  return missions
    .filter((m) => matchesScope(m, filters.scope))
    // "Hide done" never hides the dedicated Hotové segment — there it would
    // empty the list; everywhere else it strips finished missions.
    .filter((m) => !filters.hideDone || filters.scope === 'done' || !isDone(m))
    .filter((m) => filters.priority === 'all' || m.priority === filters.priority)
    .filter((m) => filters.phase === 'all' || m.phase === filters.phase)
    .filter((m) => matchesSearch(m, filters.search))
    .slice()
    .sort((a, b) => {
      const primary = compareByKey(a, b, filters.sortKey) * dir
      if (primary !== 0) return primary
      // Stable, intuitive tiebreak: higher urgency first.
      return (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
    })
}

export type ScopeCounts = Record<MissionScope, number>

/** Per-scope counts for the segment badges (deleted excluded). */
export function computeScopeCounts(missions: readonly Mission[]): ScopeCounts {
  const live = missions.filter((m) => !m.isDeleted)
  return {
    inbox: live.filter(isInbox).length,
    timeline: live.filter(isInTimeline).length,
    spec_ops: live.filter(isSpecOps).length,
    done: live.filter(isDone).length,
    all: live.length,
  }
}
