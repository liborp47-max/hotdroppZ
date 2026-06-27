import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateMissionHealth,
  evaluatePlanHealth,
  REASON_META,
  type MissionReasonCode,
} from '../lib/hd-central/mission-health.ts'

const mk = (over: Record<string, unknown> = {}) =>
  ({ id: 'M', name: 'n', purpose: 'p', status: 'todo', ...over } as never)

// Fixed clock so SLA windows are deterministic.
const NOW = new Date('2026-06-27T12:00:00.000Z')
const ctx = { now: NOW }
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

function code(over: Record<string, unknown>): MissionReasonCode {
  return evaluateMissionHealth(mk(over), ctx).reasonCode
}

test('terminal states win first: deleted/archived/done/simulated', () => {
  assert.equal(code({ isDeleted: true, lifecycleStatus: 'ACTIVE' }), 'DELETED')
  assert.equal(code({ lifecycleStatus: 'ARCHIVED' }), 'ARCHIVED')
  assert.equal(code({ lifecycleStatus: 'MISSION_DONE' }), 'DONE_VERIFIED')
  assert.equal(code({ lifecycleStatus: 'SIMULATED_ONLY' }), 'DONE_SIMULATED')
})

test('evidence rejection surfaces as red with the auditor note', () => {
  const m = mk({
    lifecycleStatus: 'AUDIT_PENDING',
    auditLog: [{ ts: NOW.toISOString(), event: 'EVIDENCE_REJECTED', actor: 'AUDITOR', note: 'no real test exit codes' }],
  })
  const h = evaluateMissionHealth(m, ctx)
  assert.equal(h.reasonCode, 'EVIDENCE_REJECTED')
  assert.equal(h.state, 'red')
  assert.match(h.reason, /no real test exit codes/)
})

test('orphan follow-up is blocked only when knownIds is provided', () => {
  const m = mk({ lifecycleStatus: 'ACTIVE', followUpOf: 'GHOST' })
  assert.equal(evaluateMissionHealth(m, { now: NOW }).reasonCode, 'ACTIVE_ON_TRACK') // no knownIds → skip
  assert.equal(
    evaluateMissionHealth(m, { now: NOW, knownIds: new Set(['M']) }).reasonCode,
    'BLOCKED_ORPHAN_FOLLOWUP',
  )
})

test('SLA breached (red) outranks cold case and at-risk', () => {
  assert.equal(code({ lifecycleStatus: 'ACTIVE', slaDeadline: hoursFromNow(-5), coldCase: true }), 'SLA_BREACHED')
})

test('cold case (amber) outranks at-risk SLA', () => {
  assert.equal(code({ lifecycleStatus: 'ACTIVE', coldCase: true, slaDeadline: hoursFromNow(5) }), 'BLOCKED_COLD_CASE')
})

test('SLA at-risk within the window', () => {
  assert.equal(code({ lifecycleStatus: 'ACTIVE', slaDeadline: hoursFromNow(5) }), 'SLA_AT_RISK')
})

test('done mission never breaches SLA', () => {
  assert.equal(code({ lifecycleStatus: 'MISSION_DONE', slaDeadline: hoursFromNow(-99) }), 'DONE_VERIFIED')
})

test('all sub-missions done → ready for sign-off (with detail)', () => {
  const h = evaluateMissionHealth(
    mk({ lifecycleStatus: 'ACTIVE', subMissions: [{ id: '1', name: 'a', description: '', status: 'done' }, { id: '2', name: 'b', description: '', status: 'done' }] }),
    ctx,
  )
  assert.equal(h.reasonCode, 'READY_FOR_SIGNOFF')
  assert.equal(h.detail, '2/2 submisí hotovo')
})

test('open subs on timeline = amber OPEN_SUBMISSIONS; in inbox = neutral IN_INBOX', () => {
  const subs = [{ id: '1', name: 'a', description: '', status: 'done' }, { id: '2', name: 'b', description: '', status: 'todo' }]
  assert.equal(code({ lifecycleStatus: 'ACTIVE', inTimeline: true, subMissions: subs }), 'OPEN_SUBMISSIONS')
  assert.equal(code({ lifecycleStatus: 'PLAN', inTimeline: false, subMissions: subs }), 'IN_INBOX')
})

test('placement fallbacks: inbox / active / plan', () => {
  assert.equal(code({ inTimeline: false }), 'IN_INBOX')
  assert.equal(code({ lifecycleStatus: 'ACTIVE' }), 'ACTIVE_ON_TRACK')
  assert.equal(code({ lifecycleStatus: 'PLAN' }), 'PLAN_READY')
  assert.equal(code({}), 'PLAN_READY') // undefined lifecycle defaults to plan
})

test('reason is never empty for any code and maps to a valid state', () => {
  for (const c of Object.keys(REASON_META) as MissionReasonCode[]) {
    assert.ok(REASON_META[c].label.length > 0, `${c} has a label`)
    assert.ok(['green', 'amber', 'red', 'neutral'].includes(REASON_META[c].state))
  }
})

test('evaluatePlanHealth: 100% coverage (every non-deleted mission gets a reason) + counts', () => {
  const missions = [
    mk({ id: 'A', lifecycleStatus: 'MISSION_DONE' }), // green
    mk({ id: 'B', lifecycleStatus: 'ACTIVE', slaDeadline: hoursFromNow(-1) }), // red
    mk({ id: 'C', lifecycleStatus: 'ACTIVE', coldCase: true }), // amber
    mk({ id: 'D', inTimeline: false }), // neutral
    mk({ id: 'E', isDeleted: true }), // excluded
  ]
  const { rows, counts } = evaluatePlanHealth(missions as never, NOW)
  assert.equal(rows.length, 4) // deleted excluded
  assert.ok(rows.every((r) => r.health.reason.length > 0)) // criteria #3 — never empty
  assert.equal(counts.green, 1)
  assert.equal(counts.red, 1)
  assert.equal(counts.amber, 1)
  assert.equal(counts.neutral, 1)
})
