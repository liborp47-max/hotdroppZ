import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BULK_ACTIONS,
  resolveBulkAction,
  canApplyBulkAction,
  partitionBulkTargets,
  filterScoutItems,
  filterRuns,
  summarizeRuns,
  type ScoutItemRow,
  type ScoutRunRow,
} from '../lib/scout-hq/scout-items.ts'

function item(id: string, overrides: Partial<ScoutItemRow> = {}): ScoutItemRow {
  return {
    id,
    title: `Item ${id}`,
    source: 'rss',
    category: 'droppz',
    status: 'SCOUTED',
    priority: 'P1',
    created_at: '2026-05-21T10:00:00.000Z',
    ...overrides,
  }
}

function run(id: string, overrides: Partial<ScoutRunRow> = {}): ScoutRunRow {
  return {
    id,
    status: 'complete',
    sources_count: 5,
    items_found: 20,
    duration_ms: 4200,
    triggered_by: 'manual',
    error_message: null,
    started_at: '2026-05-21T09:00:00.000Z',
    completed_at: '2026-05-21T09:01:00.000Z',
    ...overrides,
  }
}

// ─── Criterion 1: Scout items dashboard with bulk actions ────────────────────

test('CRITERION 1 — bulk actions resolve to a valid status transition', () => {
  assert.equal(resolveBulkAction('move_to_translated')?.toStatus, 'TRANSLATED')
  assert.equal(resolveBulkAction('discard')?.toStatus, 'discarded')
  assert.equal(resolveBulkAction('nonsense'), null)
  assert.deepEqual(Object.keys(BULK_ACTIONS).sort(), ['discard', 'move_to_translated'])
})

test('CRITERION 1 — canApplyBulkAction enforces the source-status guard', () => {
  // move_to_translated only applies to SCOUTED items
  assert.equal(canApplyBulkAction({ status: 'SCOUTED' }, 'move_to_translated'), true)
  assert.equal(canApplyBulkAction({ status: 'TRANSLATED' }, 'move_to_translated'), false)
  // discard applies to several pre-terminal statuses but not to discarded items
  assert.equal(canApplyBulkAction({ status: 'CURATED' }, 'discard'), true)
  assert.equal(canApplyBulkAction({ status: 'discarded' }, 'discard'), false)
})

test('CRITERION 1 — filterScoutItems filters by status, priority and search', () => {
  const items = [
    item('A', { priority: 'P0', status: 'SCOUTED' }),
    item('B', { priority: 'P2', status: 'SCOUTED' }),
    item('C', { priority: 'P0', status: 'discarded', title: 'Drake drops' }),
  ]
  assert.deepEqual(filterScoutItems(items, { priority: 'P0' }).map((i) => i.id), ['A', 'C'])
  assert.deepEqual(filterScoutItems(items, { status: 'SCOUTED' }).map((i) => i.id), ['A', 'B'])
  assert.deepEqual(filterScoutItems(items, { search: 'drake' }).map((i) => i.id), ['C'])
  assert.equal(filterScoutItems(items, { priority: 'all' }).length, 3)
})

// ─── Criterion 2: DroppZ detector UI — manual override applicability ─────────

test('CRITERION 2 — partitionBulkTargets splits a manual override into applied/skipped', () => {
  const selection = [
    item('A', { status: 'SCOUTED' }),
    item('B', { status: 'SCOUTED' }),
    item('C', { status: 'TRANSLATED' }), // already advanced — skipped
    item('D', { status: 'discarded' }),  // terminal — skipped
  ]
  const { applicable, skipped } = partitionBulkTargets(selection, 'move_to_translated')
  assert.deepEqual(applicable, ['A', 'B'])
  assert.deepEqual(skipped, ['C', 'D'])
})

test('CRITERION 2 — discard override applies across pre-terminal statuses', () => {
  const selection = [
    item('A', { status: 'new' }),
    item('B', { status: 'CURATED' }),
    item('C', { status: 'discarded' }),
  ]
  const { applicable, skipped } = partitionBulkTargets(selection, 'discard')
  assert.deepEqual(applicable, ['A', 'B'])
  assert.deepEqual(skipped, ['C'])
})

// ─── SM5: Scout run history — filterable + aggregated ────────────────────────

test('SM5 — filterRuns filters by status and started-at lower bound', () => {
  const runs = [
    run('r1', { status: 'complete', started_at: '2026-05-21T09:00:00.000Z' }),
    run('r2', { status: 'error', started_at: '2026-05-20T09:00:00.000Z' }),
    run('r3', { status: 'running', started_at: '2026-05-19T09:00:00.000Z' }),
  ]
  assert.deepEqual(filterRuns(runs, { status: 'error' }).map((r) => r.id), ['r2'])
  assert.deepEqual(
    filterRuns(runs, { since: '2026-05-20T00:00:00.000Z' }).map((r) => r.id),
    ['r1', 'r2'],
  )
  assert.equal(filterRuns(runs, { status: 'all' }).length, 3)
})

test('SM5 — summarizeRuns aggregates counts, items and error rate', () => {
  const runs = [
    run('r1', { status: 'complete', items_found: 10 }),
    run('r2', { status: 'complete', items_found: 5 }),
    run('r3', { status: 'error', items_found: 0 }),
    run('r4', { status: 'running', items_found: 2 }),
  ]
  const s = summarizeRuns(runs)
  assert.equal(s.total, 4)
  assert.equal(s.complete, 2)
  assert.equal(s.errors, 1)
  assert.equal(s.running, 1)
  assert.equal(s.itemsFound, 17)
  assert.equal(s.errorRate, 0.25)
})

test('SM5 — summarizeRuns handles an empty run list', () => {
  const s = summarizeRuns([])
  assert.equal(s.total, 0)
  assert.equal(s.errorRate, 0)
})
