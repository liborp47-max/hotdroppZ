import { test } from 'node:test'
import assert from 'node:assert/strict'

import { verifyAndCompleteMission } from '../lib/hd-central/lifecycle.ts'

// Minimal mission/plan factories — only fields the lifecycle logic reads.
function mkMission(over: Record<string, unknown> = {}) {
  return {
    id: 'UM-X',
    name: 'X',
    priority: 'P0',
    createdAt: '2026-06-03T00:00:00.000Z',
    lifecycleStatus: 'ACTIVE',
    status: 'in_progress',
    userMission: true,
    inTimeline: false, // keep out of auto-promotion
    subMissions: [],
    auditLog: [],
    ...over,
  } as never
}
const mkPlan = (missions: unknown[]) => ({ missions } as never)
const find = (plan: { missions: { id: string }[] }, id: string) =>
  plan.missions.find((m) => m.id === id) as never as { lifecycleStatus: string }

// ─── baseline behaviour preserved ────────────────────────────────────────────

test('all sub-missions done -> completed', () => {
  const plan = mkPlan([mkMission({ subMissions: [{ id: 's1', status: 'done' }] })])
  const { outcome, plan: next } = verifyAndCompleteMission(plan, 'UM-X')
  assert.equal(outcome.kind, 'completed')
  assert.equal(find(next, 'UM-X').lifecycleStatus, 'MISSION_DONE')
  assert.equal((next as { missions: unknown[] }).missions.length, 1)
})

test('base mission, partial work -> spawns exactly one +1, parent DONE', () => {
  const plan = mkPlan([
    mkMission({ subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'todo' }] }),
  ])
  const { outcome, plan: next } = verifyAndCompleteMission(plan, 'UM-X')
  assert.equal(outcome.kind, 'follow_up_created')
  const missions = (next as { missions: { id: string; followUpLevel?: number }[] }).missions
  assert.equal(missions.length, 2)
  assert.equal(find(next, 'UM-X').lifecycleStatus, 'MISSION_DONE')
  const child = missions.find((m) => m.id === 'UM-X+1')!
  assert.equal(child.followUpLevel, 1)
})

// ─── Guard 1: un-executed follow-up is not laundered to DONE ──────────────────

test('un-worked follow-up -> parked AUDIT_PENDING, no new mission', () => {
  const plan = mkPlan([
    mkMission({
      id: 'UM-X+1',
      isFollowUp: true,
      followUpLevel: 1,
      subMissions: [{ id: 's2', status: 'todo' }],
    }),
  ])
  const { outcome, plan: next } = verifyAndCompleteMission(plan, 'UM-X+1')
  assert.equal(outcome.kind, 'noop')
  assert.equal((outcome as { reason: string }).reason, 'unexecuted_follow_up')
  assert.equal(find(next, 'UM-X+1').lifecycleStatus, 'AUDIT_PENDING')
  assert.equal((next as { missions: unknown[] }).missions.length, 1) // no +2 spawned
})

// ─── Guard 2: follow-up depth cap ────────────────────────────────────────────

test('partially-worked follow-up at depth cap -> parked, no +2', () => {
  const plan = mkPlan([
    mkMission({
      id: 'UM-X+1',
      isFollowUp: true,
      followUpLevel: 1,
      subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'todo' }],
    }),
  ])
  const { outcome, plan: next } = verifyAndCompleteMission(plan, 'UM-X+1')
  assert.equal(outcome.kind, 'noop')
  assert.equal((outcome as { reason: string }).reason, 'followup_depth_capped')
  assert.equal(find(next, 'UM-X+1').lifecycleStatus, 'AUDIT_PENDING')
  assert.equal((next as { missions: unknown[] }).missions.length, 1)
})

// ─── the chain cannot grow unbounded ─────────────────────────────────────────

test('chain terminates: base -> +1 -> parked (no +2 ever)', () => {
  let plan: any = mkPlan([
    mkMission({ subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'todo' }] }),
  ])
  plan = verifyAndCompleteMission(plan, 'UM-X').plan // spawns UM-X+1
  // Re-verifying the un-worked +1 must park it, not create UM-X+2.
  const r2 = verifyAndCompleteMission(plan, 'UM-X+1')
  assert.equal(r2.outcome.kind, 'noop')
  const ids = (r2.plan as { missions: { id: string }[] }).missions.map((m) => m.id)
  assert.deepEqual(ids.sort(), ['UM-X', 'UM-X+1'])
  assert.ok(!ids.includes('UM-X+2'))
})

test('idempotent: re-verifying a parked follow-up stays parked', () => {
  let plan: any = mkPlan([
    mkMission({ id: 'UM-X+1', isFollowUp: true, followUpLevel: 1, subMissions: [{ id: 's2', status: 'todo' }] }),
  ])
  plan = verifyAndCompleteMission(plan, 'UM-X+1').plan
  const again = verifyAndCompleteMission(plan, 'UM-X+1')
  assert.equal(again.outcome.kind, 'noop')
  assert.equal((again.plan as { missions: unknown[] }).missions.length, 1)
})
