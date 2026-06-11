/**
 * AI usage budget alerts — pure core (UM-AI_CONTROL / SM3).
 *
 * Given a usage window (tokens + cost, with per-provider breakdown) and a budget
 * config, emits budget alerts when daily token/cost usage approaches or exceeds
 * the limit, and recommends a provider switch to cut spend.
 *
 * Deterministic, dependency-free (unit-testable). The API route feeds it real
 * `ai_usage_logs` aggregates.
 */

export type BudgetSeverity = 'info' | 'warning' | 'critical'

export interface ProviderSpend {
  provider: string
  tokens: number
  costUsd: number
  isFree: boolean
}

export interface UsageWindow {
  totalTokens: number
  totalCostUsd: number
  providers: ProviderSpend[]
}

export interface BudgetConfig {
  dailyTokenBudget?: number
  dailyCostBudgetUsd?: number
  /** Percent of budget at which to warn (default 80). */
  warnThresholdPct?: number
}

export interface BudgetAlert {
  kind: 'token_budget' | 'cost_budget'
  severity: BudgetSeverity
  usedPct: number
  used: number
  budget: number
  title: string
  detail: string
  recommendation: string
}

const DEFAULT_WARN_PCT = 80

/** Highest-spend PAID provider — the best switch candidate to cut cost. */
function topPaidSpender(providers: ProviderSpend[]): ProviderSpend | null {
  const paid = providers.filter((p) => !p.isFree && p.costUsd > 0)
  if (paid.length === 0) return null
  return paid.reduce((max, p) => (p.costUsd > max.costUsd ? p : max))
}

function switchRecommendation(window: UsageWindow): string {
  const top = topPaidSpender(window.providers)
  if (top) {
    return `Zvaž přepnutí "${top.provider}" (nejvyšší spend $${top.costUsd.toFixed(4)}) na free-tier providera (groq_fast / gemini_flash) pro high-volume kroky.`
  }
  return 'Sniž objem nebo zpřísni maxCost na "zero" v routeru pro neprioritní kroky.'
}

export function evaluateBudget(window: UsageWindow, config: BudgetConfig): BudgetAlert[] {
  const warnPct = config.warnThresholdPct ?? DEFAULT_WARN_PCT
  const alerts: BudgetAlert[] = []

  const check = (
    kind: BudgetAlert['kind'],
    used: number,
    budget: number | undefined,
    label: string,
    fmt: (n: number) => string,
  ) => {
    if (!budget || budget <= 0) return
    const usedPct = Number(((used / budget) * 100).toFixed(1))
    if (usedPct < warnPct) return
    const severity: BudgetSeverity = usedPct >= 100 ? 'critical' : 'warning'
    alerts.push({
      kind,
      severity,
      usedPct,
      used,
      budget,
      title: severity === 'critical' ? `${label} rozpočet překročen` : `${label} rozpočet se blíží limitu`,
      detail: `Využito ${fmt(used)} z ${fmt(budget)} denního ${label.toLowerCase()} rozpočtu (${usedPct} %).`,
      recommendation: switchRecommendation(window),
    })
  }

  check('token_budget', window.totalTokens, config.dailyTokenBudget, 'Token', (n) => `${Math.round(n).toLocaleString('cs-CZ')} tok`)
  check('cost_budget', window.totalCostUsd, config.dailyCostBudgetUsd, 'Cost', (n) => `$${n.toFixed(4)}`)

  return alerts
}
