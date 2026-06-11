import { test } from 'node:test'
import assert from 'node:assert/strict'

import { evaluateMissionTruth, refreshPlanTruth, TRUTH_CONFIDENCE_THRESHOLD } from '../lib/hd-central/refresh-truth.ts'

const mk = (over: Record<string, unknown> = {}) =>
  ({
    id: 'UM-X',
    name: 'X',
    purpose: 'p',
    status: 'solved',
    lifecycleStatus: 'MISSION_DONE',
    subMissions: [],
    auditLog: [{ ts: '2026-06-01T00:00:00Z', event: 'MISSION_DONE', actor: 'SYSTEM' }],
    ...over,
  } as never)
const plan = (missions: unknown[]) => ({ version: 1, updatedAt: '', missions } as never)
const evalOf = (m: unknown) => evaluateMissionTruth(m as never)

// ─── QA case 1: fake MISSION_DONE without report -> AUDIT_PENDING ─────────────

test('fake MISSION_DONE without report/auditor -> AUDIT_PENDING', () => {
  const m = mk({ subMissions: [{ id: 's1', status: 'done' }] }) // no report, no auditor
  const r = evalOf(m)
  assert.equal(r.correctedStatus, 'AUDIT_PENDING')
  assert.ok(r.confidence < TRUTH_CONFIDENCE_THRESHOLD)
  assert.equal(r.changed, true)
})

// ─── QA case 2: open sub-mission is not Splněné ──────────────────────────────

test('MISSION_DONE with an open sub-mission -> AUDIT_PENDING (not done)', () => {
  const m = mk({
    reportPath: 'x.md',
    auditReports: [{ missionId: 'UM-X', runId: 'r', stepIndex: 1, summary: '', verdict: 'PASS', timestamp: '2026-06-01T00:00:00Z' }],
    subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'todo' }],
  })
  const r = evalOf(m)
  assert.notEqual(r.correctedStatus, 'MISSION_DONE')
  assert.equal(r.correctedStatus, 'AUDIT_PENDING')
})

// ─── QA case 3: archived/deleted mission is not touched / not in Spec Ops ─────

test('deleted (archived) mission is skipped, never resurrected', () => {
  const m = mk({ isDeleted: true, subMissions: [{ id: 's1', status: 'todo' }] })
  const r = evalOf(m)
  assert.equal(r.changed, false)
  assert.equal(r.correctedStatus, 'MISSION_DONE') // unchanged; stays out of scope
})

// ─── QA case 4: valid mission stays Splněné ──────────────────────────────────

test('fully-evidenced mission stays MISSION_DONE', () => {
  const m = mk({
    completedAt: '2026-06-01T00:00:00Z',
    reportPath: 'SYSTEM/INFO/MISSIONS/run-x.md',
    auditReports: [{ missionId: 'UM-X', runId: 'r', stepIndex: 1, summary: '', verdict: 'PASS', timestamp: '2026-06-01T00:00:00Z' }],
    subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'done' }],
  })
  const r = evalOf(m)
  assert.equal(r.correctedStatus, 'MISSION_DONE')
  assert.equal(r.confidence, 1)
  assert.equal(r.changed, false)
})

// ─── explicit auditor SIMULATED_ONLY verdict is preserved ────────────────────

test('explicit auditor SIMULATED_ONLY verdict -> SIMULATED_ONLY', () => {
  const m = mk({
    auditReports: [{ missionId: 'UM-X', runId: 'r', stepIndex: 1, summary: '', verdict: 'SIMULATED_ONLY', timestamp: '2026-06-01T00:00:00Z' }],
    subMissions: [{ id: 's1', status: 'done' }],
  })
  assert.equal(evalOf(m).correctedStatus, 'SIMULATED_ONLY')
})

// ─── only MISSION_DONE is in scope ───────────────────────────────────────────

test('non-MISSION_DONE missions are untouched', () => {
  const m = mk({ lifecycleStatus: 'AUDIT_PENDING' })
  assert.equal(evalOf(m).changed, false)
})

// ─── QA case 5: idempotent ───────────────────────────────────────────────────

test('refreshPlanTruth is idempotent', () => {
  const p = plan([
    mk({ id: 'A', subMissions: [{ id: 's1', status: 'todo' }] }), // -> AUDIT_PENDING
    mk({
      id: 'B',
      completedAt: '2026-06-01T00:00:00Z',
      reportPath: 'r.md',
      auditReports: [{ missionId: 'B', runId: 'r', stepIndex: 1, summary: '', verdict: 'PASS', timestamp: '2026-06-01T00:00:00Z' }],
      subMissions: [{ id: 's1', status: 'done' }],
    }), // stays DONE
  ])
  const first = refreshPlanTruth(p, '2026-06-03T00:00:00Z')
  assert.equal(first.summary.toAuditPending, 1)
  assert.equal(first.summary.confirmedDone, 1)

  const second = refreshPlanTruth(first.plan, '2026-06-03T00:01:00Z')
  assert.equal(second.summary.changes.length, 0) // no further changes
  assert.equal(second.summary.toAuditPending, 0)
})

test('refreshPlanTruth never deletes a mission', () => {
  const p = plan([mk({ id: 'A', subMissions: [{ id: 's1', status: 'todo' }] }), mk({ id: 'B' })])
  const out = refreshPlanTruth(p)
  assert.equal((out.plan as { missions: unknown[] }).missions.length, 2)
})
