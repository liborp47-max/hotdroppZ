// ── Pipeline Insights — funnel, model perf, anomaly detection ────────────────
// UM-ANALYTICS_UI (SM-1 + SM-2 + SM-4) — server-side aggregations over
// pipeline_stage_runs and ai_usage_logs. Read-only, no schema changes.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

// Active pipeline stages, in funnel order (matches stage-registry.ts).
const FUNNEL_STAGES = ['scout', 'filter', 'curator', 'cluster', 'enrichment', 'writer', 'feed'] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export interface FunnelStep {
  stage: FunnelStage
  processed: number
  kept: number
  discarded: number
  dropOffPct: number  // (processed - kept) / processed * 100, 0 if processed=0
  runs: number
  errorRate: number   // errors / runs * 100
}

export interface FunnelReport {
  windowDays: number
  steps: FunnelStep[]
  totalProcessed: number
  totalKept: number
  overallYieldPct: number  // totalKept / totalProcessed of first stage * 100
}

/** Compute drop-off funnel over the last N days. */
export async function getFunnel(db: SupabaseClient, days: number = 7): Promise<FunnelReport> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: rows } = await db
    .from('pipeline_stage_runs')
    .select('stage, status, processed, kept, discarded')
    .gte('started_at', since)

  type Acc = { processed: number; kept: number; discarded: number; runs: number; errors: number }
  const empty: Acc = { processed: 0, kept: 0, discarded: 0, runs: 0, errors: 0 }
  const acc = new Map<FunnelStage, Acc>(FUNNEL_STAGES.map((s) => [s, { ...empty }]))

  for (const r of rows ?? []) {
    if (!FUNNEL_STAGES.includes(r.stage as FunnelStage)) continue
    const cur = acc.get(r.stage as FunnelStage)!
    cur.processed += Number(r.processed ?? 0)
    cur.kept += Number(r.kept ?? 0)
    cur.discarded += Number(r.discarded ?? 0)
    cur.runs += 1
    if (r.status === 'error') cur.errors += 1
  }

  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage) => {
    const a = acc.get(stage)!
    const dropOffPct = a.processed > 0 ? Number((((a.processed - a.kept) / a.processed) * 100).toFixed(1)) : 0
    const errorRate = a.runs > 0 ? Number(((a.errors / a.runs) * 100).toFixed(1)) : 0
    return { stage, processed: a.processed, kept: a.kept, discarded: a.discarded, dropOffPct, runs: a.runs, errorRate }
  })

  const totalProcessed = steps.reduce((n, s) => n + s.processed, 0)
  const totalKept = steps[steps.length - 1]?.kept ?? 0
  const firstProcessed = steps[0]?.processed ?? 0
  const overallYieldPct = firstProcessed > 0 ? Number(((totalKept / firstProcessed) * 100).toFixed(1)) : 0

  return { windowDays: days, steps, totalProcessed, totalKept, overallYieldPct }
}

// ── Model performance: Groq vs Claude vs others ──────────────────────────────

export interface ProviderStats {
  provider: string  // groq | anthropic | ollama_mistral | rules | jaccard
  requests: number
  totalTokens: number
  totalCostUsd: number
  avgLatencyMs: number
  successRate: number  // success / total * 100
  costPerThousandTokens: number
}

export interface ModelPerfReport {
  windowDays: number
  providers: ProviderStats[]
  byStep: Record<string, ProviderStats[]>  // step -> providers used in that step
}

/** Groq vs Claude vs others — aggregates ai_usage_logs. */
export async function getModelPerf(db: SupabaseClient, days: number = 7): Promise<ModelPerfReport> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: rows } = await db
    .from('ai_usage_logs')
    .select('step, provider, total_tokens, cost_usd, latency_ms, status, requests')
    .gte('created_at', since)

  type Acc = { requests: number; tokens: number; cost: number; latencySum: number; latencyN: number; success: number; total: number }
  const empty = (): Acc => ({ requests: 0, tokens: 0, cost: 0, latencySum: 0, latencyN: 0, success: 0, total: 0 })

  const overall = new Map<string, Acc>()
  const perStep = new Map<string, Map<string, Acc>>()

  for (const r of rows ?? []) {
    const provider = r.provider ?? 'unknown'
    const step = r.step ?? 'unknown'

    const o = overall.get(provider) ?? empty()
    o.requests += Number(r.requests ?? 1)
    o.tokens += Number(r.total_tokens ?? 0)
    o.cost += Number(r.cost_usd ?? 0)
    if (typeof r.latency_ms === 'number') {
      o.latencySum += r.latency_ms
      o.latencyN += 1
    }
    o.total += 1
    if (r.status === 'success') o.success += 1
    overall.set(provider, o)

    if (!perStep.has(step)) perStep.set(step, new Map())
    const sm = perStep.get(step)!
    const s = sm.get(provider) ?? empty()
    s.requests += Number(r.requests ?? 1)
    s.tokens += Number(r.total_tokens ?? 0)
    s.cost += Number(r.cost_usd ?? 0)
    if (typeof r.latency_ms === 'number') {
      s.latencySum += r.latency_ms
      s.latencyN += 1
    }
    s.total += 1
    if (r.status === 'success') s.success += 1
    sm.set(provider, s)
  }

  const toStats = (provider: string, a: Acc): ProviderStats => ({
    provider,
    requests: a.requests,
    totalTokens: a.tokens,
    totalCostUsd: Number(a.cost.toFixed(4)),
    avgLatencyMs: a.latencyN > 0 ? Math.round(a.latencySum / a.latencyN) : 0,
    successRate: a.total > 0 ? Number(((a.success / a.total) * 100).toFixed(1)) : 0,
    costPerThousandTokens: a.tokens > 0 ? Number(((a.cost / a.tokens) * 1000).toFixed(4)) : 0,
  })

  const providers = Array.from(overall.entries())
    .map(([p, a]) => toStats(p, a))
    .sort((a, b) => b.requests - a.requests)

  const byStep: Record<string, ProviderStats[]> = {}
  for (const [step, sm] of perStep.entries()) {
    byStep[step] = Array.from(sm.entries())
      .map(([p, a]) => toStats(p, a))
      .sort((a, b) => b.requests - a.requests)
  }

  return { windowDays: days, providers, byStep }
}

// ── Anomaly detection ────────────────────────────────────────────────────────

export type AnomalySeverity = 'info' | 'warn' | 'critical'

export interface Anomaly {
  id: string
  severity: AnomalySeverity
  category: 'traffic' | 'cost' | 'errors' | 'latency'
  stage?: string
  provider?: string
  title: string
  detail: string
  observed: number
  baseline: number
  changePct: number
  suggestion: string
}

const THRESHOLDS = {
  trafficDropPct: 30,
  errorRateSpikePct: 15,
  costSpikePct: 100,
  latencySpikePct: 100,
}

/**
 * Compare last 24h vs previous 7-day baseline. Returns ranked anomalies.
 * Deterministic — same input data yields same output (no time-of-day jitter).
 */
export async function getAnomalies(db: SupabaseClient): Promise<Anomaly[]> {
  const now = Date.now()
  const last24h = new Date(now - 86_400_000).toISOString()
  const prev7d = new Date(now - 8 * 86_400_000).toISOString()
  const prev24h = new Date(now - 86_400_000).toISOString()

  const { data: recent } = await db
    .from('pipeline_stage_runs')
    .select('stage, status, processed, cost_usd, duration_ms')
    .gte('started_at', last24h)

  const { data: baseline } = await db
    .from('pipeline_stage_runs')
    .select('stage, status, processed, cost_usd, duration_ms')
    .gte('started_at', prev7d)
    .lt('started_at', prev24h)

  type Agg = { runs: number; errors: number; processed: number; cost: number; durationSum: number; durationN: number }
  const empty = (): Agg => ({ runs: 0, errors: 0, processed: 0, cost: 0, durationSum: 0, durationN: 0 })

  function bucket(rows: typeof recent): Map<string, Agg> {
    const m = new Map<string, Agg>()
    for (const r of rows ?? []) {
      const stage = (r as { stage?: string }).stage ?? 'unknown'
      const a = m.get(stage) ?? empty()
      a.runs += 1
      if (r.status === 'error') a.errors += 1
      a.processed += Number(r.processed ?? 0)
      a.cost += Number(r.cost_usd ?? 0)
      if (typeof r.duration_ms === 'number') {
        a.durationSum += r.duration_ms
        a.durationN += 1
      }
      m.set(stage, a)
    }
    return m
  }

  const recentByStage = bucket(recent)
  const baselineByStage = bucket(baseline)

  const out: Anomaly[] = []
  const stages = new Set([...recentByStage.keys(), ...baselineByStage.keys()])

  for (const stage of stages) {
    const r = recentByStage.get(stage) ?? empty()
    const b = baselineByStage.get(stage) ?? empty()
    const bPerDay = (n: number) => n / 7

    // Traffic drop
    const baselineThroughput = bPerDay(b.processed)
    if (baselineThroughput > 10 && r.processed < baselineThroughput) {
      const dropPct = Number((((baselineThroughput - r.processed) / baselineThroughput) * 100).toFixed(1))
      if (dropPct >= THRESHOLDS.trafficDropPct) {
        out.push({
          id: `traffic-${stage}`,
          severity: dropPct > 60 ? 'critical' : 'warn',
          category: 'traffic',
          stage,
          title: `${stage}: traffic drop ${dropPct}%`,
          detail: `Processed ${r.processed} items in last 24h vs baseline ${baselineThroughput.toFixed(0)}/day.`,
          observed: r.processed,
          baseline: Number(baselineThroughput.toFixed(0)),
          changePct: -dropPct,
          suggestion: 'Check upstream source health and pipeline cron schedule.',
        })
      }
    }

    // Error rate spike
    const rErr = r.runs > 0 ? (r.errors / r.runs) * 100 : 0
    const bErr = b.runs > 0 ? (b.errors / b.runs) * 100 : 0
    if (r.runs >= 3 && rErr - bErr >= THRESHOLDS.errorRateSpikePct) {
      out.push({
        id: `errors-${stage}`,
        severity: rErr > 50 ? 'critical' : 'warn',
        category: 'errors',
        stage,
        title: `${stage}: error rate spike ${rErr.toFixed(0)}%`,
        detail: `Error rate ${rErr.toFixed(0)}% (last 24h) vs ${bErr.toFixed(0)}% (7-day baseline).`,
        observed: Number(rErr.toFixed(1)),
        baseline: Number(bErr.toFixed(1)),
        changePct: Number((rErr - bErr).toFixed(1)),
        suggestion: 'Inspect recent stage logs and external API status.',
      })
    }

    // Cost spike
    const bCostPerDay = bPerDay(b.cost)
    if (bCostPerDay > 0.01 && r.cost > bCostPerDay) {
      const spikePct = Number((((r.cost - bCostPerDay) / bCostPerDay) * 100).toFixed(1))
      if (spikePct >= THRESHOLDS.costSpikePct) {
        out.push({
          id: `cost-${stage}`,
          severity: spikePct > 300 ? 'critical' : 'warn',
          category: 'cost',
          stage,
          title: `${stage}: cost spike +${spikePct}%`,
          detail: `Spent $${r.cost.toFixed(4)} in last 24h vs baseline $${bCostPerDay.toFixed(4)}/day.`,
          observed: Number(r.cost.toFixed(4)),
          baseline: Number(bCostPerDay.toFixed(4)),
          changePct: spikePct,
          suggestion: 'Verify model selection and retry logic; cap maxTokens if degraded.',
        })
      }
    }

    // Latency spike
    const rLat = r.durationN > 0 ? r.durationSum / r.durationN : 0
    const bLat = b.durationN > 0 ? b.durationSum / b.durationN : 0
    if (bLat > 100 && rLat > bLat) {
      const spikePct = Number((((rLat - bLat) / bLat) * 100).toFixed(1))
      if (spikePct >= THRESHOLDS.latencySpikePct) {
        out.push({
          id: `latency-${stage}`,
          severity: spikePct > 300 ? 'critical' : 'info',
          category: 'latency',
          stage,
          title: `${stage}: latency +${spikePct}%`,
          detail: `Avg ${Math.round(rLat)}ms (last 24h) vs ${Math.round(bLat)}ms (7-day baseline).`,
          observed: Math.round(rLat),
          baseline: Math.round(bLat),
          changePct: spikePct,
          suggestion: 'Check provider status page; consider switching to faster fallback.',
        })
      }
    }
  }

  // Rank: critical > warn > info, then by absolute changePct
  const rank: Record<AnomalySeverity, number> = { critical: 0, warn: 1, info: 2 }
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || Math.abs(b.changePct) - Math.abs(a.changePct))
  return out
}
