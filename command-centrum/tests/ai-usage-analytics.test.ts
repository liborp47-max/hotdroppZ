import { test } from 'node:test'
import assert from 'node:assert/strict'

import { evaluateBudget, type UsageWindow } from '../lib/ai/usage-budget.ts'
import { summarizeProviders, trendByDay, type UsageRecord } from '../lib/ai/provider-performance.ts'

// ─── SM3: usage budget alerts ────────────────────────────────────────────────

const window = (over: Partial<UsageWindow> = {}): UsageWindow => ({
  totalTokens: 0,
  totalCostUsd: 0,
  providers: [],
  ...over,
})

test('no budget configured -> no alerts', () => {
  assert.deepEqual(evaluateBudget(window({ totalTokens: 1_000_000 }), {}), [])
})

test('under warn threshold -> no alerts', () => {
  const a = evaluateBudget(window({ totalTokens: 5000 }), { dailyTokenBudget: 10000, warnThresholdPct: 80 })
  assert.equal(a.length, 0)
})

test('token usage in warn band -> warning', () => {
  const a = evaluateBudget(window({ totalTokens: 8500 }), { dailyTokenBudget: 10000, warnThresholdPct: 80 })
  assert.equal(a.length, 1)
  assert.equal(a[0].kind, 'token_budget')
  assert.equal(a[0].severity, 'warning')
  assert.equal(a[0].usedPct, 85)
})

test('token usage over budget -> critical', () => {
  const a = evaluateBudget(window({ totalTokens: 12000 }), { dailyTokenBudget: 10000 })
  assert.equal(a[0].severity, 'critical')
  assert.ok(a[0].usedPct >= 100)
})

test('cost budget alert recommends switching the top paid spender', () => {
  const w = window({
    totalCostUsd: 0.9,
    providers: [
      { provider: 'groq_fast', tokens: 1000, costUsd: 0, isFree: true },
      { provider: 'openai_full', tokens: 500, costUsd: 0.8, isFree: false },
      { provider: 'claude_haiku', tokens: 300, costUsd: 0.1, isFree: false },
    ],
  })
  const a = evaluateBudget(w, { dailyCostBudgetUsd: 1.0 })
  assert.equal(a.length, 1)
  assert.equal(a[0].kind, 'cost_budget')
  assert.match(a[0].recommendation, /openai_full/)
})

test('both token and cost budgets can fire', () => {
  const a = evaluateBudget(window({ totalTokens: 9999, totalCostUsd: 2 }), {
    dailyTokenBudget: 10000,
    dailyCostBudgetUsd: 1,
  })
  assert.equal(a.length, 2)
})

// ─── SM5: provider performance + trend ───────────────────────────────────────

const rec = (over: Partial<UsageRecord> = {}): UsageRecord => ({
  provider: 'groq',
  createdAt: '2026-06-01T10:00:00Z',
  latencyMs: 1000,
  totalTokens: 100,
  costUsd: 0,
  status: 'success',
  ...over,
})

test('summarizeProviders computes per-provider metrics, sorted by calls', () => {
  const recs: UsageRecord[] = [
    rec({ provider: 'groq', latencyMs: 1000, totalTokens: 100, costUsd: 0, status: 'success' }),
    rec({ provider: 'groq', latencyMs: 3000, totalTokens: 100, costUsd: 0, status: 'error' }),
    rec({ provider: 'openai_mini', latencyMs: 800, totalTokens: 1000, costUsd: 0.0002, status: 'success' }),
  ]
  const perf = summarizeProviders(recs)
  assert.equal(perf[0].provider, 'groq') // most calls first
  assert.equal(perf[0].calls, 2)
  assert.equal(perf[0].successRate, 0.5)
  assert.equal(perf[0].avgLatencyMs, 2000)
  const openai = perf.find((p) => p.provider === 'openai_mini')!
  assert.equal(openai.costPerToken, Number((0.0002 / 1000).toFixed(8)))
})

test('summarizeProviders: zero tokens -> costPerToken 0 (no divide-by-zero)', () => {
  const perf = summarizeProviders([rec({ totalTokens: 0, costUsd: 0 })])
  assert.equal(perf[0].costPerToken, 0)
})

test('trendByDay buckets by UTC day, chronological', () => {
  const recs: UsageRecord[] = [
    rec({ createdAt: '2026-06-02T09:00:00Z', status: 'success' }),
    rec({ createdAt: '2026-06-01T09:00:00Z', status: 'success' }),
    rec({ createdAt: '2026-06-01T20:00:00Z', status: 'error' }),
  ]
  const t = trendByDay(recs)
  assert.equal(t.length, 2)
  assert.equal(t[0].day, '2026-06-01')
  assert.equal(t[0].calls, 2)
  assert.equal(t[0].successRate, 0.5)
  assert.equal(t[1].day, '2026-06-02')
})

test('trendByDay filters by provider', () => {
  const recs: UsageRecord[] = [
    rec({ provider: 'groq', createdAt: '2026-06-01T09:00:00Z' }),
    rec({ provider: 'openai_mini', createdAt: '2026-06-01T10:00:00Z' }),
  ]
  const t = trendByDay(recs, { provider: 'groq' })
  assert.equal(t.length, 1)
  assert.equal(t[0].calls, 1)
})
