import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

import type { Mission } from '../lib/hd-central/types'
import {
  canTransition,
  deriveTimelineState,
  transitionTimelineState,
  TIMELINE_STATES,
  TIMELINE_TRANSITIONS,
} from '../lib/hd-central/mission-state-machine'
import {
  slaStatus,
  computeSlaAlerts,
  SLA_AT_RISK_WINDOW_HOURS,
} from '../lib/hd-central/mission-sla'
import {
  appendTimelineAudit,
  readTimelineAudit,
} from '../lib/hd-central/mission-audit-trail'

function mkMission(id: string, overrides: Partial<Mission> = {}): Mission {
  return { id, name: `Mission ${id}`, purpose: `Purpose ${id}`, status: 'todo', ...overrides }
}

// ─── SM1 / Criterion 1: state machine draft → queued → running → done/failed ──

test('CRITERION 1 — state machine: happy path draft -> queued -> running -> done', () => {
  let m = mkMission('M1', { timelineState: 'draft' })

  const q = transitionTimelineState(m, 'queued', 'plan-manager', 'pushed to timeline')
  assert.equal(q.ok, true)
  assert.equal(q.mission.timelineState, 'queued')

  const r = transitionTimelineState(q.mission, 'running', 'backend-engineer', 'work started')
  assert.equal(r.ok, true)
  assert.equal(r.mission.timelineState, 'running')

  const d = transitionTimelineState(r.mission, 'done', 'qa', 'all tests passed')
  assert.equal(d.ok, true)
  assert.equal(d.mission.timelineState, 'done')

  m = d.mission
  assert.equal(m.timelineLog?.length, 3)
  assert.deepEqual(
    m.timelineLog?.map((t) => `${t.from}->${t.to}`),
    ['draft->queued', 'queued->running', 'running->done'],
  )
})

test('CRITERION 1 — state machine: running -> failed, then failed -> queued retry', () => {
  const running = transitionTimelineState(
    mkMission('M2', { timelineState: 'running' }),
    'failed',
    'qa',
    'audit failed',
  )
  assert.equal(running.ok, true)
  assert.equal(running.mission.timelineState, 'failed')

  const retry = transitionTimelineState(running.mission, 'queued', 'plan-manager', 'retry')
  assert.equal(retry.ok, true)
  assert.equal(retry.mission.timelineState, 'queued')
})

test('CRITERION 1 — state machine: illegal transitions are rejected, mission unchanged', () => {
  // skip a state
  const skip = transitionTimelineState(mkMission('M3', { timelineState: 'draft' }), 'running', 'x', 'r')
  assert.equal(skip.ok, false)
  assert.equal(skip.mission.timelineState, 'draft')
  assert.equal(skip.mission.timelineLog, undefined)

  // terminal state cannot move
  const terminal = transitionTimelineState(mkMission('M4', { timelineState: 'done' }), 'queued', 'x', 'r')
  assert.equal(terminal.ok, false)

  // no-op transition rejected
  const noop = transitionTimelineState(mkMission('M5', { timelineState: 'queued' }), 'queued', 'x', 'r')
  assert.equal(noop.ok, false)
})

test('CRITERION 1 — state machine: transition is atomic (state + log written together)', () => {
  const before = mkMission('M6', { timelineState: 'queued' })
  const ok = transitionTimelineState(before, 'running', 'backend-engineer', 'start')
  // success: BOTH state and a matching log entry are present
  assert.equal(ok.mission.timelineState, 'running')
  assert.equal(ok.mission.timelineLog?.at(-1)?.to, 'running')
  assert.equal(ok.transition?.actor, 'backend-engineer')
  assert.equal(ok.transition?.reason, 'start')
  // input object is not mutated
  assert.equal(before.timelineState, 'queued')
  assert.equal(before.timelineLog, undefined)

  // failure: NEITHER state nor log changes
  const bad = transitionTimelineState(before, 'done', 'x', 'r')
  assert.equal(bad.mission, before)
})

test('CRITERION 1 — deriveTimelineState backfills legacy missions', () => {
  assert.equal(deriveTimelineState(mkMission('L1', { inTimeline: false })), 'draft')
  assert.equal(deriveTimelineState(mkMission('L2', { lifecycleStatus: 'MISSION_DONE' })), 'done')
  assert.equal(deriveTimelineState(mkMission('L3', { lifecycleStatus: 'AUDIT_PENDING' })), 'failed')
  assert.equal(deriveTimelineState(mkMission('L4', { lifecycleStatus: 'ACTIVE' })), 'running')
  assert.equal(deriveTimelineState(mkMission('L5')), 'queued')
  // explicit state always wins
  assert.equal(deriveTimelineState(mkMission('L6', { inTimeline: false, timelineState: 'running' })), 'running')
})

test('CRITERION 1 — transition table covers all 5 states', () => {
  assert.equal(TIMELINE_STATES.length, 5)
  for (const state of TIMELINE_STATES) {
    assert.ok(Array.isArray(TIMELINE_TRANSITIONS[state]), `missing transitions for ${state}`)
  }
  assert.equal(canTransition('draft', 'queued'), true)
  assert.equal(canTransition('draft', 'done'), false)
  assert.equal(canTransition('running', 'failed'), true)
})

// ─── SM2 / Criterion 2: bulk push (multi-mission queued transition) ───────────

test('CRITERION 2 — bulk push: many draft missions transition to queued atomically', () => {
  const drafts = ['B1', 'B2', 'B3', 'B4', 'B5'].map((id) => mkMission(id, { timelineState: 'draft' }))
  const schedule = '2026-06-01T09:00:00.000Z'

  const pushed = drafts.map((m) =>
    transitionTimelineState(m, 'queued', 'plan-manager', `pushed · scheduled ${schedule}`),
  )

  assert.equal(pushed.every((r) => r.ok), true, 'every mission must push')
  assert.equal(pushed.every((r) => r.mission.timelineState === 'queued'), true)
  // each push produced exactly one audited transition carrying the schedule
  for (const r of pushed) {
    assert.equal(r.mission.timelineLog?.length, 1)
    assert.match(r.transition?.reason ?? '', /scheduled 2026-06-01/)
  }
})

// ─── SM3 / Criterion 3: SLA tracking + alerts ────────────────────────────────

const NOW = new Date('2026-05-21T12:00:00.000Z')

test('CRITERION 3 — slaStatus: none / ok / at_risk / breached', () => {
  assert.equal(slaStatus(mkMission('S1'), NOW), 'none')
  assert.equal(slaStatus(mkMission('S2', { slaDeadline: '2026-05-30T12:00:00.000Z' }), NOW), 'ok')
  assert.equal(slaStatus(mkMission('S3', { slaDeadline: '2026-05-21T20:00:00.000Z' }), NOW), 'at_risk')
  assert.equal(slaStatus(mkMission('S4', { slaDeadline: '2026-05-20T12:00:00.000Z' }), NOW), 'breached')
  // a done mission never breaches its SLA
  assert.equal(
    slaStatus(mkMission('S5', { slaDeadline: '2026-05-20T12:00:00.000Z', timelineState: 'done' }), NOW),
    'ok',
  )
  assert.ok(SLA_AT_RISK_WINDOW_HOURS > 0)
})

test('CRITERION 3 — computeSlaAlerts: breached before at_risk, then by severity', () => {
  const missions: Mission[] = [
    mkMission('A', { slaDeadline: '2026-05-20T12:00:00.000Z', severity: 'High' }),     // breached
    mkMission('B', { slaDeadline: '2026-05-19T12:00:00.000Z', severity: 'Critical' }), // breached
    mkMission('C', { slaDeadline: '2026-05-21T18:00:00.000Z', severity: 'Critical' }), // at_risk
    mkMission('D', { slaDeadline: '2026-06-30T12:00:00.000Z', severity: 'Low' }),      // ok -> excluded
    mkMission('E', { slaDeadline: '2026-05-20T12:00:00.000Z', isDeleted: true }),       // deleted -> excluded
  ]
  const alerts = computeSlaAlerts(missions, NOW)
  assert.equal(alerts.length, 3)
  assert.deepEqual(alerts.map((a) => a.missionId), ['B', 'A', 'C'])
  assert.equal(alerts[0].status, 'breached')
  assert.equal(alerts[2].status, 'at_risk')
  assert.ok(alerts[0].hoursOverdue > 0, 'breached mission reports positive hoursOverdue')
})

// ─── SM4: mission audit trail (file storage in SYSTEM/INFO/AUDITS/) ───────────

test('SM4 — audit trail: append + read round-trip', () => {
  const tmpRoot = path.join(os.tmpdir(), `mt-audit-${Date.now()}`)
  try {
    const t1 = transitionTimelineState(mkMission('AT1', { timelineState: 'draft' }), 'queued', 'plan-manager', 'pushed')
    const t2 = transitionTimelineState(t1.mission, 'running', 'backend-engineer', 'started')

    assert.equal(appendTimelineAudit('AT1', t1.transition!, { auditRoot: tmpRoot }), true)
    assert.equal(appendTimelineAudit('AT1', t2.transition!, { auditRoot: tmpRoot }), true)

    const rows = readTimelineAudit(new Date(t1.transition!.ts), { auditRoot: tmpRoot })
    assert.ok(rows.length >= 2)
    const mine = rows.filter((r) => r.missionId === 'AT1')
    assert.equal(mine[0].from, 'draft')
    assert.equal(mine[0].to, 'queued')
    assert.equal(mine[0].actor, 'plan-manager')
    assert.equal(mine[0].reason, 'pushed')
    assert.equal(mine[1].to, 'running')
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})

test('SM4 — audit trail: read returns empty array for a day with no file', () => {
  const tmpRoot = path.join(os.tmpdir(), `mt-audit-empty-${Date.now()}`)
  assert.deepEqual(readTimelineAudit(new Date('2020-01-01T00:00:00.000Z'), { auditRoot: tmpRoot }), [])
})
