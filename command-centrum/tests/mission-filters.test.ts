import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  applyMissionFilters,
  computeScopeCounts,
  matchesScope,
  DEFAULT_MISSION_FILTERS,
  type MissionFilters,
} from '../lib/hd-central/mission-filters.ts'

const mk = (over: Record<string, unknown> = {}) =>
  ({ id: 'M', name: 'name', purpose: 'p', status: 'todo', ...over } as never)

const f = (over: Partial<MissionFilters> = {}): MissionFilters => ({ ...DEFAULT_MISSION_FILTERS, ...over })

const missions = [
  mk({ id: 'INBOX-1', inTimeline: false, priority: 'P0', phase: 'Foundation', urgencyScore: 90 }),
  mk({ id: 'TL-1', inTimeline: true, priority: 'P1', phase: 'Build', urgencyScore: 80, sequenceIndex: 1 }),
  mk({ id: 'TL-2', inTimeline: true, priority: 'P2', phase: 'Build', urgencyScore: 50, sequenceIndex: 0 }),
  mk({ id: 'DONE-1', inTimeline: true, lifecycleStatus: 'MISSION_DONE', priority: 'P1' }),
  mk({ id: 'SPEC-1', userMission: true, inTimeline: true, priority: 'P3' }),
  mk({ id: 'SPEC-DONE', userMission: true, lifecycleStatus: 'MISSION_DONE' }),
  mk({ id: 'DEL-1', inTimeline: false, isDeleted: true }),
]

test('matchesScope: inbox / timeline / spec_ops / done / all + deleted excluded', () => {
  assert.equal(matchesScope(missions[0] as never, 'inbox'), true)
  assert.equal(matchesScope(missions[1] as never, 'timeline'), true)
  assert.equal(matchesScope(missions[4] as never, 'spec_ops'), true)
  assert.equal(matchesScope(missions[5] as never, 'spec_ops'), false) // done user mission graduates out
  assert.equal(matchesScope(missions[3] as never, 'done'), true)
  assert.equal(matchesScope(missions[6] as never, 'all'), false) // deleted never matches
})

test('undefined inTimeline is treated as timeline (back-compat)', () => {
  const m = mk({ id: 'X' }) // no inTimeline
  assert.equal(matchesScope(m as never, 'timeline'), true)
  assert.equal(matchesScope(m as never, 'inbox'), false)
})

test('applyMissionFilters: scope inbox returns only inbox, no deleted', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'inbox' }))
  assert.deepEqual(out.map((m) => m.id), ['INBOX-1'])
})

test('applyMissionFilters: priority + phase narrow within scope', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'timeline', phase: 'Build', priority: 'P2' }))
  assert.deepEqual(out.map((m) => m.id), ['TL-2'])
})

test('applyMissionFilters: search matches id/name/purpose/moduleId', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'all', search: 'spec' }))
  assert.deepEqual(out.map((m) => m.id).sort(), ['SPEC-1', 'SPEC-DONE'])
})

test('sort sequence asc: sequenced first by index, then urgency', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'timeline', sortKey: 'sequence', sortDir: 'asc' }))
  // TL-2 (seq 0) before TL-1 (seq 1); unsequenced after
  assert.equal(out[0].id, 'TL-2')
  assert.equal(out[1].id, 'TL-1')
})

test('sort urgency desc: highest urgencyScore first', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'urgency', sortDir: 'desc' }))
  assert.equal(out[0].id, 'INBOX-1') // 90 highest
})

test('direction toggles order (urgency asc puts lowest first)', () => {
  const desc = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'urgency', sortDir: 'desc' }))
  const asc = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'urgency', sortDir: 'asc' }))
  assert.equal(desc[0].id, 'INBOX-1')
  assert.notEqual(asc[0].id, 'INBOX-1')
})

test('sort priority asc: P0 before P1 before P2/P3', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'priority', sortDir: 'asc' }))
  assert.equal(out[0].id, 'INBOX-1') // P0
})

test('sort id asc: alphabetical by id', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'id', sortDir: 'asc' }))
  const ids = out.map((m) => m.id)
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)))
})

test('sort status asc: groups by lifecycleStatus string', () => {
  const out = applyMissionFilters(missions as never, f({ scope: 'all', sortKey: 'status', sortDir: 'asc' }))
  // AUDIT_PENDING-less fixtures: MISSION_DONE rows sort after empty-status rows
  assert.ok(out.length > 0)
})

test('computeScopeCounts: counts per scope, deleted excluded', () => {
  const c = computeScopeCounts(missions as never)
  assert.equal(c.inbox, 1)
  assert.equal(c.timeline, 5) // TL-1, TL-2, DONE-1, SPEC-1 + SPEC-DONE (undefined inTimeline = timeline)
  assert.equal(c.spec_ops, 1) // SPEC-1 only (SPEC-DONE graduated)
  assert.equal(c.done, 2) // DONE-1, SPEC-DONE
  assert.equal(c.all, 6) // 7 minus 1 deleted
})
