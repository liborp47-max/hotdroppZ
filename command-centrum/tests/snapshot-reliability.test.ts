import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateSnapshotReliability,
  SNAPSHOT_FRESHNESS_SLO_HOURS,
  type SnapshotReliabilityCode,
} from '../lib/hd-central/snapshot-reliability.ts'
import type { AnalyticsSnapshot } from '../lib/hd-central/analytics-snapshot.ts'

const NOW = new Date('2026-06-27T12:00:00.000Z')
const ctx = { now: NOW }
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

/** A complete, healthy snapshot. Override pieces per test. */
function mk(over: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  const base: AnalyticsSnapshot = {
    generatedAt: NOW.toISOString(),
    contractStatus: 'pass',
    warnings: [],
    sections: {
      missionHealth: {
        confidencePercent: 92,
        freshnessHours: 3,
        blockedRatio: 0.1,
        blockedMissions: 1,
        activeMissions: 10,
        healthState: 'green',
        stages: [],
      },
      auditRisk: { unresolvedCritical: 0, unresolvedHigh: 0, bySeverity: {}, topItems: [] },
      intelTrends: { topClusters: [], recurrenceScore: 0 },
      testSignal: { state: 'stable', confidencePercent: 90, latestAgeHours: 2, sampledRuns: 5, evidenceCoveragePercent: 100, dataClass: 'verified' },
    },
  }
  return { ...base, ...over, sections: { ...base.sections, ...(over.sections ?? {}) } }
}

const codes = (s: AnalyticsSnapshot, c = ctx): SnapshotReliabilityCode[] =>
  evaluateSnapshotReliability(s, c).reasons.map((r) => r.code)

test('healthy snapshot → ok, no reasons, within SLO', () => {
  const r = evaluateSnapshotReliability(mk(), ctx)
  assert.equal(r.state, 'ok')
  assert.deepEqual(r.reasons, [])
  assert.equal(r.freshness.withinSlo, true)
  assert.equal(r.completeness.ok, true)
  assert.equal(r.freshness.sloHours, SNAPSHOT_FRESHNESS_SLO_HOURS)
})

test('STALE_DATA: stage freshness beyond SLO → degraded', () => {
  const r = evaluateSnapshotReliability(mk({ sections: { missionHealth: { ...mk().sections.missionHealth, freshnessHours: 30 } } as never }), ctx)
  assert.equal(r.state, 'degraded')
  assert.ok(codes(mk({ sections: { missionHealth: { ...mk().sections.missionHealth, freshnessHours: 30 } } as never })).includes('STALE_DATA'))
  assert.equal(r.freshness.withinSlo, false)
})

test('STALE_GENERATED: snapshot older than SLO → degraded', () => {
  const s = mk({ generatedAt: hoursAgo(36) })
  const r = evaluateSnapshotReliability(s, ctx)
  assert.equal(r.state, 'degraded')
  assert.ok(codes(s).includes('STALE_GENERATED'))
  assert.equal(r.freshness.ageHours, 36)
})

test('freshness within SLO at the boundary (24h exactly is OK)', () => {
  assert.equal(evaluateSnapshotReliability(mk({ generatedAt: hoursAgo(24) }), ctx).state, 'ok')
})

test('sloHours override tightens the gate', () => {
  const s = mk({ generatedAt: hoursAgo(5) })
  assert.equal(evaluateSnapshotReliability(s, { now: NOW }).state, 'ok')
  assert.equal(evaluateSnapshotReliability(s, { now: NOW, sloHours: 1 }).state, 'degraded')
})

test('MISSING_FIELDS: invalid generatedAt + bad contractStatus', () => {
  const s = mk({ generatedAt: 'not-a-date', contractStatus: 'bogus' as never })
  const r = evaluateSnapshotReliability(s, ctx)
  assert.equal(r.state, 'degraded')
  assert.ok(codes(s).includes('MISSING_FIELDS'))
  assert.ok(r.completeness.missingFields.includes('generatedAt'))
  assert.ok(r.completeness.missingFields.includes('contractStatus'))
  assert.equal(r.freshness.ageHours, null)
})

test('STATUS_INCONSISTENT: blocked > active and confidence out of range', () => {
  const s = mk({ sections: { missionHealth: { ...mk().sections.missionHealth, blockedMissions: 8, activeMissions: 3, confidencePercent: 140, healthState: 'amber' } } as never })
  const r = evaluateSnapshotReliability(s, ctx)
  assert.equal(r.state, 'degraded')
  assert.ok(codes(s).includes('STATUS_INCONSISTENT'))
  assert.equal(r.completeness.inconsistencies.length >= 2, true)
})

test('contractStatus fail is flagged as an inconsistency', () => {
  assert.ok(codes(mk({ contractStatus: 'fail' })).includes('STATUS_INCONSISTENT'))
})

test('DEPENDENCY_UNAVAILABLE: degraded data-source warnings', () => {
  const s = mk({ warnings: ['Supabase is not reachable, snapshot is degraded.', 'View analytics_mission_health is unavailable: timeout'] })
  const r = evaluateSnapshotReliability(s, ctx)
  assert.equal(r.state, 'degraded')
  assert.ok(codes(s).includes('DEPENDENCY_UNAVAILABLE'))
  assert.equal(r.completeness.unavailableDependencies.length, 2)
})

test('benign warnings do not trip the dependency gate', () => {
  const r = evaluateSnapshotReliability(mk({ warnings: ['Heads up: cosmetic note'] }), ctx)
  assert.equal(r.state, 'ok')
  assert.equal(r.completeness.unavailableDependencies.length, 0)
})

test('multiple failures accumulate distinct reason codes', () => {
  const s = mk({ generatedAt: hoursAgo(48), warnings: ['view unavailable'], sections: { missionHealth: { ...mk().sections.missionHealth, freshnessHours: 50 } } as never })
  const got = codes(s).sort()
  assert.deepEqual(got, ['DEPENDENCY_UNAVAILABLE', 'STALE_DATA', 'STALE_GENERATED'])
})
