import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  appendStatusTransition,
  buildHistoryTimeline,
  parseStatusHistory,
  type StatusTransition,
} from '../lib/pipeline/status-history.ts'

// ─── parseStatusHistory ──────────────────────────────────────────────────────

test('parses array and JSON string; tolerates junk', () => {
  const arr = [{ status: 'SCOUTED', changed_at: '2026-06-01T00:00:00Z' }]
  assert.equal(parseStatusHistory(arr).length, 1)
  assert.equal(parseStatusHistory(JSON.stringify(arr)).length, 1)
  assert.deepEqual(parseStatusHistory(null), [])
  assert.deepEqual(parseStatusHistory('not json'), [])
  assert.deepEqual(parseStatusHistory([{ no: 'status' }]), []) // dropped
})

// ─── appendStatusTransition ──────────────────────────────────────────────────

test('appends a new transition', () => {
  const h: StatusTransition[] = [{ status: 'SCOUTED', changed_at: '2026-06-01T00:00:00Z' }]
  const next = appendStatusTransition(h, { status: 'CURATED', changed_at: '2026-06-01T01:00:00Z', reason: 'scored' })
  assert.equal(next.length, 2)
  assert.equal(next[1].status, 'CURATED')
  assert.equal(next[1].reason, 'scored')
})

test('no-op when status unchanged from last entry', () => {
  const h: StatusTransition[] = [{ status: 'CURATED', changed_at: '2026-06-01T00:00:00Z' }]
  const next = appendStatusTransition(h, { status: 'CURATED' })
  assert.equal(next, h) // same reference, no duplicate
})

test('defaults reason/user_id to null', () => {
  const next = appendStatusTransition([], { status: 'SCOUTED', changed_at: '2026-06-01T00:00:00Z' })
  assert.equal(next[0].reason, null)
  assert.equal(next[0].user_id, null)
})

// ─── buildHistoryTimeline ────────────────────────────────────────────────────

test('merges status + audit chronologically', () => {
  const timeline = buildHistoryTimeline(
    [
      { status: 'SCOUTED', changed_at: '2026-06-01T00:00:00Z' },
      { status: 'CURATED', changed_at: '2026-06-01T02:00:00Z' },
    ],
    [{ action: 'updated', changes: { title: { old: 'a', new: 'b' } }, changed_at: '2026-06-01T01:00:00Z' }],
  )
  assert.equal(timeline.length, 3)
  assert.deepEqual(timeline.map((e) => e.at), [
    '2026-06-01T00:00:00Z',
    '2026-06-01T01:00:00Z',
    '2026-06-01T02:00:00Z',
  ])
  assert.equal(timeline[0].label, 'status -> SCOUTED')
  assert.equal(timeline[1].kind, 'audit')
  assert.equal(timeline[1].detail, 'title')
})

test('empty inputs -> empty timeline', () => {
  assert.deepEqual(buildHistoryTimeline([], []), [])
})
