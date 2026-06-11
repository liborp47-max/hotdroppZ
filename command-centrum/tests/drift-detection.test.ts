import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDriftReport,
  detectDistributionDrift,
} from '../lib/audit-dashboard/drift-detection.ts'

// ─── detectDistributionDrift ─────────────────────────────────────────────────

test('identical distributions -> no drift', () => {
  const d = { scout: 50, writer: 50 }
  assert.deepEqual(detectDistributionDrift('pipeline_distribution', d, d), [])
})

test('share shift above threshold -> alert with delta points', () => {
  // baseline 50/50 -> current 80/20 = +30pp / -30pp.
  const alerts = detectDistributionDrift(
    'pipeline_distribution',
    { scout: 80, writer: 20 },
    { scout: 50, writer: 50 },
  )
  assert.equal(alerts.length, 2)
  const scout = alerts.find((a) => a.key === 'scout')!
  assert.equal(scout.deltaPoints, 30)
  assert.equal(scout.severity, 'critical') // >= 30pp
  assert.equal(scout.baselineShare, 0.5)
  assert.equal(scout.currentShare, 0.8)
})

test('moderate shift -> warn (not critical)', () => {
  const alerts = detectDistributionDrift(
    'model_usage',
    { groq: 70, claude: 30 },
    { groq: 50, claude: 50 },
  )
  assert.ok(alerts.every((a) => a.severity === 'warn')) // 20pp < 30
})

test('shift below warn threshold -> no alert', () => {
  const alerts = detectDistributionDrift(
    'model_usage',
    { groq: 55, claude: 45 },
    { groq: 50, claude: 50 },
  ) // 5pp < 15
  assert.equal(alerts.length, 0)
})

test('low volume (< minTotal) -> skipped', () => {
  const alerts = detectDistributionDrift(
    'content_quality',
    { high: 3, low: 0 },
    { high: 0, low: 2 },
  ) // totals 3 and 2, below default minTotal 10
  assert.equal(alerts.length, 0)
})

test('new key appearing -> drift alert', () => {
  const alerts = detectDistributionDrift(
    'model_usage',
    { groq: 50, claude: 50 },
    { groq: 100 },
  )
  const claude = alerts.find((a) => a.key === 'claude')!
  assert.equal(claude.baselineShare, 0)
  assert.equal(claude.currentShare, 0.5)
  assert.equal(claude.deltaPoints, 50)
})

// ─── buildDriftReport ────────────────────────────────────────────────────────

test('buildDriftReport combines dimensions + counts + sorts critical first', () => {
  const report = buildDriftReport({
    pipelineDistribution: { current: { scout: 90, writer: 10 }, baseline: { scout: 50, writer: 50 } }, // 40pp critical
    modelUsage: { current: { groq: 70, claude: 30 }, baseline: { groq: 50, claude: 50 } }, // 20pp warn
  }, {}, '2026-06-03T00:00:00Z')
  assert.deepEqual(report.dimensions, ['pipeline_distribution', 'model_usage'])
  assert.equal(report.counts.critical >= 1, true)
  assert.equal(report.alerts[0].severity, 'critical') // sorted critical first
  assert.equal(report.generatedAt, '2026-06-03T00:00:00Z')
})

test('buildDriftReport with no input -> empty', () => {
  const report = buildDriftReport({})
  assert.deepEqual(report.alerts, [])
  assert.deepEqual(report.dimensions, [])
})
