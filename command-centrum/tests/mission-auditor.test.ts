import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  auditMissions,
  renderMissionAuditReport,
  ACTIVE_VERDICTS,
  type MissionVerdict,
} from '../lib/hd-central/mission-auditor.ts'

// name defaults to the id so distinct ids don't trip the duplicate-name
// detector — pass an explicit `name` to exercise MERGE.
const mk = (over: Record<string, unknown> = {}) =>
  ({
    id: 'M',
    name: (over.id as string) ?? 'name',
    purpose: 'p',
    status: 'todo',
    description: 'A real mission description with enough detail.',
    ...over,
  } as never)

function verdictOf(missions: unknown[], id: string): MissionVerdict {
  const r = auditMissions(missions as never)
  return r.entries.find((e) => e.id === id)!.verdict
}

test('DONE: MISSION_DONE → DONE, not actual, excluded from queue', () => {
  const missions = [mk({ id: 'D1', lifecycleStatus: 'MISSION_DONE' })]
  const r = auditMissions(missions as never)
  const e = r.entries[0]
  assert.equal(e.verdict, 'DONE')
  assert.equal(e.checks.actual, false)
  assert.ok(!r.recommendedOrder.includes('D1'))
})

test('ARCHIVE: lifecycleStatus ARCHIVED → ARCHIVE', () => {
  assert.equal(verdictOf([mk({ id: 'A1', lifecycleStatus: 'ARCHIVED' })], 'A1'), 'ARCHIVE')
})

test('DELETE: empty shell (no subs/criteria/description/options) → DELETE', () => {
  const missions = [mk({ id: 'E1', description: '', rationale: '', subMissions: [], successCriteria: [] })]
  const r = auditMissions(missions as never)
  assert.equal(r.entries[0].verdict, 'DELETE')
  assert.equal(r.entries[0].checks.relevant, false)
})

test('MERGE: duplicate normalized name folds into first occurrence', () => {
  const missions = [
    mk({ id: 'OPS-1', name: '[OPERATIONS] Scale Package' }),
    mk({ id: 'OPS-2', name: '[OPERATIONS]  Scale  Package' }),
  ]
  const r = auditMissions(missions as never)
  const keep = r.entries.find((e) => e.id === 'OPS-1')!
  const merge = r.entries.find((e) => e.id === 'OPS-2')!
  assert.equal(keep.verdict, 'KEEP')
  assert.equal(merge.verdict, 'MERGE')
  assert.equal(merge.mergeInto, 'OPS-1')
})

test('PAUSE: cold case is blocked and sinks to bottom of queue', () => {
  const missions = [
    mk({ id: 'COLD', coldCase: true, phase: 'Foundation', priority: 'P0', domains: ['SECURITY'] }),
    mk({ id: 'HOT', phase: 'Foundation', priority: 'P0', domains: ['SECURITY'] }),
  ]
  const r = auditMissions(missions as never)
  assert.equal(r.entries.find((e) => e.id === 'COLD')!.verdict, 'PAUSE')
  // HOT (KEEP) ranks ahead of COLD (PAUSE) despite identical phase/priority.
  assert.deepEqual(r.recommendedOrder, ['HOT', 'COLD'])
})

test('PAUSE: orphan follow-up (missing parent) is paused', () => {
  assert.equal(verdictOf([mk({ id: 'F1', followUpOf: 'GHOST' })], 'F1'), 'PAUSE')
})

test('UPDATE: phase contradicts domain (FRONTEND should be Build, not Scale)', () => {
  assert.equal(
    verdictOf([mk({ id: 'U1', phase: 'Scale', domains: ['FRONTEND'] })], 'U1'),
    'UPDATE',
  )
})

test('KEEP: relevant + logical mission with matching phase/domain', () => {
  assert.equal(
    verdictOf([mk({ id: 'K1', phase: 'Build', domains: ['FRONTEND'] })], 'K1'),
    'KEEP',
  )
})

test('recommended order: Foundation before Build, P0 before P1', () => {
  const missions = [
    mk({ id: 'BUILD-P0', phase: 'Build', priority: 'P0' }),
    mk({ id: 'FOUND-P1', phase: 'Foundation', priority: 'P1' }),
    mk({ id: 'FOUND-P0', phase: 'Foundation', priority: 'P0' }),
  ]
  const r = auditMissions(missions as never)
  assert.deepEqual(r.recommendedOrder, ['FOUND-P0', 'FOUND-P1', 'BUILD-P0'])
})

test('deleted missions are ignored entirely', () => {
  const r = auditMissions([mk({ id: 'X', isDeleted: true })] as never)
  assert.equal(r.totalMissions, 0)
  assert.equal(r.entries.length, 0)
})

test('only active verdicts feed the queue', () => {
  const missions = [
    mk({ id: 'KEEP1', phase: 'Build', priority: 'P1' }),
    mk({ id: 'DONE1', lifecycleStatus: 'MISSION_DONE' }),
    mk({ id: 'DEL1', description: '', subMissions: [], successCriteria: [] }),
  ]
  const r = auditMissions(missions as never)
  for (const id of r.recommendedOrder) {
    const v = r.entries.find((e) => e.id === id)!.verdict
    assert.ok(ACTIVE_VERDICTS.has(v), `${id} (${v}) should be an active verdict`)
  }
  assert.deepEqual(r.recommendedOrder, ['KEEP1'])
})

test('counts sum to total mission count', () => {
  const missions = [
    mk({ id: 'A', phase: 'Build', priority: 'P1' }),
    mk({ id: 'B', lifecycleStatus: 'MISSION_DONE' }),
    mk({ id: 'C', lifecycleStatus: 'ARCHIVED' }),
  ]
  const r = auditMissions(missions as never)
  const sum = Object.values(r.counts).reduce((a, b) => a + b, 0)
  assert.equal(sum, r.totalMissions)
})

test('renderMissionAuditReport emits frontmatter, tables and checklist', () => {
  const missions = [
    mk({ id: 'K1', name: 'Keep me', phase: 'Build', priority: 'P1' }),
    mk({ id: 'D1', name: 'Done one', lifecycleStatus: 'MISSION_DONE' }),
  ]
  const r = auditMissions(missions as never)
  const md = renderMissionAuditReport(r, { auditId: 'AUD-TEST-MISSIONS' })
  assert.match(md, /type: "MISSION_RELEVANCE_AUDIT"/)
  assert.match(md, /AUD-TEST-MISSIONS/)
  assert.match(md, /## Verdikty/)
  assert.match(md, /## Doporučené technické pořadí fronty/)
  assert.match(md, /## Akční checklist/)
  assert.match(md, /K1/)
})
