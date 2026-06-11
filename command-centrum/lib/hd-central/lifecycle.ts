import type {
  Mission,
  MissionAuditLogEvent,
  MissionAuditReport,
  MissionLifecycleStatus,
  Plan,
  Priority,
  SubMission,
} from '@/lib/hd-central/types'

const PRIORITY_URGENCY: Record<Priority, number> = {
  P0: 100,
  P1: 75,
  P2: 50,
  P3: 25,
}

const LIFECYCLE_TO_STATUS: Record<MissionLifecycleStatus, Mission['status']> = {
  PLAN: 'todo',
  ACTIVE: 'in_progress',
  CEO_RESOLVED: 'in_progress',
  AUDIT_PENDING: 'in_progress',
  MISSION_DONE: 'solved',
  // UM-MISSION_TRUTH_GATE / #01 — Terminal but explicitly NOT "solved".
  // Renderers must visually distinguish; promotion to MISSION_DONE requires
  // an explicit evidence pack (see lib/hd-central/evidence-contract.ts).
  SIMULATED_ONLY: 'in_progress',
  ARCHIVED: 'blocked',
  DELETED: 'blocked',
}

function asIso(ts?: string): string {
  return ts && !Number.isNaN(Date.parse(ts)) ? ts : new Date().toISOString()
}

function optionalIso(ts?: string): string | undefined {
  if (!ts) return undefined
  return !Number.isNaN(Date.parse(ts)) ? ts : new Date().toISOString()
}

function normalizeMissionOptions(mission: Mission): Mission['options'] {
  if (!Array.isArray(mission.options)) return mission.options

  return mission.options
    .map((raw) => {
      const legacy = raw as unknown as {
        id?: NonNullable<Mission['options']>[number]['id']
        label?: string
        description?: string
        pros?: string
        cons?: string
        title?: string
        effort?: string
        risk?: string
      }

      const id = legacy.id
      if (id !== 'A' && id !== 'B' && id !== 'C') return null

      const label = legacy.label?.trim() || legacy.title?.trim() || `Option ${id}`
      const details: string[] = []
      if (legacy.description?.trim()) details.push(legacy.description.trim())
      if (legacy.effort?.trim()) details.push(`Effort: ${legacy.effort.trim()}`)
      if (legacy.risk?.trim()) details.push(`Risk: ${legacy.risk.trim()}`)

      return {
        id,
        label,
        description: details.join(' | ') || 'Doplnt kontext: scope, dopad, rizika a test plan.',
        pros: legacy.pros?.trim() || undefined,
        cons: legacy.cons?.trim() || undefined,
      }
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
}

export function missionLifecycleStatus(mission: Mission): MissionLifecycleStatus {
  if (mission.lifecycleStatus) return mission.lifecycleStatus
  if (mission.status === 'MISSION_DONE' || mission.status === 'solved' || mission.status === 'done') {
    return 'MISSION_DONE'
  }
  if (
    mission.status === 'ACTIVE' ||
    mission.status === 'in_progress' ||
    mission.status === 'CEO_RESOLVED' ||
    mission.status === 'AUDIT_PENDING'
  ) {
    return mission.status === 'CEO_RESOLVED' || mission.status === 'AUDIT_PENDING'
      ? mission.status
      : 'ACTIVE'
  }
  return 'PLAN'
}

export function missionUrgencyScore(mission: Mission): number {
  if (typeof mission.urgencyScore === 'number') return mission.urgencyScore
  if (mission.priority) return PRIORITY_URGENCY[mission.priority]
  return 0
}

export function normalizeMission(mission: Mission): Mission {
  const lifecycleStatus = missionLifecycleStatus(mission)
  return {
    ...mission,
    createdAt: asIso(mission.createdAt),
    urgencyScore: missionUrgencyScore(mission),
    lifecycleStatus,
    status: LIFECYCLE_TO_STATUS[lifecycleStatus],
    coldCase: Boolean(mission.coldCase),
    isDeleted: Boolean(mission.isDeleted),
    deletedAt: optionalIso(mission.deletedAt),
    options: normalizeMissionOptions(mission),
    auditReports: mission.auditReports ?? [],
    auditLog: mission.auditLog ?? [],
  }
}

export function sortByUrgency(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    const urgencyDiff = missionUrgencyScore(b) - missionUrgencyScore(a)
    if (urgencyDiff !== 0) return urgencyDiff

    const dateDiff = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '')
    if (dateDiff !== 0) return dateDiff

    return a.id.localeCompare(b.id)
  })
}

function appendLog(mission: Mission, event: MissionAuditLogEvent['event'], actor: MissionAuditLogEvent['actor'], note?: string): Mission {
  const logEvent: MissionAuditLogEvent = {
    ts: new Date().toISOString(),
    event,
    actor,
    ...(note ? { note } : {}),
  }

  return {
    ...mission,
    auditLog: [...(mission.auditLog ?? []), logEvent],
  }
}

export function transitionMission(
  mission: Mission,
  status: MissionLifecycleStatus,
  event: MissionAuditLogEvent['event'],
  actor: MissionAuditLogEvent['actor'],
  note?: string,
): Mission {
  const normalized = normalizeMission(mission)
  const transitioned = {
    ...normalized,
    lifecycleStatus: status,
    status: LIFECYCLE_TO_STATUS[status],
  }

  return appendLog(transitioned, event, actor, note)
}

export function promoteNextActiveMission(missions: Mission[]): Mission[] {
  const normalized = missions.map(normalizeMission)
  // Only timeline-eligible missions count for auto-promotion. Missions in the CEO Missions
  // inbox (inTimeline === false) stay in staging until pushed to the timeline.
  const timelineEligible = normalized.filter((m) => m.inTimeline !== false)
  const hasActive = timelineEligible.some((m) => !m.isDeleted && m.lifecycleStatus === 'ACTIVE')
  if (hasActive) return normalized

  const eligible = timelineEligible.filter(
    (m) => !m.isDeleted && m.lifecycleStatus === 'PLAN' && !m.coldCase,
  )
  // Sequencer wins over raw urgency: lower sequenceIndex first; fall back to urgency.
  const next = [...eligible].sort((a, b) => {
    const aIdx = typeof a.sequenceIndex === 'number' ? a.sequenceIndex : Number.POSITIVE_INFINITY
    const bIdx = typeof b.sequenceIndex === 'number' ? b.sequenceIndex : Number.POSITIVE_INFINITY
    if (aIdx !== bIdx) return aIdx - bIdx
    return missionUrgencyScore(b) - missionUrgencyScore(a)
  })[0]

  if (!next) return normalized

  return normalized.map((mission) => {
    if (mission.id !== next.id) return mission
    return transitionMission(mission, 'ACTIVE', 'MISSION_ACTIVATED', 'SYSTEM', 'Auto-pull from PLAN')
  })
}

export function normalizePlan(plan: Plan): Plan {
  const normalized = plan.missions.map(normalizeMission)
  return {
    ...plan,
    missions: promoteNextActiveMission(normalized),
  }
}

export function moveMissionToColdCase(plan: Plan, missionId: string): Plan {
  const nextMissions = plan.missions.map((mission) => {
    if (mission.id !== missionId) return normalizeMission(mission)
    if (mission.isDeleted) return normalizeMission(mission)

    const coldCaseMission = transitionMission(
      mission,
      'PLAN',
      'RETURNED_TO_COLD_CASE',
      'CEO',
      'Returned from timeline detail',
    )

    return {
      ...coldCaseMission,
      coldCase: true,
    }
  })

  return {
    ...plan,
    missions: promoteNextActiveMission(nextMissions),
  }
}

export function deleteMission(plan: Plan, missionId: string): Plan {
  const normalizedPlan = normalizePlan(plan)
  const nextMissions = normalizedPlan.missions.map((mission) => {
    if (mission.id !== missionId) return mission

    const deletedMission = appendLog(
      {
        ...normalizeMission(mission),
        lifecycleStatus: 'PLAN',
        status: LIFECYCLE_TO_STATUS.PLAN,
        coldCase: false,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      },
      'MISSION_DELETED',
      'CEO',
      'Mission deleted from timeline',
    )

    return deletedMission
  })

  return {
    ...normalizedPlan,
    missions: promoteNextActiveMission(nextMissions),
  }
}

// ─── DONE-button verification + follow-up spawning ──────────────────────────
// UM-MISSIONS_UI / Spec Ops DONE flow:
//  - All sub-missions done  → mission transitions to MISSION_DONE (moves to DONE tab).
//  - Some incomplete        → spawn a "+1" follow-up mission containing only the
//                             unfinished sub-missions, parent is closed as MISSION_DONE
//                             (its remaining work has been forwarded), and follow-up
//                             shows in spec ops with amber styling.

export type VerifyDoneOutcome =
  | { kind: 'completed'; mission: Mission }
  | { kind: 'follow_up_created'; mission: Mission; followUp: Mission; incompleteIds: string[] }
  | {
      kind: 'noop'
      reason:
        | 'not_found'
        | 'no_sub_missions'
        | 'already_done'
        // Anti-recursion guards (UM-WRITER+1+1 incident, run-20260603):
        | 'unexecuted_follow_up'
        | 'followup_depth_capped'
    }

export type VerifyDoneResult = { plan: Plan; outcome: VerifyDoneOutcome }

// A parent may spawn at most ONE +1 follow-up. A follow-up must then be executed
// by a human — never auto-forwarded into an endless chain (UM-WRITER -> +1 ->
// +1+1 -> ...). Beyond this depth the mission is parked AUDIT_PENDING for review.
const MAX_FOLLOWUP_LEVEL = 1

function nextFollowUpId(plan: Plan, parentId: string): string {
  const base = `${parentId}+1`
  const existing = new Set(plan.missions.map((m) => m.id))
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${parentId}+${n}`)) n++
  return `${parentId}+${n}`
}

function buildFollowUpMission(parent: Mission, incomplete: SubMission[], plan: Plan): Mission {
  const id = nextFollowUpId(plan, parent.id)
  const level = (parent.followUpLevel ?? 0) + 1
  const reason =
    `Parent ${parent.id} mělo ${incomplete.length} nedokončených kroků při DONE verifikaci. ` +
    `Tato +${level} mise je seskupuje pro dotažení.`
  const now = new Date().toISOString()
  return {
    ...parent,
    id,
    name: `+${level} ${parent.name}`,
    purpose: parent.purpose,
    description: `Follow-up po DONE verifikaci ${parent.id}. ${reason}`,
    rationale: reason,
    status: 'todo',
    lifecycleStatus: 'PLAN',
    createdAt: now,
    subMissions: incomplete.map((s) => ({
      ...s,
      status: 'todo',
      completedAt: undefined,
    })),
    auditReport: undefined,
    auditReports: [],
    auditLog: [
      {
        ts: now,
        event: 'MISSION_ACTIVATED',
        actor: 'SYSTEM',
        note: `Spawned as follow-up of ${parent.id} — ${incomplete.length} unfinished steps`,
      },
    ],
    timelineLog: undefined,
    isDeleted: false,
    deletedAt: undefined,
    isFollowUp: true,
    followUpOf: parent.id,
    followUpReason: reason,
    followUpLevel: level,
    // Inherit user-mission flag so it stays in SPEC OPS.
    userMission: parent.userMission,
    inTimeline: false,
    sequenceIndex: undefined,
    sequencedAt: undefined,
    sequencedBy: undefined,
    coldCase: false,
  }
}

/**
 * UM-MISSION_TRUTH_GATE: a mission can only be promoted to a real MISSION_DONE
 * when it carries an auditor-verified evidence pack (latest auditReport verdict
 * === 'PASS'). A mission solved by the *simulator* carries a SIMULATED_ONLY
 * audit report — flipping its sub-statuses to "done" must NOT let the DONE button
 * launder it into a verified green. Legacy missions with no auditReport at all
 * keep the old manual-close behaviour (DONE = MISSION_DONE) so hand-tracked
 * missions and existing test fixtures are unaffected.
 */
function verifyDoneTerminal(mission: Mission): {
  status: 'MISSION_DONE' | 'SIMULATED_ONLY'
  event: MissionAuditLogEvent['event']
  noteSuffix: string
} {
  const latest = mission.auditReport ?? mission.auditReports?.[mission.auditReports.length - 1]
  if (latest && latest.verdict !== 'PASS') {
    return {
      status: 'SIMULATED_ONLY',
      event: 'MISSION_SIMULATED_ONLY',
      noteSuffix: ` — blocked from MISSION_DONE: last audit verdict ${latest.verdict}, no verified evidence pack`,
    }
  }
  return { status: 'MISSION_DONE', event: 'MISSION_DONE', noteSuffix: '' }
}

export function verifyAndCompleteMission(plan: Plan, missionId: string): VerifyDoneResult {
  const normalized = normalizePlan(plan)
  const target = normalized.missions.find((m) => m.id === missionId && !m.isDeleted)
  if (!target) return { plan: normalized, outcome: { kind: 'noop', reason: 'not_found' } }
  if (target.lifecycleStatus === 'MISSION_DONE') {
    return { plan: normalized, outcome: { kind: 'noop', reason: 'already_done' } }
  }

  const subs = target.subMissions ?? []
  const incomplete = subs.filter((s) => (s.status ?? 'todo') !== 'done')

  // No sub-missions → treat as atomic mission; close (gated by evidence).
  if (subs.length === 0) {
    const term = verifyDoneTerminal(target)
    const done = transitionMission(
      target,
      term.status,
      term.event,
      'SYSTEM',
      `DONE verified — atomic mission, no sub-missions${term.noteSuffix}`,
    )
    const nextMissions = normalized.missions.map((m) => (m.id === missionId ? done : m))
    return {
      plan: { ...normalized, missions: nextMissions, updatedAt: new Date().toISOString() },
      outcome: { kind: 'completed', mission: done },
    }
  }

  // All sub-missions done → close (gated by evidence).
  if (incomplete.length === 0) {
    const term = verifyDoneTerminal(target)
    const done = transitionMission(
      target,
      term.status,
      term.event,
      'SYSTEM',
      `DONE verified — all ${subs.length} steps done${term.noteSuffix}`,
    )
    const nextMissions = normalized.missions.map((m) => (m.id === missionId ? done : m))
    return {
      plan: { ...normalized, missions: nextMissions, updatedAt: new Date().toISOString() },
      outcome: { kind: 'completed', mission: done },
    }
  }

  // ── Anti-recursion guards (UM-WRITER+1+1 incident) ────────────────────────
  const executedSteps = subs.length - incomplete.length

  // Guard 1: an un-worked follow-up is NOT "done". Marking it MISSION_DONE and
  // spawning the next +N just launders zero work into a green status and grows
  // an endless chain. Park it AUDIT_PENDING — it needs real execution.
  if (target.isFollowUp && executedSteps === 0) {
    const stalled = transitionMission(
      target,
      'AUDIT_PENDING',
      'AUDIT_PENDING',
      'SYSTEM',
      `Follow-up ${target.id}: 0/${subs.length} kroků provedeno — neforwardováno na další +N, vyžaduje reálné provedení.`,
    )
    const nextMissions = normalized.missions.map((m) => (m.id === missionId ? stalled : m))
    return {
      plan: { ...normalized, missions: nextMissions, updatedAt: new Date().toISOString() },
      outcome: { kind: 'noop', reason: 'unexecuted_follow_up' },
    }
  }

  // Guard 2: cap follow-up depth. Beyond the cap, park the mission AUDIT_PENDING
  // for human review instead of minting another +N.
  const nextLevel = (target.followUpLevel ?? 0) + 1
  if (nextLevel > MAX_FOLLOWUP_LEVEL) {
    const capped = transitionMission(
      target,
      'AUDIT_PENDING',
      'AUDIT_PENDING',
      'SYSTEM',
      `Follow-up depth cap (${MAX_FOLLOWUP_LEVEL}) dosažen — ${incomplete.length} kroků jde na human review, ne na +${nextLevel}.`,
    )
    const nextMissions = normalized.missions.map((m) => (m.id === missionId ? capped : m))
    return {
      plan: { ...normalized, missions: nextMissions, updatedAt: new Date().toISOString() },
      outcome: { kind: 'noop', reason: 'followup_depth_capped' },
    }
  }

  // Genuinely-worked mission with leftover steps → spawn exactly one +1 follow-up,
  // close parent (its open work has been forwarded to the follow-up).
  const followUp = buildFollowUpMission(target, incomplete, normalized)

  // AUD-TRUTH-001: the forwarded steps become the follow-up's responsibility, so
  // mark them done ON THE PARENT. Without this, refresh-truth.ts sees open subs
  // and reverts the parent to AUDIT_PENDING (lifecycle/refresh-truth contradiction).
  const forwardedAt = new Date().toISOString()
  const forwarded: Mission = {
    ...target,
    subMissions: (target.subMissions ?? []).map((s) =>
      (s.status ?? 'todo') !== 'done'
        ? { ...s, status: 'done' as const, completedAt: forwardedAt }
        : s,
    ),
  }

  // AUD-TRUTH-001: gate the parent-close through the evidence gate, exactly like
  // the atomic/all-done branches. Previously this branch force-set MISSION_DONE
  // with no evidence check — laundering a SIMULATED_ONLY mission to verified-green
  // via the follow-up path. A non-PASS audit report now parks it SIMULATED_ONLY.
  const term = verifyDoneTerminal(forwarded)
  const parentClosed = transitionMission(
    forwarded,
    term.status,
    term.event,
    'SYSTEM',
    `${term.status === 'MISSION_DONE' ? 'DONE verified' : 'Parked'} — ${incomplete.length}/${subs.length} steps forwarded to ${followUp.id}${term.noteSuffix}`,
  )

  const nextMissions = normalized.missions
    .map((m) => (m.id === missionId ? parentClosed : m))
    .concat(normalizeMission(followUp))

  return {
    plan: { ...normalized, missions: nextMissions, updatedAt: new Date().toISOString() },
    outcome: {
      kind: 'follow_up_created',
      mission: parentClosed,
      followUp,
      incompleteIds: incomplete.map((s) => s.id),
    },
  }
}

type CompleteMissionOptions = {
  stepIndex?: number
  totalSteps?: number
  solveAll?: boolean
  reportShown?: boolean
}

export function completeMissionWithAudit(
  plan: Plan,
  missionId: string,
  runId: string,
  summary: string,
  verdict: MissionAuditReport['verdict'],
  options: CompleteMissionOptions = {},
): { plan: Plan; mission: Mission; auditReport: MissionAuditReport } | null {
  const normalizedPlan = normalizePlan(plan)
  const found = normalizedPlan.missions.find((mission) => mission.id === missionId && !mission.isDeleted)
  if (!found) return null

  const totalSteps = options.totalSteps ?? 1
  const stepIndex = options.stepIndex ?? 1

  const solveCandidate = options.solveAll && stepIndex === 1
    ? appendLog(found, 'SOLVE_ALL_STARTED', 'CEO', `Solve All started for ${totalSteps} missions`)
    : found

  const ceoResolved = transitionMission(solveCandidate, 'CEO_RESOLVED', 'CEO_RESOLVED', 'CEO', 'CEO marked mission as resolved')
  const auditPending = transitionMission(ceoResolved, 'AUDIT_PENDING', 'AUDIT_PENDING', 'AUDITOR', 'AUDITOR_TEST started')

  const auditReport: MissionAuditReport = {
    missionId,
    runId,
    stepIndex,
    totalSteps,
    summary,
    verdict,
    timestamp: new Date().toISOString(),
  }

  const tested = transitionMission(
    {
      ...auditPending,
      auditReport,
      auditReports: [...(auditPending.auditReports ?? []), auditReport],
      coldCase: false,
    },
    'AUDIT_PENDING',
    'AUDITOR_TEST',
    'AUDITOR',
    verdict === 'PASS' ? 'All tests passed' : 'Audit test failed',
  )

  // UM-MISSION_TRUTH_GATE: three terminal outcomes, not two.
  //  PASS           → MISSION_DONE  (real evidence pack verified)
  //  SIMULATED_ONLY → SIMULATED_ONLY (sub-missions ran but no real build/test
  //                   evidence — terminal-but-NOT-solved, amber in timeline)
  //  FAIL           → AUDIT_PENDING (auditor rejected; stays open for remediation)
  const terminalStatus: MissionLifecycleStatus =
    verdict === 'PASS' ? 'MISSION_DONE' : verdict === 'SIMULATED_ONLY' ? 'SIMULATED_ONLY' : 'AUDIT_PENDING'
  const terminalEvent: MissionAuditLogEvent['event'] =
    verdict === 'PASS' ? 'MISSION_DONE' : verdict === 'SIMULATED_ONLY' ? 'MISSION_SIMULATED_ONLY' : 'AUDITOR_TEST'
  const terminalNote =
    verdict === 'PASS'
      ? 'Moved to INTEL/MISSION_DONE'
      : verdict === 'SIMULATED_ONLY'
      ? 'Sub-missions ran but evidence pack incomplete — parked SIMULATED_ONLY, not promoted to MISSION_DONE'
      : 'Audit failed; mission remains AUDIT_PENDING for remediation'

  let done = transitionMission(tested, terminalStatus, terminalEvent, 'AUDITOR', terminalNote)
  done = appendLog(done, 'MISSION_SOLVE_STEP_DONE', 'CEO', `Step ${stepIndex} of ${totalSteps} completed`)

  if (options.reportShown ?? true) {
    done = appendLog(done, 'REPORT_SHOWN', 'SYSTEM', `Report shown for step ${stepIndex}`)
  }

  if (options.solveAll && stepIndex === totalSteps) {
    done = appendLog(done, 'SOLVE_ALL_FINISHED', 'CEO', `Solve All finished after ${totalSteps} missions`)
  }

  const nextMissions = normalizedPlan.missions.map((mission) =>
    mission.id === missionId ? done : mission,
  )

  return {
    mission: done,
    auditReport,
    plan: {
      ...normalizedPlan,
      // PASS and SIMULATED_ONLY are both terminal — the mission leaves the ACTIVE
      // slot, so pull the next PLAN mission forward. FAIL stays AUDIT_PENDING (open).
      missions:
        verdict === 'FAIL'
          ? nextMissions.map(normalizeMission)
          : promoteNextActiveMission(nextMissions),
    },
  }
}
