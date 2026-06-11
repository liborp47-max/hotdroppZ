/**
 * Provider performance dashboard — pure core (UM-AI_CONTROL / SM5).
 *
 * Aggregates ai_usage_logs records into per-provider performance (success rate,
 * avg latency, cost per token) and a day-bucketed trend. Deterministic and
 * dependency-free (unit-testable); the API route supplies real records.
 */

export interface UsageRecord {
  provider: string
  /** ISO timestamp (ai_usage_logs.created_at). */
  createdAt: string
  latencyMs: number
  totalTokens: number
  costUsd: number
  /** 'success' | 'error' | 'timeout'. */
  status: string
}

export interface ProviderPerf {
  provider: string
  calls: number
  successRate: number
  errorRate: number
  avgLatencyMs: number
  totalTokens: number
  totalCostUsd: number
  /** totalCost / totalTokens (0 when no tokens). */
  costPerToken: number
}

export interface TrendPoint {
  day: string // YYYY-MM-DD
  calls: number
  successRate: number
  avgLatencyMs: number
  totalCostUsd: number
  totalTokens: number
}

function isSuccess(status: string): boolean {
  return status === 'success'
}

function dayOf(iso: string): string {
  // Stable UTC day bucket; falls back to the raw prefix if unparseable.
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10)
  return new Date(t).toISOString().slice(0, 10)
}

export function summarizeProviders(records: UsageRecord[]): ProviderPerf[] {
  const byProvider = new Map<string, UsageRecord[]>()
  for (const r of records) {
    const bucket = byProvider.get(r.provider)
    if (bucket) bucket.push(r)
    else byProvider.set(r.provider, [r])
  }

  const out: ProviderPerf[] = []
  for (const [provider, recs] of byProvider) {
    const calls = recs.length
    const successes = recs.filter((r) => isSuccess(r.status)).length
    const totalTokens = recs.reduce((s, r) => s + (r.totalTokens || 0), 0)
    const totalCostUsd = recs.reduce((s, r) => s + (r.costUsd || 0), 0)
    const totalLatency = recs.reduce((s, r) => s + (r.latencyMs || 0), 0)
    out.push({
      provider,
      calls,
      successRate: calls === 0 ? 0 : Number((successes / calls).toFixed(3)),
      errorRate: calls === 0 ? 0 : Number(((calls - successes) / calls).toFixed(3)),
      avgLatencyMs: calls === 0 ? 0 : Math.round(totalLatency / calls),
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      costPerToken: totalTokens === 0 ? 0 : Number((totalCostUsd / totalTokens).toFixed(8)),
    })
  }
  // Most-used first.
  return out.sort((a, b) => b.calls - a.calls)
}

export function trendByDay(records: UsageRecord[], opts: { provider?: string } = {}): TrendPoint[] {
  const filtered = opts.provider ? records.filter((r) => r.provider === opts.provider) : records
  const byDay = new Map<string, UsageRecord[]>()
  for (const r of filtered) {
    const day = dayOf(r.createdAt)
    const bucket = byDay.get(day)
    if (bucket) bucket.push(r)
    else byDay.set(day, [r])
  }

  const points: TrendPoint[] = []
  for (const [day, recs] of byDay) {
    const calls = recs.length
    const successes = recs.filter((r) => isSuccess(r.status)).length
    points.push({
      day,
      calls,
      successRate: calls === 0 ? 0 : Number((successes / calls).toFixed(3)),
      avgLatencyMs: calls === 0 ? 0 : Math.round(recs.reduce((s, r) => s + (r.latencyMs || 0), 0) / calls),
      totalCostUsd: Number(recs.reduce((s, r) => s + (r.costUsd || 0), 0).toFixed(6)),
      totalTokens: recs.reduce((s, r) => s + (r.totalTokens || 0), 0),
    })
  }
  // Chronological.
  return points.sort((a, b) => a.day.localeCompare(b.day))
}
