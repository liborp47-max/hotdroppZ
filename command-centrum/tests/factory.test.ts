import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FACTORY_STAGES,
  computeExecutionPlan,
  validateDag,
  isParallelizable,
  canStageRun,
  nextRunnableStages,
  canTransitionStage,
} from '../lib/factory/coordinator-state-machine.ts'
import {
  enqueueJob,
  orderQueue,
  dequeueBatch,
  jobSlaStatus,
  slaBreaches,
  backpressureStatus,
  DEFAULT_QUEUE_CONFIG,
  type FactoryJob,
} from '../lib/factory/work-queue.ts'
import {
  computeQualityScore,
  evaluateQualityGate,
  QUALITY_THRESHOLD,
  type StoryQualitySignals,
} from '../lib/factory/quality-gate.ts'
import { computeFactoryMetrics, percentile, type FactoryRunRecord } from '../lib/factory/metrics.ts'

// ─── CRITERION 1: Coordinator state machine + parallel execution ─────────────

test('CRITERION 1 — execution plan batches the DAG with a parallel batch', () => {
  const plan = computeExecutionPlan()
  assert.deepEqual(plan[0], ['cluster'])
  // story_builder and enrichment both depend only on cluster → same batch
  assert.equal(plan[1].length, 2)
  assert.ok(plan[1].includes('story_builder') && plan[1].includes('enrichment'))
  assert.deepEqual(plan[2], ['writer'])
  assert.deepEqual(plan[3], ['creator'])
})

test('CRITERION 1 — isParallelizable: writer ∥ enrichment, but not dependency pairs', () => {
  assert.equal(isParallelizable('writer', 'enrichment'), true)
  assert.equal(isParallelizable('cluster', 'creator'), false) // creator transitively needs cluster
  assert.equal(isParallelizable('story_builder', 'writer'), false)
})

test('CRITERION 1 — validateDag passes the canonical DAG, rejects a cycle', () => {
  assert.equal(validateDag().valid, true)
  const cyclic = {
    ...FACTORY_STAGES,
    cluster: { ...FACTORY_STAGES.cluster, dependsOn: ['creator' as const] },
  }
  const res = validateDag(cyclic)
  assert.equal(res.valid, false)
  assert.ok(res.errors.length > 0)
  assert.throws(() => computeExecutionPlan(cyclic))
})

test('CRITERION 1 — canStageRun / nextRunnableStages gate on completed dependencies', () => {
  assert.equal(canStageRun('writer', { story_builder: 'done' }), true)
  assert.equal(canStageRun('writer', { story_builder: 'running' }), false)
  assert.deepEqual(nextRunnableStages({ cluster: 'done' }).sort(), ['enrichment', 'story_builder'])
  assert.deepEqual(nextRunnableStages({}), ['cluster'])
})

test('CRITERION 1 — stage transitions: forward valid, skips and retry handled', () => {
  assert.equal(canTransitionStage('pending', 'running'), true)
  assert.equal(canTransitionStage('running', 'done'), true)
  assert.equal(canTransitionStage('failed', 'running'), true) // retry
  assert.equal(canTransitionStage('pending', 'done'), false)
  assert.equal(canTransitionStage('done', 'running'), false)
})

// ─── CRITERION 2: Work queue with prioritization + SLA ───────────────────────

function job(id: string, priority: FactoryJob['priority'], enqueuedAt: string, slaDeadline?: string): FactoryJob {
  return { id, clusterId: `c-${id}`, priority, enqueuedAt, slaDeadline }
}

test('CRITERION 2 — orderQueue: P0 jumps the queue ahead of earlier P2 jobs', () => {
  const queue = [
    job('a', 'P2', '2026-05-21T09:00:00.000Z'),
    job('b', 'P0', '2026-05-21T10:00:00.000Z'),
    job('c', 'P1', '2026-05-21T08:00:00.000Z'),
  ]
  assert.deepEqual(orderQueue(queue).map((j) => j.id), ['b', 'c', 'a'])
})

test('CRITERION 2 — enqueue backpressure: rejects beyond maxDepth and duplicates', () => {
  const cfg = { maxDepth: 2, maxConcurrent: 2 }
  let q: FactoryJob[] = []
  q = (enqueueJob(q, job('a', 'P1', '2026-05-21T09:00:00.000Z'), cfg) as { queue: FactoryJob[] }).queue
  q = (enqueueJob(q, job('b', 'P1', '2026-05-21T09:01:00.000Z'), cfg) as { queue: FactoryJob[] }).queue
  const full = enqueueJob(q, job('c', 'P1', '2026-05-21T09:02:00.000Z'), cfg)
  assert.equal(full.ok, false)
  assert.equal(full.ok === false && full.reason, 'backpressure')
  const dup = enqueueJob(q, job('a', 'P1', '2026-05-21T09:03:00.000Z'), cfg)
  assert.equal(dup.ok === false && dup.reason, 'duplicate')
})

test('CRITERION 2 — dequeueBatch respects the concurrency budget', () => {
  const queue = [
    job('a', 'P1', '2026-05-21T09:00:00.000Z'),
    job('b', 'P0', '2026-05-21T09:01:00.000Z'),
    job('c', 'P2', '2026-05-21T09:02:00.000Z'),
  ]
  const res = dequeueBatch(queue, 2, { maxDepth: 100, maxConcurrent: 4 })
  assert.equal(res.dispatched.length, 2) // 4 - 2 running
  assert.equal(res.dispatched[0].id, 'b') // P0 first
  assert.equal(res.remaining.length, 1)
})

test('CRITERION 2 — SLA: status + breach detection', () => {
  const now = new Date('2026-05-21T12:00:00.000Z')
  assert.equal(jobSlaStatus(job('a', 'P1', '2026-05-21T08:00:00.000Z'), now), 'none')
  assert.equal(jobSlaStatus(job('b', 'P1', '2026-05-21T08:00:00.000Z', '2026-05-21T11:00:00.000Z'), now), 'breached')
  assert.equal(jobSlaStatus(job('c', 'P1', '2026-05-21T08:00:00.000Z', '2026-05-21T13:00:00.000Z'), now), 'at_risk')
  assert.equal(jobSlaStatus(job('d', 'P1', '2026-05-21T08:00:00.000Z', '2026-05-22T00:00:00.000Z'), now), 'ok')

  const breaches = slaBreaches(
    [
      job('x', 'P1', '2026-05-21T08:00:00.000Z', '2026-05-21T11:00:00.000Z'),
      job('y', 'P1', '2026-05-21T08:00:00.000Z', '2026-05-22T00:00:00.000Z'),
    ],
    now,
  )
  assert.deepEqual(breaches.map((j) => j.id), ['x'])
})

test('CRITERION 2 — backpressure status: ok / warn / full', () => {
  const cfg = { maxDepth: 10, maxConcurrent: 4 }
  assert.equal(backpressureStatus(new Array(3).fill(null) as FactoryJob[], 0, cfg).state, 'ok')
  assert.equal(backpressureStatus(new Array(8).fill(null) as FactoryJob[], 0, cfg).state, 'warn')
  assert.equal(backpressureStatus(new Array(10).fill(null) as FactoryJob[], 4, cfg).state, 'full')
  assert.equal(backpressureStatus([], 1, cfg).freeSlots, 3)
  assert.ok(DEFAULT_QUEUE_CONFIG.maxConcurrent > 0)
})

// ─── CRITERION 3: Quality gate in Coordinator ────────────────────────────────

const STRONG: StoryQualitySignals = {
  wordCount: 600,
  hasHeadline: true,
  sourceCount: 4,
  enrichmentLinks: 3,
  hallucinationConfidence: 0.9,
  completeness: 1,
}

test('CRITERION 3 — quality gate: strong story passes', () => {
  const res = evaluateQualityGate(STRONG)
  assert.ok(res.score > QUALITY_THRESHOLD)
  assert.equal(res.verdict, 'pass')
})

test('CRITERION 3 — quality gate: near-miss routes to manual_review', () => {
  const res = evaluateQualityGate({
    wordCount: 300,
    hasHeadline: true,
    sourceCount: 2,
    enrichmentLinks: 1,
    hallucinationConfidence: 0.7,
    completeness: 0.6,
  })
  assert.equal(res.verdict, 'manual_review')
  assert.ok(res.score <= QUALITY_THRESHOLD && res.score >= QUALITY_THRESHOLD - 0.2)
})

test('CRITERION 3 — quality gate: weak story routes to rerun_writer', () => {
  const res = evaluateQualityGate({
    wordCount: 40,
    hasHeadline: false,
    sourceCount: 0,
    enrichmentLinks: 0,
    hallucinationConfidence: 0.3,
    completeness: 0.2,
  })
  assert.equal(res.verdict, 'rerun_writer')
  assert.ok(res.reasons.length > 0)
})

test('CRITERION 3 — computeQualityScore stays within 0..1', () => {
  assert.ok(computeQualityScore(STRONG) > 0 && computeQualityScore(STRONG) <= 1)
  // all signals zero incl. grounding → score floors at 0
  const floor = computeQualityScore({
    wordCount: 0, hasHeadline: false, sourceCount: 0, enrichmentLinks: 0,
    hallucinationConfidence: 0, completeness: 0,
  })
  assert.equal(floor, 0)
  // omitted hallucinationConfidence defaults grounding to 0.8 — still in bounds
  const noGrounding = computeQualityScore({
    wordCount: 0, hasHeadline: false, sourceCount: 0, enrichmentLinks: 0, completeness: 0,
  })
  assert.ok(noGrounding >= 0 && noGrounding <= 1)
})

// ─── SM6: Factory performance metrics ────────────────────────────────────────

test('SM6 — percentile uses nearest-rank', () => {
  assert.equal(percentile([10, 20, 30, 40], 50), 20)
  assert.equal(percentile([10, 20, 30, 40], 95), 40)
  assert.equal(percentile([], 50), 0)
})

test('SM6 — computeFactoryMetrics aggregates throughput, latency, cost', () => {
  const records: FactoryRunRecord[] = [
    { id: 'r1', status: 'success', totalProcessingMs: 1000, costUsd: 0.05, completedAt: '2026-05-21T09:00:00.000Z' },
    { id: 'r2', status: 'success', totalProcessingMs: 3000, costUsd: 0.07, completedAt: '2026-05-21T10:00:00.000Z' },
    { id: 'r3', status: 'partial', totalProcessingMs: 2000, costUsd: 0.03, completedAt: '2026-05-21T11:00:00.000Z' },
    { id: 'r4', status: 'error', totalProcessingMs: 500, costUsd: 0.01, completedAt: '2026-05-21T12:00:00.000Z' },
  ]
  const m = computeFactoryMetrics(records, 4)
  assert.equal(m.total, 4)
  assert.equal(m.success, 2)
  assert.equal(m.errors, 1)
  assert.equal(m.successRate, 0.5)
  assert.equal(m.throughputPerHour, 0.75) // (2 success + 1 partial) / 4h
  assert.equal(m.latencyP95Ms, 3000)
  assert.equal(m.totalCostUsd, 0.16)
  // avg cost over non-error runs: (0.05 + 0.07 + 0.03) / 3
  assert.equal(m.avgCostPerPostUsd, 0.05)
})
