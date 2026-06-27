/**
 * Unified mission health + reason codes (PM-MISS-001).
 *
 * Problem: mission status was derived ad-hoc across surfaces — evidence tone in
 * one place, SLA alerts in another, inbox/timeline in a third — so the Mise card
 * could show a colour with no explanation ("prázdná hláška"). This module is the
 * single rule set: ONE evaluator that maps every mission to a `MissionHealthState`
 * (green/amber/red/neutral) AND an explicit `reason_code` + human reason that is
 * never empty (fallback `UNKNOWN`).
 *
 * Composes the existing pure helpers (`slaStatus`, `getEvidenceSummary`) rather
 * than re-deriving them, so SLA + evidence semantics stay in one place each.
 * Pure + framework-free → unit-testable under `tsx --test`.
 */
import type { Mission } from './types'
import { slaStatus } from './mission-sla'
import { getEvidenceSummary } from './evidence-summary'

export type MissionHealthState = 'green' | 'amber' | 'red' | 'neutral'

/**
 * Explicit, stable reason for a mission's health. Ordered by evaluation
 * precedence (first match wins). Persist/telemetry-safe — append new codes, do
 * not renumber.
 */
export type MissionReasonCode =
  | 'DELETED' // soft-deleted
  | 'ARCHIVED' // retired / superseded
  | 'DONE_VERIFIED' // MISSION_DONE
  | 'DONE_SIMULATED' // SIMULATED_ONLY (closed without real evidence)
  | 'EVIDENCE_REJECTED' // auditor rejected the evidence pack
  | 'BLOCKED_ORPHAN_FOLLOWUP' // follow-up whose parent no longer exists
  | 'SLA_BREACHED' // past slaDeadline and not done
  | 'BLOCKED_COLD_CASE' // parked, awaiting a CEO decision
  | 'SLA_AT_RISK' // deadline within the at-risk window
  | 'READY_FOR_SIGNOFF' // all sub-missions done, not yet promoted
  | 'IN_INBOX' // not on the timeline yet
  | 'OPEN_SUBMISSIONS' // in flight with sub-missions still open
  | 'ACTIVE_ON_TRACK' // running, no blockers
  | 'PLAN_READY' // planned, not started
  | 'UNKNOWN' // fallback — never leaves a mission without a reason

interface ReasonMeta {
  state: MissionHealthState
  /** Base Czech reason. The evaluator may append a dynamic suffix. */
  label: string
}

/** reason_code → { health state, base label }. The single mapping table. */
export const REASON_META: Record<MissionReasonCode, ReasonMeta> = {
  DELETED: { state: 'neutral', label: 'Smazáno' },
  ARCHIVED: { state: 'neutral', label: 'Archivováno — vyřazeno/superseded' },
  DONE_VERIFIED: { state: 'green', label: 'Hotová a ověřená (MISSION_DONE)' },
  DONE_SIMULATED: { state: 'amber', label: 'Uzavřená bez důkazu (SIMULATED_ONLY)' },
  EVIDENCE_REJECTED: { state: 'red', label: 'Důkaz zamítnut auditorem' },
  BLOCKED_ORPHAN_FOLLOWUP: { state: 'red', label: 'Blokováno — follow-up bez živého rodiče' },
  SLA_BREACHED: { state: 'red', label: 'Po termínu (SLA)' },
  BLOCKED_COLD_CASE: { state: 'amber', label: 'Cold case — čeká na rozhodnutí CEO' },
  SLA_AT_RISK: { state: 'amber', label: 'Blízko termínu (SLA)' },
  READY_FOR_SIGNOFF: { state: 'amber', label: 'Submise hotové — čeká na auditorský podpis' },
  IN_INBOX: { state: 'neutral', label: 'Příchozí — čeká na zařazení do timeline' },
  OPEN_SUBMISSIONS: { state: 'amber', label: 'Rozpracováno — otevřené submise' },
  ACTIVE_ON_TRACK: { state: 'green', label: 'Aktivní, bez blokace' },
  PLAN_READY: { state: 'neutral', label: 'Naplánováno, nezahájeno' },
  UNKNOWN: { state: 'neutral', label: 'Stav nelze jednoznačně určit' },
}

export interface MissionHealth {
  state: MissionHealthState
  reasonCode: MissionReasonCode
  /** Explicit Czech reason — guaranteed non-empty (PM-MISS-001 criteria #3). */
  reason: string
  /** Optional secondary detail (e.g. "2/5 submisí hotovo"). */
  detail?: string
}

export interface MissionHealthContext {
  now?: Date
  /**
   * Known live mission ids — enables orphan-follow-up detection. Omit to skip
   * that check (a per-mission call without the full plan still works).
   */
  knownIds?: ReadonlySet<string>
}

function build(code: MissionReasonCode, opts: { suffix?: string; detail?: string } = {}): MissionHealth {
  const meta = REASON_META[code]
  return {
    state: meta.state,
    reasonCode: code,
    reason: opts.suffix ? `${meta.label} — ${opts.suffix}` : meta.label,
    ...(opts.detail ? { detail: opts.detail } : {}),
  }
}

/**
 * Single source of truth for a mission's health + reason. First matching rule
 * wins (codes are ordered by precedence in `MissionReasonCode`).
 */
export function evaluateMissionHealth(mission: Mission, ctx: MissionHealthContext = {}): MissionHealth {
  const now = ctx.now ?? new Date()
  const life = mission.lifecycleStatus

  // ── terminal / meta states ────────────────────────────────────────────────
  if (mission.isDeleted) return build('DELETED')
  if (life === 'ARCHIVED') return build('ARCHIVED')
  if (life === 'MISSION_DONE') return build('DONE_VERIFIED')
  if (life === 'SIMULATED_ONLY') return build('DONE_SIMULATED')

  // ── evidence rejection (auditor said FAIL) ────────────────────────────────
  const evidence = getEvidenceSummary(mission)
  if (evidence.state === 'rejected') {
    return build('EVIDENCE_REJECTED', { suffix: evidence.reasons[0] })
  }

  // ── structural + time blockers (most urgent first) ────────────────────────
  if (mission.followUpOf && ctx.knownIds && !ctx.knownIds.has(mission.followUpOf)) {
    return build('BLOCKED_ORPHAN_FOLLOWUP', { suffix: `rodič ${mission.followUpOf}` })
  }

  const sla = slaStatus(mission, now)
  if (sla === 'breached') return build('SLA_BREACHED', { suffix: mission.slaDeadline ?? undefined })
  if (mission.coldCase) return build('BLOCKED_COLD_CASE')
  if (sla === 'at_risk') return build('SLA_AT_RISK', { suffix: mission.slaDeadline ?? undefined })

  // ── sub-mission progress ──────────────────────────────────────────────────
  const subs = mission.subMissions ?? []
  if (subs.length > 0) {
    const done = subs.filter((s) => s.status === 'done').length
    const detail = `${done}/${subs.length} submisí hotovo`
    if (done === subs.length) return build('READY_FOR_SIGNOFF', { detail })
    // Inbox missions are expected to have open subs — that's neutral, not amber.
    if (mission.inTimeline === false) return build('IN_INBOX', { detail })
    return build('OPEN_SUBMISSIONS', { detail })
  }

  // ── placement / lifecycle fallbacks ───────────────────────────────────────
  if (mission.inTimeline === false) return build('IN_INBOX')
  if (life === 'ACTIVE' || life === 'CEO_RESOLVED' || life === 'AUDIT_PENDING') return build('ACTIVE_ON_TRACK')
  if (life === 'PLAN' || life === undefined) return build('PLAN_READY')

  return build('UNKNOWN')
}

export interface MissionHealthRow {
  missionId: string
  health: MissionHealth
}

export type HealthStateCounts = Record<MissionHealthState, number>

/**
 * Evaluate every non-deleted mission once with shared context (so orphan
 * detection sees the full id set). Guarantees 100% coverage (criteria #2).
 */
export function evaluatePlanHealth(
  missions: readonly Mission[],
  now: Date = new Date(),
): { rows: MissionHealthRow[]; counts: HealthStateCounts } {
  const knownIds = new Set(missions.filter((m) => !m.isDeleted).map((m) => m.id))
  const counts: HealthStateCounts = { green: 0, amber: 0, red: 0, neutral: 0 }
  const rows: MissionHealthRow[] = []
  for (const m of missions) {
    if (m.isDeleted) continue
    const health = evaluateMissionHealth(m, { now, knownIds })
    counts[health.state] += 1
    rows.push({ missionId: m.id, health })
  }
  return { rows, counts }
}
