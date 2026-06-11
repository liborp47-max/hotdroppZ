/**
 * Mission completion truth gate — retroactive refresh.
 *
 * CEO-MISSIONS-REFRESH-TRUTH-GATE. The forward gate (evidence-contract.ts)
 * checks evidence at promotion time. This module RE-DERIVES evidence from each
 * existing mission record in plan.json and corrects false `MISSION_DONE` states
 * so "Splněné" only contains genuinely-finished work and "Spec Ops" gets the
 * zombies back.
 *
 * Design rules (mission hard stops):
 *   - Never deletes a mission, never touches report .md files — only flips
 *     `lifecycleStatus` and appends an auditLog entry.
 *   - Never auto-promotes to MISSION_DONE (no DONE without evidence). The gate
 *     only CONFIRMS an existing MISSION_DONE or DOWNGRADES it.
 *   - Acts ONLY on missions currently MISSION_DONE (bounds blast radius).
 *   - Skips deleted/archived missions — never resurrects them into Spec Ops.
 *   - confidence < THRESHOLD => not MISSION_DONE.
 *
 * Pure + type-only imports => unit-testable, no Next/fs deps.
 */
import type { Mission, MissionAuditReport, MissionLifecycleStatus, Plan } from './types'

export const TRUTH_CONFIDENCE_THRESHOLD = 0.8

// Evidence weights (sum = 1.0). Tunable in one place.
const W_SUBS = 0.4
const W_AUDITOR = 0.3
const W_REPORT = 0.2
const W_COMPLETED = 0.1

export interface MissionTruthEvidence {
  subTotal: number
  subDone: number
  subsAllDone: boolean
  hasOpenSubs: boolean
  auditorVerdict: 'PASS' | 'FAIL' | 'SIMULATED_ONLY' | null
  hasReport: boolean
  hasCompletedSignal: boolean
  archivedOrMerged: boolean
}

export interface MissionTruthResult {
  missionId: string
  previousStatus: MissionLifecycleStatus
  correctedStatus: MissionLifecycleStatus
  confidence: number
  changed: boolean
  reasons: string[]
  evidence: MissionTruthEvidence
}

function latestAuditorVerdict(mission: Mission): MissionTruthEvidence['auditorVerdict'] {
  const reports: MissionAuditReport[] = mission.auditReports?.length
    ? mission.auditReports
    : mission.auditReport
      ? [mission.auditReport]
      : []
  if (reports.length === 0) return null
  // Latest by timestamp wins.
  const latest = [...reports].sort((a, b) => Date.parse(a.timestamp ?? '') - Date.parse(b.timestamp ?? ''))
    .at(-1)
  return latest?.verdict ?? null
}

const ARCHIVE_WORDS = /\b(archive|archived|archiv|superseded|supersed|merge recommendation|merged into|duplicate)\b/i

function deriveEvidence(mission: Mission): MissionTruthEvidence {
  const subs = mission.subMissions ?? []
  const subDone = subs.filter((s) => s.status === 'done').length
  const subsAllDone = subs.length === 0 || subDone === subs.length
  const auditorVerdict = latestAuditorVerdict(mission)
  const hasReport = Boolean(mission.reportPath) || (mission.auditReports?.length ?? 0) > 0
  const hasCompletedSignal =
    Boolean((mission as Mission & { completedAt?: string }).completedAt) ||
    (mission.auditLog ?? []).some((e) => e.event === 'MISSION_DONE')
  const archivedOrMerged =
    Boolean(mission.coldCase) ||
    (mission.auditLog ?? []).some((e) => typeof e.note === 'string' && ARCHIVE_WORDS.test(e.note))

  return {
    subTotal: subs.length,
    subDone,
    subsAllDone,
    hasOpenSubs: subs.length > 0 && subDone < subs.length,
    auditorVerdict,
    hasReport,
    hasCompletedSignal,
    archivedOrMerged,
  }
}

function confidenceOf(e: MissionTruthEvidence): number {
  const subsScore = e.subTotal === 0 ? W_SUBS : W_SUBS * (e.subDone / e.subTotal)
  const auditorScore = e.auditorVerdict === 'PASS' ? W_AUDITOR : 0
  const reportScore = e.hasReport ? W_REPORT : 0
  const completedScore = e.hasCompletedSignal ? W_COMPLETED : 0
  return Number((subsScore + auditorScore + reportScore + completedScore).toFixed(2))
}

/**
 * Re-derive the lifecycle status a MISSION_DONE mission actually deserves.
 * Returns `changed: false` (no-op) for missions that are not MISSION_DONE or
 * are deleted — the gate is intentionally narrow.
 */
export function evaluateMissionTruth(mission: Mission): MissionTruthResult {
  const previousStatus = (mission.lifecycleStatus ?? 'PLAN') as MissionLifecycleStatus
  const evidence = deriveEvidence(mission)
  const base: Omit<MissionTruthResult, 'correctedStatus' | 'changed' | 'reasons'> = {
    missionId: mission.id,
    previousStatus,
    confidence: confidenceOf(evidence),
    evidence,
  }

  // Out of scope: only audit live MISSION_DONE claims. Never touch deleted ones.
  if (mission.isDeleted || previousStatus !== 'MISSION_DONE') {
    return { ...base, correctedStatus: previousStatus, changed: false, reasons: ['not in scope (not a live MISSION_DONE)'] }
  }

  const reasons: string[] = []
  let corrected: MissionLifecycleStatus = 'MISSION_DONE'

  if (evidence.auditorVerdict === 'FAIL') {
    corrected = 'AUDIT_PENDING'
    reasons.push('auditor verdict FAIL — remediation required')
  } else if (evidence.auditorVerdict === 'SIMULATED_ONLY') {
    // Preserve an explicit auditor SIMULATED_ONLY verdict (do not launder to DONE).
    corrected = 'SIMULATED_ONLY'
    reasons.push('auditor verdict SIMULATED_ONLY — artefacts only, no real evidence')
  } else if (evidence.hasOpenSubs) {
    // Hard rule: any open sub-mission means NOT done, regardless of other evidence.
    corrected = 'AUDIT_PENDING'
    reasons.push(`${evidence.subTotal - evidence.subDone}/${evidence.subTotal} sub-missions still open — cannot be done`)
  } else if (base.confidence >= TRUTH_CONFIDENCE_THRESHOLD) {
    corrected = 'MISSION_DONE'
    reasons.push(`confidence ${base.confidence} >= ${TRUTH_CONFIDENCE_THRESHOLD} — confirmed done`)
  } else {
    // Not proven done -> back to review (Spec Ops). Covers partial sub-missions
    // AND claimed-done-without-evidence (no auditor PASS / no report).
    corrected = 'AUDIT_PENDING'
    if (evidence.hasOpenSubs) {
      reasons.push(`${evidence.subTotal - evidence.subDone}/${evidence.subTotal} sub-missions still open (partial)`)
    }
    if (evidence.auditorVerdict !== 'PASS') reasons.push('no system-auditor PASS on record')
    if (!evidence.hasReport) reasons.push('no reportPath/auditReports on record')
    reasons.push(`confidence ${base.confidence} < ${TRUTH_CONFIDENCE_THRESHOLD}`)
  }

  return { ...base, correctedStatus: corrected, changed: corrected !== previousStatus, reasons }
}

export interface RefreshTruthSummary {
  scanned: number
  confirmedDone: number
  toAuditPending: number
  toSimulatedOnly: number
  unchanged: number
  changes: MissionTruthResult[]
}

/**
 * Apply the truth gate across a plan. Returns a NEW plan (pure) plus a summary.
 * Mutates only `lifecycleStatus`/`status` and appends one auditLog entry per
 * corrected mission. Skips deleted missions entirely.
 */
export function refreshPlanTruth(plan: Plan, nowIso: string = new Date().toISOString()): {
  plan: Plan
  summary: RefreshTruthSummary
} {
  const changes: MissionTruthResult[] = []
  let confirmedDone = 0
  let toAuditPending = 0
  let toSimulatedOnly = 0
  let scanned = 0

  const missions = plan.missions.map((m) => {
    if (m.isDeleted || m.lifecycleStatus !== 'MISSION_DONE') return m
    scanned++
    const result = evaluateMissionTruth(m)
    changes.push(result)

    if (!result.changed) {
      confirmedDone++
      return m
    }
    if (result.correctedStatus === 'AUDIT_PENDING') toAuditPending++
    if (result.correctedStatus === 'SIMULATED_ONLY') toSimulatedOnly++

    const statusForLifecycle = result.correctedStatus === 'MISSION_DONE' ? 'solved' : 'in_progress'
    return {
      ...m,
      lifecycleStatus: result.correctedStatus,
      status: statusForLifecycle as Mission['status'],
      auditLog: [
        ...(m.auditLog ?? []),
        {
          ts: nowIso,
          event: (result.correctedStatus === 'SIMULATED_ONLY' ? 'MISSION_SIMULATED_ONLY' : 'AUDIT_PENDING') as
            | 'MISSION_SIMULATED_ONLY'
            | 'AUDIT_PENDING',
          actor: 'AUDITOR' as const,
          note: `Truth-gate refresh: ${previousToCorrected(result)} (confidence ${result.confidence}). ${result.reasons.join('; ')}`,
        },
      ],
    }
  })

  return {
    plan: { ...plan, missions, updatedAt: nowIso },
    summary: {
      scanned,
      confirmedDone,
      toAuditPending,
      toSimulatedOnly,
      unchanged: confirmedDone,
      changes: changes.filter((c) => c.changed),
    },
  }
}

function previousToCorrected(r: MissionTruthResult): string {
  return `${r.previousStatus} -> ${r.correctedStatus}`
}
