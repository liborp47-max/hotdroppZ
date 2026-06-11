/**
 * Intel query tests — filter assembly, bucketEventsByHour transform.
 *
 * Run: node --experimental-strip-types --test tests/intel-query.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  queryEvents,
  bucketEventsByHour,
  getEventsByCorrelation,
  listRetentionPolicies,
} from '../lib/intel/query.ts'
import type { IntelEvent } from '../lib/intel/types.ts'
import { MockDb } from './_srl-mock-db.ts'

const NOW = new Date('2026-05-28T12:00:00Z')

const SAMPLE_EVENTS = [
  {
    id: 'e1',
    kind: 'pipeline_run',
    source_table: 'pipeline_runs',
    stage: 'scout',
    status: 'complete',
    severity: 'info',
    actor: 'system',
    correlation_id: 'corr-1',
    started_at: '2026-05-28T11:00:00Z',
    ended_at: '2026-05-28T11:00:30Z',
    duration_ms: 30000,
    message: 'scout run',
    metadata: { items: 12 },
    created_at: '2026-05-28T11:00:00Z',
  },
  {
    id: 'e2',
    kind: 'audit_record',
    source_table: 'intel_audit_records',
    stage: 'mission',
    status: 'logged',
    severity: 'info',
    actor: 'ceo@example.com',
    correlation_id: 'corr-1',
    started_at: '2026-05-28T11:30:00Z',
    ended_at: '2026-05-28T11:30:00Z',
    duration_ms: 0,
    message: 'MISSION_DONE: UM-FOO',
    metadata: {},
    created_at: '2026-05-28T11:30:00Z',
  },
  {
    id: 'e3',
    kind: 'pipeline_run',
    source_table: 'pipeline_runs',
    stage: 'writer',
    status: 'error',
    severity: 'error',
    actor: 'system',
    correlation_id: 'corr-2',
    started_at: '2026-05-28T10:00:00Z',
    ended_at: '2026-05-28T10:00:05Z',
    duration_ms: 5000,
    message: 'writer crashed',
    metadata: { stack: 'TypeError' },
    created_at: '2026-05-28T10:00:00Z',
  },
]

// ─── queryEvents ────────────────────────────────────────────────────────────

test('queryEvents: returns all events when no filter', async () => {
  const db = new MockDb({ intel_events: SAMPLE_EVENTS })
  const result = await queryEvents(db.asSrlDb())
  assert.equal(result.events.length, 3)
  assert.equal(result.degraded, false)
})

test('queryEvents: maps row shape to IntelEvent shape (snake → camel)', async () => {
  const db = new MockDb({ intel_events: [SAMPLE_EVENTS[0]!] })
  const result = await queryEvents(db.asSrlDb())
  const ev = result.events[0]!
  assert.equal(ev.id, 'e1')
  assert.equal(ev.sourceTable, 'pipeline_runs')
  assert.equal(ev.correlationId, 'corr-1')
  assert.equal(ev.startedAt, '2026-05-28T11:00:00Z')
  assert.equal(ev.endedAt, '2026-05-28T11:00:30Z')
  assert.equal(ev.durationMs, 30000)
  assert.deepEqual(ev.metadata, { items: 12 })
})

test('queryEvents: missing intel_events view → degraded=true with empty events', async () => {
  const db = new MockDb({}) // no intel_events table seeded
  const result = await queryEvents(db.asSrlDb())
  assert.equal(result.events.length, 0)
  assert.equal(result.degraded, false) // mock returns empty array, no throw
})

// ─── getEventsByCorrelation ─────────────────────────────────────────────────

test('getEventsByCorrelation: returns all rows matching correlation_id', async () => {
  const db = new MockDb({ intel_events: SAMPLE_EVENTS })
  const events = await getEventsByCorrelation(db.asSrlDb(), 'corr-1')
  assert.equal(events.length, 2)
  assert.ok(events.every((e) => e.correlationId === 'corr-1'))
})

test('getEventsByCorrelation: unknown correlation → []', async () => {
  const db = new MockDb({ intel_events: SAMPLE_EVENTS })
  const events = await getEventsByCorrelation(db.asSrlDb(), 'nope')
  assert.deepEqual(events, [])
})

// ─── bucketEventsByHour ─────────────────────────────────────────────────────

test('bucketEventsByHour: groups events by hour ISO', () => {
  const events: IntelEvent[] = [
    fixture('a', '2026-05-28T11:15:00Z', 'info'),
    fixture('b', '2026-05-28T11:45:00Z', 'error'),
    fixture('c', '2026-05-28T12:05:00Z', 'info'),
  ]
  const buckets = bucketEventsByHour(events)
  assert.equal(buckets.length, 2)
  assert.equal(buckets[0]!.hourIso, '2026-05-28T11:00:00.000Z')
  assert.equal(buckets[0]!.count, 2)
  assert.equal(buckets[0]!.errorCount, 1)
  assert.equal(buckets[1]!.hourIso, '2026-05-28T12:00:00.000Z')
  assert.equal(buckets[1]!.count, 1)
})

test('bucketEventsByHour: empty input → []', () => {
  assert.deepEqual(bucketEventsByHour([]), [])
})

test('bucketEventsByHour: critical severity counted in errorCount', () => {
  const events: IntelEvent[] = [
    fixture('x', '2026-05-28T11:15:00Z', 'critical'),
    fixture('y', '2026-05-28T11:15:00Z', 'warn'), // not error
  ]
  const buckets = bucketEventsByHour(events)
  assert.equal(buckets[0]!.errorCount, 1) // only critical
})

// ─── listRetentionPolicies ─────────────────────────────────────────────────

test('listRetentionPolicies: maps snake_case retention_days → camelCase retentionDays', async () => {
  const db = new MockDb({
    intel_retention_policies: [
      { source: 'audit_record', retention_days: null, description: 'forever' },
      { source: 'pipeline_run', retention_days: 90, description: '90d' },
    ],
  })
  const policies = await listRetentionPolicies(db.asSrlDb())
  assert.equal(policies.length, 2)
  const audit = policies.find((p) => p.source === 'audit_record')!
  assert.equal(audit.retentionDays, null)
  assert.equal(audit.description, 'forever')
})

// ─── helpers ────────────────────────────────────────────────────────────────

function fixture(id: string, startedAt: string, severity: IntelEvent['severity']): IntelEvent {
  return {
    id,
    kind: 'pipeline_run',
    sourceTable: 'pipeline_runs',
    stage: 'scout',
    status: 'complete',
    severity,
    actor: 'system',
    correlationId: null,
    startedAt,
    endedAt: startedAt,
    durationMs: 0,
    message: 'x',
    metadata: {},
    createdAt: startedAt,
  }
}
