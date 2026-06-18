import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMonitorStages,
  summarizeMonitor,
  healthToLevel,
} from '../lib/hd-central/pipeline-monitor.ts'
import type { PipelineStageState } from '../lib/hd-central/types.ts'

/**
 * HDUA-10 — Live Pipeline Monitor view-model merge.
 * Pins the aggregate+live-metrics merge: stage ordering, queue mapping,
 * health→level, warning derivation, latest-run join, and header roll-up.
 */

function stage(over: Partial<PipelineStageState> & { id: PipelineStageState['id']; index: number }): PipelineStageState {
  return {
    displayName: over.id,
    description: '',
    runtime: 'ts',
    canonicalFile: '',
    status: 'idle',
    health: 'green',
    phase: 'Build',
    inputStatus: null,
    outputStatus: null,
    config: {
      scheduleCron: null, rateLimitPerSecond: null, tokenBudget: null,
      costCeiling: null, secretRef: null, gatewayId: null, maxRetry: null, timeoutMs: null,
    },
    kpi: { itemsToday: 0, itemsWeek: 0, errorsToday: 0, latencyP95Ms: 0, spark7d: [0, 0, 0, 0, 0, 0, 0] },
    lastRunAt: null,
    nextRunAt: null,
    manualTriggerEndpoint: null,
    infoRefs: [],
    ...over,
  } as PipelineStageState
}

const NOW = new Date('2026-06-18T12:00:00.000Z').getTime()

const queues = {
  SCOUTED: 5, TRANSLATED: 3, CURATED: 2,
  clusters_pending_enrichment: 7, clusters_pending_writer: 1,
  posts_pending_publish: 0, posts_pending_multilang: 4, posts_pending_monetizer: 0,
}

test('healthToLevel maps health to ok/warn/error', () => {
  assert.equal(healthToLevel('green'), 'ok')
  assert.equal(healthToLevel('amber'), 'warn')
  assert.equal(healthToLevel('red'), 'error')
})

test('buildMonitorStages: sorts by index and maps queues per stage', () => {
  const agg = {
    stages: [
      stage({ id: 'curator', index: 4 }),
      stage({ id: 'scout', index: 1 }),
      stage({ id: 'filter', index: 2 }),
      stage({ id: 'enrichment', index: 6 }),
    ],
  }
  const rows = buildMonitorStages(agg, { queues, latestRuns: [] }, NOW)
  assert.deepEqual(rows.map((r) => r.id), ['scout', 'filter', 'curator', 'enrichment'])
  // scout has no queue, filter -> SCOUTED, curator -> TRANSLATED, enrichment -> clusters_pending_enrichment
  assert.equal(rows[0].queue, null)
  assert.equal(rows[1].queue, 5)
  assert.equal(rows[2].queue, 3)
  assert.equal(rows[3].queue, 7)
})

test('buildMonitorStages: derives level + warnings from real state', () => {
  const agg = {
    stages: [
      stage({ id: 'writer', index: 7, health: 'red', status: 'error', kpi: { itemsToday: 10, itemsWeek: 40, errorsToday: 3, latencyP95Ms: 900, spark7d: [1, 2, 3, 4, 5, 6, 7] } }),
      stage({ id: 'monetizer', index: 10, status: 'degraded', health: 'amber' }),
      stage({ id: 'scout', index: 1, lastRunAt: '2026-06-15T12:00:00.000Z', status: 'running' }), // >24h stale
    ],
  }
  const rows = buildMonitorStages(agg, { queues, latestRuns: [] }, NOW)
  const writer = rows.find((r) => r.id === 'writer')!
  assert.equal(writer.level, 'error')
  assert.equal(writer.errorsToday, 3)
  assert.ok(writer.warnings.some((w) => w.includes('3 errors today')))
  assert.deepEqual(writer.spark7d, [1, 2, 3, 4, 5, 6, 7])

  const monetizer = rows.find((r) => r.id === 'monetizer')!
  assert.equal(monetizer.level, 'warn')
  assert.ok(monetizer.warnings.includes('stage degraded'))

  const scout = rows.find((r) => r.id === 'scout')!
  assert.ok(scout.warnings.includes('no run in 24h'))
})

test('buildMonitorStages: joins latest run by stage id', () => {
  const agg = { stages: [stage({ id: 'cluster', index: 5 })] }
  const rows = buildMonitorStages(
    agg,
    {
      queues,
      latestRuns: [
        { stage: 'cluster', runId: 'r1', startedAt: 'x', finishedAt: 'y', status: 'completed', durationMs: 1234 },
      ],
    },
    NOW,
  )
  assert.equal(rows[0].runStatus, 'completed')
  assert.equal(rows[0].runDurationMs, 1234)
})

test('buildMonitorStages: null live metrics → null queues, no crash', () => {
  const agg = { stages: [stage({ id: 'filter', index: 2 })] }
  const rows = buildMonitorStages(agg, null, NOW)
  assert.equal(rows[0].queue, null)
  assert.equal(rows[0].runStatus, null)
})

test('summarizeMonitor: rolls up levels, queue, processed, errors', () => {
  const agg = {
    stages: [
      stage({ id: 'scout', index: 1, health: 'green', kpi: { itemsToday: 100, itemsWeek: 700, errorsToday: 0, latencyP95Ms: 10, spark7d: [] } }),
      stage({ id: 'filter', index: 2, health: 'amber', kpi: { itemsToday: 50, itemsWeek: 300, errorsToday: 2, latencyP95Ms: 10, spark7d: [] } }),
      stage({ id: 'writer', index: 7, health: 'red', kpi: { itemsToday: 5, itemsWeek: 20, errorsToday: 1, latencyP95Ms: 10, spark7d: [] } }),
    ],
  }
  const sum = summarizeMonitor(buildMonitorStages(agg, { queues, latestRuns: [] }, NOW))
  assert.equal(sum.total, 3)
  assert.equal(sum.ok, 1)
  assert.equal(sum.warn, 1)
  assert.equal(sum.error, 1)
  assert.equal(sum.processedToday, 155)
  assert.equal(sum.errorsToday, 3)
  // filter→SCOUTED=5 + writer→clusters_pending_writer=1
  assert.equal(sum.queued, 6)
})
