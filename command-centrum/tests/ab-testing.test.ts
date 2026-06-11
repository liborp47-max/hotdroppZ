import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assignArm,
  bucketOf,
  evaluateExperiment,
  providerForItem,
  summarizeArm,
  type AbExperiment,
  type AbSample,
} from '../lib/ai/ab-core.ts'
import {
  _resetAbState,
  getActiveExperimentForStep,
  getReport,
  listExperiments,
  providerForStepItem,
  recordAbSample,
  registerExperiment,
  removeExperiment,
} from '../lib/ai/ab-testing.ts'

const exp = (over: Partial<AbExperiment> = {}): AbExperiment => ({
  id: 'exp1',
  step: 'writer',
  control: 'claude_haiku',
  variant: 'groq',
  splitPct: 50,
  objective: 'balanced',
  active: true,
  minSamples: 2,
  ...over,
})

const sample = (over: Partial<AbSample> = {}): AbSample => ({
  arm: 'control',
  provider: 'claude_haiku',
  latencyMs: 1000,
  costUsd: 0.001,
  quality: 0.9,
  success: true,
  ...over,
})

// ─── ab-core: assignment ─────────────────────────────────────────────────────

test('bucketOf is deterministic and within 0-99', () => {
  assert.equal(bucketOf('exp1', 'item-42'), bucketOf('exp1', 'item-42'))
  for (const id of ['a', 'b', 'item-999', 'xyz']) {
    const b = bucketOf('exp1', id)
    assert.ok(b >= 0 && b < 100)
  }
})

test('splitPct 0 -> all control; 100 -> all variant', () => {
  const e0 = exp({ splitPct: 0 })
  const e100 = exp({ splitPct: 100 })
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    assert.equal(assignArm(e0, id), 'control')
    assert.equal(assignArm(e100, id), 'variant')
  }
})

test('inactive experiment always assigns control', () => {
  const e = exp({ splitPct: 100, active: false })
  assert.equal(assignArm(e, 'anything'), 'control')
})

test('roughly splitPct of items go to variant', () => {
  const e = exp({ splitPct: 30 })
  let variant = 0
  const N = 2000
  for (let i = 0; i < N; i++) if (assignArm(e, `item-${i}`) === 'variant') variant++
  const pct = (variant / N) * 100
  assert.ok(pct > 22 && pct < 38, `expected ~30%, got ${pct.toFixed(1)}%`)
})

test('providerForItem maps arm to provider', () => {
  const e = exp({ splitPct: 100 })
  assert.equal(providerForItem(e, 'x'), 'groq')
  assert.equal(providerForItem(exp({ splitPct: 0 }), 'x'), 'claude_haiku')
})

// ─── ab-core: aggregation + winner ───────────────────────────────────────────

test('summarizeArm computes averages and success rate', () => {
  const samples: AbSample[] = [
    sample({ arm: 'control', latencyMs: 1000, costUsd: 0.002, quality: 0.8, success: true }),
    sample({ arm: 'control', latencyMs: 2000, costUsd: 0.004, quality: 0.6, success: false }),
  ]
  const s = summarizeArm('control', 'claude_haiku', samples)
  assert.equal(s.samples, 2)
  assert.equal(s.avgLatencyMs, 1500)
  assert.equal(s.successRate, 0.5)
  assert.equal(s.avgQuality, 0.7)
})

test('evaluateExperiment: below minSamples -> not confident, no winner', () => {
  const e = exp({ minSamples: 5 })
  const samples = [sample({ arm: 'control' }), sample({ arm: 'variant', provider: 'groq' })]
  const r = evaluateExperiment(e, samples)
  assert.equal(r.confident, false)
  assert.equal(r.winner, null)
})

test('evaluateExperiment latency objective: faster arm wins', () => {
  const e = exp({ objective: 'latency', minSamples: 2 })
  const samples: AbSample[] = [
    sample({ arm: 'control', latencyMs: 3000 }), sample({ arm: 'control', latencyMs: 3000 }),
    sample({ arm: 'variant', provider: 'groq', latencyMs: 500 }), sample({ arm: 'variant', provider: 'groq', latencyMs: 500 }),
  ]
  const r = evaluateExperiment(e, samples)
  assert.equal(r.confident, true)
  assert.equal(r.winner, 'variant') // groq much faster
})

test('evaluateExperiment quality objective: higher quality arm wins', () => {
  const e = exp({ objective: 'quality', minSamples: 2 })
  const samples: AbSample[] = [
    sample({ arm: 'control', quality: 0.95 }), sample({ arm: 'control', quality: 0.95 }),
    sample({ arm: 'variant', provider: 'groq', quality: 0.6 }), sample({ arm: 'variant', provider: 'groq', quality: 0.6 }),
  ]
  assert.equal(evaluateExperiment(e, samples).winner, 'control')
})

// ─── ab-testing: registry + runtime switch + report ──────────────────────────

test('registry: register, active lookup, runtime switch, remove', () => {
  _resetAbState()
  registerExperiment(exp({ id: 'e-writer', step: 'writer', splitPct: 100 }))
  assert.equal(listExperiments().length, 1)
  assert.equal(getActiveExperimentForStep('writer')?.id, 'e-writer')
  assert.equal(getActiveExperimentForStep('curator'), null)
  // splitPct 100 -> every item routed to variant provider.
  assert.equal(providerForStepItem('writer', 'item-1'), 'groq')
  assert.equal(providerForStepItem('curator', 'item-1'), null) // no experiment
  assert.equal(removeExperiment('e-writer'), true)
  assert.equal(providerForStepItem('writer', 'item-1'), null)
})

test('inactive experiment is not used by the runtime switch', () => {
  _resetAbState()
  registerExperiment(exp({ id: 'e2', step: 'writer', splitPct: 100, active: false }))
  assert.equal(providerForStepItem('writer', 'x'), null)
})

test('recordAbSample + getReport aggregate recorded data', () => {
  _resetAbState()
  registerExperiment(exp({ id: 'e3', objective: 'latency', minSamples: 2 }))
  recordAbSample('e3', sample({ arm: 'control', latencyMs: 2000 }))
  recordAbSample('e3', sample({ arm: 'control', latencyMs: 2000 }))
  recordAbSample('e3', sample({ arm: 'variant', provider: 'groq', latencyMs: 400 }))
  recordAbSample('e3', sample({ arm: 'variant', provider: 'groq', latencyMs: 400 }))
  const report = getReport('e3')
  assert.ok(report)
  assert.equal(report!.confident, true)
  assert.equal(report!.winner, 'variant')
  assert.equal(report!.variant.samples, 2)
  assert.equal(getReport('nonexistent'), null)
})

test('recordAbSample for unknown experiment is ignored (no throw)', () => {
  _resetAbState()
  recordAbSample('ghost', sample())
  assert.equal(getReport('ghost'), null)
})
