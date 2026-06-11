/**
 * Mission Timeline state machine (UM-MISSIONS_UI — SM1).
 *
 * Defines the atomic, audited execution lifecycle of a mission on the CEO
 * Mission Timeline: draft → queued → running → done | failed.
 *
 * Pure module — no I/O, no framework imports — so it is unit-testable in
 * isolation. The file-based audit trail lives in `mission-audit-trail.ts`.
 */
import type { Mission, MissionTimelineTransition, TimelineState } from '@/lib/hd-central/types'

export const TIMELINE_STATES: readonly TimelineState[] = [
  'draft',
  'queued',
  'running',
  'done',
  'failed',
]

/**
 * Allowed transitions. A mission starts as `draft` in the inbox, is `queued`
 * when pushed to the timeline, goes `running` while worked, and ends `done`
 * or `failed`. `queued` can be pulled back to `draft`; `failed` can be retried.
 */
export const TIMELINE_TRANSITIONS: Record<TimelineState, readonly TimelineState[]> = {
  draft: ['queued'],
  queued: ['running', 'draft'],
  running: ['done', 'failed'],
  done: [],
  failed: ['queued'],
}

/** States from which no further transition is possible. */
export const TERMINAL_TIMELINE_STATES: readonly TimelineState[] = ['done']

/** True when `to` is a legal next state from `from`. */
export function canTransition(from: TimelineState, to: TimelineState): boolean {
  return TIMELINE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Resolves a mission's timeline state. Honors an explicit `timelineState`;
 * otherwise backfills one from legacy fields so missions created before this
 * feature still render correctly.
 */
export function deriveTimelineState(mission: Mission): TimelineState {
  if (mission.timelineState) return mission.timelineState
  if (mission.lifecycleStatus === 'MISSION_DONE') return 'done'
  if (mission.lifecycleStatus === 'AUDIT_PENDING') return 'failed'
  if (mission.inTimeline === false) return 'draft'
  if (mission.lifecycleStatus === 'ACTIVE' || mission.lifecycleStatus === 'CEO_RESOLVED') {
    return 'running'
  }
  return 'queued'
}

export type TimelineTransitionResult = {
  ok: boolean
  mission: Mission
  transition?: MissionTimelineTransition
  error?: string
}

/**
 * Atomically transitions a mission's timeline state.
 *
 * Validates the transition BEFORE applying it: on an illegal or no-op
 * transition the mission is returned unchanged with `ok: false`. On success
 * the new state and a transition record are applied together in one step —
 * `timelineState` is never updated without a matching `timelineLog` entry.
 */
export function transitionTimelineState(
  mission: Mission,
  to: TimelineState,
  actor: string,
  reason: string,
): TimelineTransitionResult {
  const from = deriveTimelineState(mission)

  if (from === to) {
    return { ok: false, mission, error: `mission already in '${to}'` }
  }
  if (!canTransition(from, to)) {
    return { ok: false, mission, error: `illegal transition '${from}' -> '${to}'` }
  }

  const transition: MissionTimelineTransition = {
    ts: new Date().toISOString(),
    from,
    to,
    actor: actor || 'SYSTEM',
    reason: reason || `${from} -> ${to}`,
  }

  const next: Mission = {
    ...mission,
    timelineState: to,
    timelineLog: [...(mission.timelineLog ?? []), transition],
  }

  return { ok: true, mission: next, transition }
}
