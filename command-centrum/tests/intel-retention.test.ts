/**
 * Intel retention tests — RPC pass-through + safety check.
 *
 * Run: node --experimental-strip-types --test tests/intel-retention.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  purgeExpired,
  getPolicies,
  findUnsafePolicies,
} from '../lib/intel/retention.ts'
import type { RetentionPolicy } from '../lib/intel/types.ts'
import { MockDb } from './_srl-mock-db.ts'

// ─── findUnsafePolicies (pure) ──────────────────────────────────────────────

test('findUnsafePolicies: flags audit_record with finite retention', () => {
  const policies: RetentionPolicy[] = [
    { source: 'audit_record', retentionDays: 30, description: 'wrong' },
    { source: 'pipeline_run', retentionDays: 90, description: 'ok' },
  ]
  const unsafe = findUnsafePolicies(policies)
  assert.equal(unsafe.length, 1)
  assert.equal(unsafe[0]!.source, 'audit_record')
})

test('findUnsafePolicies: audit with null retention → safe', () => {
  const policies: RetentionPolicy[] = [
    { source: 'audit_record', retentionDays: null, description: 'forever' },
    { source: 'pipeline_run', retentionDays: 90, description: 'ok' },
  ]
  assert.deepEqual(findUnsafePolicies(policies), [])
})

test('findUnsafePolicies: non-audit sources never flagged', () => {
  const policies: RetentionPolicy[] = [
    { source: 'pipeline_run', retentionDays: 90, description: 'ok' },
    { source: 'scout_run', retentionDays: 90, description: 'ok' },
  ]
  assert.deepEqual(findUnsafePolicies(policies), [])
})

// ─── getPolicies ────────────────────────────────────────────────────────────

test('getPolicies: maps shape from intel_retention_policies table', async () => {
  const db = new MockDb({
    intel_retention_policies: [
      { source: 'audit_record', retention_days: null, description: 'forever' },
      { source: 'pipeline_run', retention_days: 90, description: '90d' },
    ],
  })
  const policies = await getPolicies(db.asSrlDb())
  assert.equal(policies.length, 2)
  assert.equal(policies[0]!.source, 'audit_record')
  assert.equal(policies[0]!.retentionDays, null)
})

test('getPolicies: empty table → empty array', async () => {
  const db = new MockDb({ intel_retention_policies: [] })
  const policies = await getPolicies(db.asSrlDb())
  assert.deepEqual(policies, [])
})

// ─── purgeExpired ───────────────────────────────────────────────────────────

test('purgeExpired: calls RPC and aggregates report', async () => {
  // MockDb.rpc returns { data: null, error: null } by default — exercise the
  // null-data path which should still report degraded=false with 0 purged.
  const db = new MockDb()
  const report = await purgeExpired(db.asSrlDb())
  assert.equal(report.degraded, false)
  assert.equal(report.totalPurged, 0)
  assert.deepEqual(report.results, [])
  assert.ok(report.ranAt)
})

test('purgeExpired: timestamp is ISO and stable when now provided', async () => {
  const db = new MockDb()
  const frozen = new Date('2026-05-28T12:00:00Z')
  const report = await purgeExpired(db.asSrlDb(), frozen)
  assert.equal(report.ranAt, frozen.toISOString())
})
