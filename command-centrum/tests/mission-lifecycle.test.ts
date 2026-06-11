import test from 'node:test'
import assert from 'node:assert/strict'

import type { Mission, Plan } from '../lib/hd-central/types'
import {
  completeMissionWithAudit,
  deleteMission,
  moveMissionToColdCase,
  normalizeMission,
  normalizePlan,
  sortByUrgency,
  verifyAndCompleteMission,
} from '../lib/hd-central/lifecycle'

function mission(id: string, overrides: Partial<Mission> = {}): Mission {
  return {
    id,
    name: `Mission ${id}`,
    purpose: `Purpose ${id}`,
    status: 'todo',
    createdAt: '2026-05-14T00:00:00.000Z',
    ...overrides,
  }
}

function plan(missions: Mission[]): Plan {
  return {
    version: 1,
    updatedAt: '2026-05-14T00:00:00.000Z',
    missions,
  }
}

test('sortByUrgency sorts by urgency desc, createdAt asc, id asc', () => {
  const input = [
    mission('B', { urgencyScore: 80, createdAt: '2026-05-14T10:00:00.000Z' }),
    mission('A', { urgencyScore: 80, createdAt: '2026-05-14T10:00:00.000Z' }),
    mission('C', { urgencyScore: 95, createdAt: '2026-05-14T11:00:00.000Z' }),
    mission('D', { urgencyScore: 80, createdAt: '2026-05-14T09:00:00.000Z' }),
  ]

  const sorted = sortByUrgency(input).map((m) => m.id)
  assert.deepEqual(sorted, ['C', 'D', 'A', 'B'])
})

test('normalizePlan auto-promotes one active mission from PLAN', () => {
  const data = plan([
    mission('M1', { urgencyScore: 70, coldCase: true }),
    mission('M2', { urgencyScore: 90 }),
    mission('M3', { urgencyScore: 85 }),
  ])

  const normalized = normalizePlan(data)
  const active = normalized.missions.find((m) => m.lifecycleStatus === 'ACTIVE')

  assert.equal(active?.id, 'M2')
})

// AUD-TRUTH-001 — the forwarded-follow-up branch must NOT launder a non-PASS
// mission to MISSION_DONE, and a verified one must close cleanly (subs forwarded).
function partialMission(id: string, verdict: 'PASS' | 'SIMULATED_ONLY'): Mission {
  return mission(id, {
    lifecycleStatus: 'AUDIT_PENDING',
    subMissions: [
      { id: 's1', name: 'done step', description: '', status: 'done', owner: 'qa', estimatedDuration: 'S' },
      { id: 's2', name: 'open step', description: '', status: 'todo', owner: 'qa', estimatedDuration: 'S' },
    ],
    auditReport: { missionId: id, runId: 'r', stepIndex: 1, summary: '', verdict, timestamp: '2026-06-08T00:00:00.000Z' },
  })
}

test('AUD-TRUTH-001: forwarded follow-up with SIMULATED_ONLY audit does NOT reach MISSION_DONE', () => {
  const res = verifyAndCompleteMission(plan([partialMission('P', 'SIMULATED_ONLY')]), 'P')
  assert.equal(res.outcome.kind, 'follow_up_created')
  const parent = res.plan.missions.find((m) => m.id === 'P')
  assert.equal(parent?.lifecycleStatus, 'SIMULATED_ONLY', 'no evidence -> parked, not laundered to DONE')
  assert.notEqual(parent?.lifecycleStatus, 'MISSION_DONE')
})

test('AUD-TRUTH-001: forwarded follow-up with PASS audit reaches MISSION_DONE with subs forwarded (refresh-truth agrees)', () => {
  const res = verifyAndCompleteMission(plan([partialMission('P', 'PASS')]), 'P')
  assert.equal(res.outcome.kind, 'follow_up_created')
  const parent = res.plan.missions.find((m) => m.id === 'P')
  assert.equal(parent?.lifecycleStatus, 'MISSION_DONE')
  // All parent subs marked done so refresh-truth's "open subs -> AUDIT_PENDING" won't revert it.
  assert.ok((parent?.subMissions ?? []).every((s) => s.status === 'done'), 'forwarded subs marked done on parent')
  // The real open work lives on the spawned follow-up.
  assert.ok(res.plan.missions.some((m) => m.isFollowUp))
})

test('completeMissionWithAudit transitions CEO_RESOLVED -> AUDIT_PENDING -> MISSION_DONE and activates next', () => {
  const data = normalizePlan(
    plan([
      mission('M1', { urgencyScore: 99, lifecycleStatus: 'ACTIVE', status: 'in_progress' }),
      mission('M2', { urgencyScore: 60 }),
    ]),
  )

  const result = completeMissionWithAudit(
    data,
    'M1',
    'run-1',
    'Audit summary',
    'PASS',
  )

  assert.ok(result)
  assert.equal(result?.mission.lifecycleStatus, 'MISSION_DONE')
  assert.equal(result?.mission.auditReport?.verdict, 'PASS')
  assert.equal(result?.mission.auditReport?.stepIndex, 1)
  assert.equal(result?.mission.auditReports?.length, 1)
  assert.deepEqual(
    result?.mission.auditLog?.slice(-2).map((entry) => entry.event),
    ['MISSION_SOLVE_STEP_DONE', 'REPORT_SHOWN'],
  )

  const nextActive = result?.plan.missions.find((m) => m.lifecycleStatus === 'ACTIVE')
  assert.equal(nextActive?.id, 'M2')
})

test('completeMissionWithAudit supports solve-all sequencing metadata and ordering', () => {
  let current = normalizePlan(
    plan([
      mission('M1', { urgencyScore: 99, lifecycleStatus: 'ACTIVE', status: 'in_progress', createdAt: '2026-05-14T00:00:00.000Z' }),
      mission('M2', { urgencyScore: 75, createdAt: '2026-05-14T00:01:00.000Z' }),
      mission('M3', { urgencyScore: 75, createdAt: '2026-05-14T00:01:00.000Z' }),
    ]),
  )

  const orderedIds = sortByUrgency(current.missions.filter((m) => !m.isDeleted && m.lifecycleStatus !== 'MISSION_DONE')).map((m) => m.id)
  assert.deepEqual(orderedIds, ['M1', 'M2', 'M3'])

  for (const [index, missionId] of orderedIds.entries()) {
    const result = completeMissionWithAudit(
      current,
      missionId,
      `run-${index + 1}`,
      `Summary ${missionId}`,
      'PASS',
      {
        stepIndex: index + 1,
        totalSteps: orderedIds.length,
        solveAll: true,
      },
    )

    assert.ok(result)
    current = result!.plan
  }

  const doneMissions = current.missions.filter((mission) => mission.lifecycleStatus === 'MISSION_DONE')
  assert.equal(doneMissions.length, 3)
  assert.equal(current.missions.some((mission) => mission.lifecycleStatus === 'ACTIVE'), false)
  assert.equal(doneMissions[0]?.auditLog?.some((entry) => entry.event === 'SOLVE_ALL_STARTED'), true)
  assert.equal(doneMissions.at(-1)?.auditLog?.some((entry) => entry.event === 'SOLVE_ALL_FINISHED'), true)
})

test('moveMissionToColdCase sets coldCase and appends audit log event', () => {
  const data = normalizePlan(plan([mission('M1', { lifecycleStatus: 'ACTIVE', status: 'in_progress' }), mission('M2', { urgencyScore: 90 })]))

  const moved = moveMissionToColdCase(data, 'M1')
  const target = moved.missions.find((m) => m.id === 'M1')

  assert.equal(target?.coldCase, true)
  assert.equal(target?.lifecycleStatus, 'PLAN')
  assert.equal(target?.auditLog?.at(-1)?.event, 'RETURNED_TO_COLD_CASE')
})

test('deleteMission soft-deletes target, appends audit event and promotes next mission', () => {
  const data = normalizePlan(
    plan([
      mission('M1', { lifecycleStatus: 'ACTIVE', status: 'in_progress', urgencyScore: 99 }),
      mission('M2', { urgencyScore: 80 }),
    ]),
  )

  const next = deleteMission(data, 'M1')
  const deleted = next.missions.find((mission) => mission.id === 'M1')
  const promoted = next.missions.find((mission) => mission.id === 'M2')

  assert.equal(deleted?.isDeleted, true)
  assert.ok(deleted?.deletedAt)
  assert.equal(deleted?.auditLog?.at(-1)?.event, 'MISSION_DELETED')
  assert.equal(promoted?.lifecycleStatus, 'ACTIVE')
})

test('normalizeMission maps legacy ABC options to label+description with details', () => {
  const normalized = normalizeMission(
    mission('M-OPTIONS', {
      options: [
        {
          id: 'A',
          title: 'Fast patch path',
          effort: 'SMALL',
          risk: 'MEDIUM',
        } as any,
      ],
    }),
  )

  assert.equal(normalized.options?.length, 1)
  assert.equal(normalized.options?.[0]?.id, 'A')
  assert.equal(normalized.options?.[0]?.label, 'Fast patch path')
  assert.equal(normalized.options?.[0]?.description, 'Effort: SMALL | Risk: MEDIUM')
})

test('completeMissionWithAudit keeps mission in AUDIT_PENDING on FAIL verdict', () => {
  const data = normalizePlan(
    plan([
      mission('M1', { urgencyScore: 99, lifecycleStatus: 'ACTIVE', status: 'in_progress' }),
      mission('M2', { urgencyScore: 60 }),
    ]),
  )

  const result = completeMissionWithAudit(data, 'M1', 'run-fail-1', 'Audit failed', 'FAIL')

  assert.ok(result)
  assert.equal(result?.mission.lifecycleStatus, 'AUDIT_PENDING')
  assert.equal(result?.mission.auditReport?.verdict, 'FAIL')
  assert.equal(result?.plan.missions.some((m) => m.id === 'M2' && m.lifecycleStatus === 'ACTIVE'), false)
})

// ─── UM-MISSION_TRUTH_GATE regression tests ─────────────────────────────────

test('completeMissionWithAudit with SIMULATED_ONLY verdict parks the mission, never MISSION_DONE', () => {
  const p = plan([mission('M1', { lifecycleStatus: 'ACTIVE', status: 'in_progress' })])
  const result = completeMissionWithAudit(p, 'M1', 'run-sim', 'No real evidence', 'SIMULATED_ONLY')
  assert.ok(result)
  assert.equal(result?.mission.lifecycleStatus, 'SIMULATED_ONLY')
  assert.notEqual(result?.mission.lifecycleStatus, 'MISSION_DONE')
  assert.equal(result?.mission.auditReport?.verdict, 'SIMULATED_ONLY')
  // Terminal verdict frees the ACTIVE slot — log records the simulated outcome.
  assert.ok(result?.mission.auditLog?.some((e) => e.event === 'MISSION_SIMULATED_ONLY'))
})

test('verify-done does NOT promote a simulated mission (SIMULATED_ONLY audit) to MISSION_DONE', () => {
  const simAudit = {
    missionId: 'M1',
    runId: 'run-sim',
    stepIndex: 1,
    totalSteps: 1,
    summary: 'sim',
    verdict: 'SIMULATED_ONLY' as const,
    timestamp: '2026-05-14T00:00:00.000Z',
  }
  const p = plan([
    mission('M1', {
      lifecycleStatus: 'SIMULATED_ONLY',
      status: 'in_progress',
      auditReport: simAudit,
      auditReports: [simAudit],
      subMissions: [{ id: 's1', name: 's1', description: 'd', status: 'done' }],
    }),
  ])
  const { outcome, plan: next } = verifyAndCompleteMission(p, 'M1')
  assert.equal(outcome.kind, 'completed')
  const m = next.missions.find((x) => x.id === 'M1')
  assert.equal(m?.lifecycleStatus, 'SIMULATED_ONLY')
  assert.notEqual(m?.lifecycleStatus, 'MISSION_DONE')
})

test('verify-done still completes a legacy mission with no audit report (all subs done)', () => {
  const p = plan([
    mission('M1', {
      lifecycleStatus: 'ACTIVE',
      status: 'in_progress',
      subMissions: [{ id: 's1', name: 's1', description: 'd', status: 'done' }],
    }),
  ])
  const { outcome, plan: next } = verifyAndCompleteMission(p, 'M1')
  assert.equal(outcome.kind, 'completed')
  const m = next.missions.find((x) => x.id === 'M1')
  assert.equal(m?.lifecycleStatus, 'MISSION_DONE')
})
