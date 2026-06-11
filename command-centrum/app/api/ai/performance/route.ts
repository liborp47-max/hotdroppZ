import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { STEP_CONFIGS } from '@/lib/ai/registry'
import {
  summarizeProviders,
  trendByDay,
  type UsageRecord,
} from '@/lib/ai/provider-performance'
import {
  evaluateBudget,
  type BudgetConfig,
  type ProviderSpend,
  type UsageWindow,
} from '@/lib/ai/usage-budget'

// Provider id -> isFree, derived from the registry catalogue (cost !== 'paid').
function buildIsFreeMap(): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const cfg of STEP_CONFIGS) {
    for (const p of cfg.providers) map[p.id] = p.cost !== 'paid'
  }
  return map
}

interface UsageLogRow {
  provider: string
  total_tokens: number | null
  cost_usd: number | null
  latency_ms: number | null
  status: string | null
  created_at: string
}

/**
 * GET /api/ai/performance
 * Provider performance dashboard (SM5) + token/cost budget alerts (SM3).
 * Single ai_usage_logs read; degrades to empty payload when the table/DB is absent.
 */
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const isFree = buildIsFreeMap()

  let rows: UsageLogRow[] = []
  const budgetConfig: BudgetConfig = {}
  let degraded = false

  try {
    const [logs, settings] = await Promise.all([
      db
        .from('ai_usage_logs')
        .select('provider, total_tokens, cost_usd, latency_ms, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5000),
      db.from('ai_settings').select('key, value').like('key', 'budget:%'),
    ])
    rows = (logs.data as UsageLogRow[] | null) ?? []
    if (logs.error) degraded = true

    for (const s of (settings.data as { key: string; value: string }[] | null) ?? []) {
      if (s.key === 'budget:dailyTokens') budgetConfig.dailyTokenBudget = Number(s.value) || undefined
      if (s.key === 'budget:dailyCostUsd') budgetConfig.dailyCostBudgetUsd = Number(s.value) || undefined
      if (s.key === 'budget:warnPct') budgetConfig.warnThresholdPct = Number(s.value) || undefined
    }
  } catch {
    degraded = true
  }

  // ── SM5: provider performance + trend ──────────────────────────────────────
  const records: UsageRecord[] = rows.map((r) => ({
    provider: r.provider,
    createdAt: r.created_at,
    latencyMs: r.latency_ms ?? 0,
    totalTokens: r.total_tokens ?? 0,
    costUsd: r.cost_usd ?? 0,
    status: r.status ?? 'success',
  }))
  const performance = summarizeProviders(records)
  const trend = trendByDay(records)

  // ── SM3: today's budget window + alerts ────────────────────────────────────
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const today = records.filter((r) => Date.parse(r.createdAt) >= startOfDay.getTime())
  const spendByProvider = new Map<string, ProviderSpend>()
  for (const r of today) {
    const cur = spendByProvider.get(r.provider) ?? {
      provider: r.provider,
      tokens: 0,
      costUsd: 0,
      isFree: isFree[r.provider] ?? true,
    }
    cur.tokens += r.totalTokens
    cur.costUsd += r.costUsd
    spendByProvider.set(r.provider, cur)
  }
  const window: UsageWindow = {
    totalTokens: today.reduce((s, r) => s + r.totalTokens, 0),
    totalCostUsd: today.reduce((s, r) => s + r.costUsd, 0),
    providers: [...spendByProvider.values()],
  }
  const budgetAlerts = evaluateBudget(window, budgetConfig)

  return NextResponse.json({
    performance,
    trend,
    budget: { config: budgetConfig, window, alerts: budgetAlerts },
    degraded,
    timestamp: new Date().toISOString(),
  })
}
