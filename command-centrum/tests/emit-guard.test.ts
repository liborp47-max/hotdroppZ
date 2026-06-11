import { test } from 'node:test'
import assert from 'node:assert/strict'

import { baseMissionId, checkEmitGuard } from '../lib/hd-central/emit-guard.ts'

const mk = (over: Record<string, unknown> = {}) =>
  ({ id: 'UM-X', name: 'X', lifecycleStatus: 'PLAN', subMissions: [], ...over } as never)
const plan = (missions: unknown[]) => ({ missions } as never)

test('baseMissionId strips +N chain', () => {
  assert.equal(baseMissionId('UM-FEED_UI+1+1'), 'UM-FEED_UI')
  assert.equal(baseMissionId('UM-WRITER+1'), 'UM-WRITER')
  assert.equal(baseMissionId('UM-WRITER'), 'UM-WRITER')
})

test('blocks a MISSION_DONE mission', () => {
  const m = mk({ id: 'UM-FEED_UI+1', lifecycleStatus: 'MISSION_DONE' })
  const g = checkEmitGuard(m, plan([m]))
  assert.equal(g?.reason, 'mission_already_done')
})

test('blocks un-worked follow-up whose base is DONE', () => {
  const base = mk({ id: 'UM-FEED_UI', lifecycleStatus: 'MISSION_DONE' })
  const dup = mk({
    id: 'UM-FEED_UI+1+1',
    lifecycleStatus: 'AUDIT_PENDING',
    isFollowUp: true,
    subMissions: [{ id: 's1', status: 'todo' }],
  })
  const g = checkEmitGuard(dup, plan([base, dup]))
  assert.equal(g?.reason, 'duplicate_of_completed')
  assert.equal(g?.baseId, 'UM-FEED_UI')
})

test('allows a genuinely actionable PLAN mission', () => {
  const m = mk({ id: 'UM-NEW', lifecycleStatus: 'PLAN', subMissions: [{ id: 's1', status: 'todo' }] })
  assert.equal(checkEmitGuard(m, plan([m])), null)
})

test('allows a follow-up whose base is NOT done (real blocked work)', () => {
  const base = mk({ id: 'UM-CC', lifecycleStatus: 'AUDIT_PENDING' })
  const fu = mk({
    id: 'UM-CC+1',
    lifecycleStatus: 'AUDIT_PENDING',
    isFollowUp: true,
    subMissions: [{ id: 's1', status: 'todo' }],
  })
  assert.equal(checkEmitGuard(fu, plan([base, fu])), null)
})

test('allows a follow-up that has real executed work even if base is DONE', () => {
  const base = mk({ id: 'UM-X', lifecycleStatus: 'MISSION_DONE' })
  const fu = mk({
    id: 'UM-X+1',
    lifecycleStatus: 'ACTIVE',
    isFollowUp: true,
    subMissions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'todo' }],
  })
  assert.equal(checkEmitGuard(fu, plan([base, fu])), null)
})
