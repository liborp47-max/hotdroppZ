// ─── AI Usage Tracker ─────────────────────────────────────────────────────────
// Persists token/request counts to ai_usage_logs in Supabase.
// Reads aggregate stats for the AI Control Center dashboard.

import type { createAdminClient, createClient } from '@/lib/supabase/server'
import { isSchemaGapError } from '@/lib/pipeline/utils'

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export type UsageLogEntry = {
  step: string
  provider: string
  model?: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  requests?: number
  latency_ms?: number
  cost_usd?: number
  status?: 'success' | 'error' | 'timeout'
  error?: string
  run_id?: string
}

export type StepUsageSummary = {
  step: string
  provider: string
  total_requests: number
  total_tokens: number
  total_cost_usd: number
  avg_latency_ms: number
  error_count: number
  last_used: string | null
}

export type UsageStats = {
  summary: StepUsageSummary[]
  total_requests: number
  total_tokens: number
  total_cost_usd: number
  last_24h_requests: number
}

export async function logUsage(db: DbClient, entry: UsageLogEntry): Promise<void> {
  try {
    const { error } = await db.from('ai_usage_logs').insert({
      step:               entry.step,
      provider:           entry.provider,
      model:              entry.model ?? null,
      prompt_tokens:      entry.prompt_tokens ?? 0,
      completion_tokens:  entry.completion_tokens ?? 0,
      total_tokens:       entry.total_tokens ?? 0,
      requests:           entry.requests ?? 1,
      latency_ms:         entry.latency_ms ?? null,
      cost_usd:           entry.cost_usd ?? 0,
      status:             entry.status ?? 'success',
      error:              entry.error ?? null,
      run_id:             entry.run_id ?? null,
    })
    if (error && !isSchemaGapError(error)) {
      console.warn('AI USAGE: log insert failed', error.message)
    }
  } catch {
    // Non-fatal: never block pipeline for logging
  }
}

export async function getUsageStats(db: DbClient): Promise<UsageStats> {
  const empty: UsageStats = {
    summary: [],
    total_requests: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    last_24h_requests: 0,
  }

  try {
    const [allLogs, recentLogs] = await Promise.all([
      db
        .from('ai_usage_logs')
        .select('step, provider, requests, total_tokens, cost_usd, latency_ms, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      db
        .from('ai_usage_logs')
        .select('requests', { count: 'exact', head: false })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    if (!allLogs.data?.length) return empty

    const logs = allLogs.data as {
      step: string
      provider: string
      requests: number
      total_tokens: number
      cost_usd: number
      latency_ms: number | null
      status: string
      created_at: string
    }[]

    // Aggregate per step+provider
    const map = new Map<string, StepUsageSummary>()
    let totalRequests = 0
    let totalTokens   = 0
    let totalCost     = 0

    for (const log of logs) {
      const key = `${log.step}:${log.provider}`
      const existing = map.get(key)
      const req   = log.requests     ?? 0
      const tok   = log.total_tokens ?? 0
      const cost  = log.cost_usd     ?? 0
      const lat   = log.latency_ms   ?? 0

      totalRequests += req
      totalTokens   += tok
      totalCost     += cost

      if (!existing) {
        map.set(key, {
          step:            log.step,
          provider:        log.provider,
          total_requests:  req,
          total_tokens:    tok,
          total_cost_usd:  cost,
          avg_latency_ms:  lat,
          error_count:     log.status === 'error' ? 1 : 0,
          last_used:       log.created_at,
        })
      } else {
        const count = existing.total_requests + req
        existing.total_requests  += req
        existing.total_tokens    += tok
        existing.total_cost_usd  += cost
        existing.avg_latency_ms   = count > 0 ? (existing.avg_latency_ms * existing.total_requests + lat * req) / count : 0
        if (log.status === 'error') existing.error_count += 1
      }
    }

    const last24hReqs = (recentLogs.data ?? []).reduce(
      (sum: number, r: { requests: number }) => sum + (r.requests ?? 0), 0
    )

    return {
      summary: Array.from(map.values()).sort((a, b) =>
        a.step.localeCompare(b.step)
      ),
      total_requests:    totalRequests,
      total_tokens:      totalTokens,
      total_cost_usd:    totalCost,
      last_24h_requests: last24hReqs,
    }
  } catch {
    return empty
  }
}

export async function getSelectedProvider(
  db: DbClient,
  step: string
): Promise<string | null> {
  try {
    const { data } = await db
      .from('ai_settings')
      .select('value')
      .eq('key', `provider:${step}`)
      .maybeSingle()
    return data?.value ?? null
  } catch {
    return null
  }
}

export async function setSelectedProvider(
  db: DbClient,
  step: string,
  provider: string
): Promise<void> {
  try {
    await db.from('ai_settings').upsert(
      { key: `provider:${step}`, value: provider, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  } catch {
    // Non-fatal
  }
}
