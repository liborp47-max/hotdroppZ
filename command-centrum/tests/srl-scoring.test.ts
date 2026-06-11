/**
 * SRL scoring tests — exercises authority / freshness / health formulas
 * from spec §Scoring algoritmy.
 *
 * Run: node --experimental-strip-types --test tests/srl-scoring.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeAuthority, isRecentlyValidated } from '../lib/sources/srl/scoring/authority.ts'
import { computeFreshness } from '../lib/sources/srl/scoring/freshness.ts'
import {
  deriveHealthFromCounters,
  deriveHealthBatch,
  fetchRunCountersBatch,
} from '../lib/sources/srl/scoring/health.ts'
import { MockDb } from './_srl-mock-db.ts'

const NOW = new Date('2026-05-27T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()

// ─── authority ──────────────────────────────────────────────────────────────

test('authority: base only', () => {
  const s = computeAuthority(
    {
      authorityBase: 70,
      verifiedHandlesCount: 0,
      recentlyValidated: false,
      errorRate30d: 0,
      lastValidatedAt: iso(60_000),
    },
    NOW,
  )
  assert.equal(s, 70)
})

test('authority: handles +5 each, recent +10, clamped to 100', () => {
  const s = computeAuthority(
    {
      authorityBase: 80,
      verifiedHandlesCount: 8, // +40
      recentlyValidated: true, // +10
      errorRate30d: 0,
      lastValidatedAt: iso(60_000),
    },
    NOW,
  )
  assert.equal(s, 100)
})

test('authority: error-rate penalty applies (errRate * 50)', () => {
  const s = computeAuthority(
    {
      authorityBase: 90,
      verifiedHandlesCount: 0,
      recentlyValidated: false,
      errorRate30d: 0.4, // -20
      lastValidatedAt: iso(60_000),
    },
    NOW,
  )
  assert.equal(s, 70)
})

test('authority: stale penalty -20 when last_validated > 30d', () => {
  const s = computeAuthority(
    {
      authorityBase: 80,
      verifiedHandlesCount: 0,
      recentlyValidated: false,
      errorRate30d: 0,
      lastValidatedAt: iso(40 * 24 * 60 * 60 * 1000),
    },
    NOW,
  )
  assert.equal(s, 60)
})

test('authority: NaN / missing lastValidatedAt → treated stale', () => {
  const s = computeAuthority(
    {
      authorityBase: 50,
      verifiedHandlesCount: 0,
      recentlyValidated: false,
      errorRate30d: 0,
      lastValidatedAt: undefined,
    },
    NOW,
  )
  assert.equal(s, 30) // 50 - 20 stale penalty
})

test('isRecentlyValidated: true within 7d, false beyond', () => {
  assert.equal(isRecentlyValidated(iso(6 * 24 * 60 * 60 * 1000), NOW), true)
  assert.equal(isRecentlyValidated(iso(8 * 24 * 60 * 60 * 1000), NOW), false)
  assert.equal(isRecentlyValidated(undefined, NOW), false)
  assert.equal(isRecentlyValidated('not-a-date', NOW), false)
})

// ─── freshness ──────────────────────────────────────────────────────────────

test('freshness: tiered decay matches spec', () => {
  assert.equal(computeFreshness(iso(30 * 60 * 1000), NOW), 1.0) // 30 min
  assert.equal(computeFreshness(iso(12 * 60 * 60 * 1000), NOW), 0.8) // 12h
  assert.equal(computeFreshness(iso(3 * 24 * 60 * 60 * 1000), NOW), 0.5) // 3d
  assert.equal(computeFreshness(iso(20 * 24 * 60 * 60 * 1000), NOW), 0.2) // 20d
  assert.equal(computeFreshness(iso(60 * 24 * 60 * 60 * 1000), NOW), 0.0) // 60d
})

test('freshness: missing / invalid → 0', () => {
  assert.equal(computeFreshness(undefined, NOW), 0)
  assert.equal(computeFreshness('garbage', NOW), 0)
})

test('freshness: future timestamps clamp to 1.0', () => {
  assert.equal(computeFreshness(iso(-1000), NOW), 1.0)
})

// ─── health ─────────────────────────────────────────────────────────────────

test('health: green when errorRate < 5%', () => {
  assert.equal(deriveHealthFromCounters({ total: 100, failed: 4, lastRunAt: iso(60_000) }, NOW), 'green')
})

test('health: amber when 5% ≤ errorRate < 20%', () => {
  assert.equal(deriveHealthFromCounters({ total: 100, failed: 15, lastRunAt: iso(60_000) }, NOW), 'amber')
})

test('health: red when errorRate ≥ 20%', () => {
  assert.equal(deriveHealthFromCounters({ total: 100, failed: 30, lastRunAt: iso(60_000) }, NOW), 'red')
})

test('health: red when no run in 48h regardless of errorRate', () => {
  assert.equal(
    deriveHealthFromCounters({ total: 100, failed: 0, lastRunAt: iso(60 * 60 * 60 * 1000) }, NOW),
    'red',
  )
})

test('health: unknown when no runs at all', () => {
  assert.equal(deriveHealthFromCounters(null, NOW), 'unknown')
  assert.equal(deriveHealthFromCounters({ total: 0, failed: 0 }, NOW), 'unknown')
})

test('health: deriveHealthBatch — defaults to unknown for sources w/o runs', async () => {
  const db = new MockDb({ worker_runs: [] })
  const out = await deriveHealthBatch(db.asSrlDb(), ['a', 'b', 'c'], NOW)
  assert.equal(out.get('a'), 'unknown')
  assert.equal(out.get('b'), 'unknown')
  assert.equal(out.get('c'), 'unknown')
})

test('health: fetchRunCountersBatch groups + counts failures', async () => {
  const db = new MockDb({
    worker_runs: [
      { source_id: 'a', status: 'success', started_at: iso(60_000) },
      { source_id: 'a', status: 'failure', started_at: iso(120_000) },
      { source_id: 'a', status: 'success', started_at: iso(180_000) },
      { source_id: 'b', status: 'failure', started_at: iso(240_000) },
    ],
  })
  const counters = await fetchRunCountersBatch(db.asSrlDb(), ['a', 'b'], 24 * 60 * 60 * 1000, NOW)
  assert.equal(counters.get('a')?.total, 3)
  assert.equal(counters.get('a')?.failed, 1)
  assert.equal(counters.get('b')?.total, 1)
  assert.equal(counters.get('b')?.failed, 1)
})
