// ─── AI Auto-Router ────────────────────────────────────────────────────────────
// Selects the best available AI provider for each pipeline step based on:
//   • quality / speed / cost scores  (static profiles)
//   • task weights                   (per-step priority)
//   • real reliability               (live error-rate from usage logs)
//   • free-first rule                (free wins if score gap < FREE_FIRST_MARGIN)
//   • boost mode                     (high-priority tasks can unlock paid)
// Then executes with automatic failover and persists every decision.

import type { AiStepKey } from '@/lib/ai/registry'
import { STEP_CONFIGS, detectProviderStatus } from '@/lib/ai/registry'
import { logUsage } from '@/lib/ai/usage'
import { providerForStepItem } from '@/lib/ai/ab-testing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoutePriority  = 'low' | 'normal' | 'high'
export type ContentSize    = 'small' | 'medium' | 'large'
export type MaxCost        = 'zero' | 'low' | 'any'

export type RouteRequest = {
  step:             AiStepKey
  priority?:        RoutePriority  // default: 'normal'
  maxCost?:         MaxCost        // default: 'low'
  contentSize?:     ContentSize    // influences timeout selection
  runId?:           string
  /** Item id — when set, an active A/B experiment may override the provider. */
  itemId?:          string
}

export type RouteDecision = {
  step:          AiStepKey
  provider:      string
  model?:        string
  score:         number
  reason:        string
  fallbackChain: string[]      // ordered providers to try if primary fails
  fromCache?:    boolean
  /** Set when an A/B experiment forced the provider for this item. */
  experimentProvider?: string
}

export type RouterExecutorFn<T> = (providerId: string, model?: string) => Promise<T>

// ─── Model profiles ───────────────────────────────────────────────────────────
// quality 0-10 (higher = better output)
// speed   0-10 (higher = faster response)
// cost    0-10 (higher = more expensive — used to penalise in scoring)

type ModelProfile = {
  quality:            number
  speed:              number
  cost:               number
  reliabilityDefault: number   // assumed success rate before real data
  isFree:             boolean
}

const MODEL_PROFILES: Record<string, ModelProfile> = {
  rules:          { quality: 5,  speed: 10, cost: 0,  reliabilityDefault: 1.00, isFree: true  },
  jaccard:        { quality: 5,  speed: 10, cost: 0,  reliabilityDefault: 1.00, isFree: true  },
  groq:           { quality: 8,  speed: 9,  cost: 1,  reliabilityDefault: 0.95, isFree: true  },
  groq_fast:      { quality: 7,  speed: 10, cost: 0,  reliabilityDefault: 0.95, isFree: true  },
  ollama_mistral: { quality: 6,  speed: 5,  cost: 0,  reliabilityDefault: 0.80, isFree: true  },
  ollama_llama3:  { quality: 7,  speed: 4,  cost: 0,  reliabilityDefault: 0.80, isFree: true  },
  libretranslate: { quality: 7,  speed: 8,  cost: 0,  reliabilityDefault: 0.85, isFree: true  },
  deepl_free:     { quality: 9,  speed: 8,  cost: 2,  reliabilityDefault: 0.90, isFree: true  },
  gemini_flash:   { quality: 8,  speed: 9,  cost: 1,  reliabilityDefault: 0.95, isFree: true  },
  deepseek:       { quality: 1,  speed: 1,  cost: 10, reliabilityDefault: 0.00, isFree: false },
  openai_mini:    { quality: 9,  speed: 8,  cost: 4,  reliabilityDefault: 0.98, isFree: false },
  openai_full:    { quality: 10, speed: 7,  cost: 8,  reliabilityDefault: 0.98, isFree: false },
  claude_haiku:   { quality: 9,  speed: 8,  cost: 3,  reliabilityDefault: 0.98, isFree: false },
  claude_sonnet:  { quality: 10, speed: 7,  cost: 5,  reliabilityDefault: 0.99, isFree: false },
}

// ─── Task weights [quality, speed, cost] ─────────────────────────────────────
// These encode how much each dimension matters per pipeline step.

const TASK_WEIGHTS: Record<AiStepKey, [number, number, number]> = {
  filter:       [0.2, 0.6, 0.2],
  translation:  [0.5, 0.3, 0.2],
  curator:      [0.4, 0.4, 0.2],
  cluster:      [0.3, 0.5, 0.2],
  writer:       [0.7, 0.2, 0.1],
  final_editor: [0.6, 0.3, 0.1],
  enrichment:   [0.2, 0.6, 0.2],
  feed:         [0.2, 0.6, 0.2],
  multilang:    [0.5, 0.4, 0.1],
  monetizer:    [0.4, 0.4, 0.2],
}

// If a free provider's score is within this fraction of a paid provider's score,
// choose the free one regardless.
const FREE_FIRST_MARGIN = 0.05

// ─── In-process reliability tracker ──────────────────────────────────────────
// Updated after every routed call.
// Seeded from ai_settings on first call to loadReliability(), persisted after each outcome.

type ReliabilityEntry = { successes: number; failures: number }
const _reliability = new Map<string, ReliabilityEntry>()

function getReliability(providerId: string, defaultRate: number): number {
  const entry = _reliability.get(providerId)
  if (!entry || entry.successes + entry.failures < 1) return defaultRate
  const total = entry.successes + entry.failures
  return entry.successes / total
}

function recordOutcome(providerId: string, success: boolean): void {
  const entry = _reliability.get(providerId) ?? { successes: 0, failures: 0 }
  if (success) entry.successes++
  else          entry.failures++
  _reliability.set(providerId, entry)
}

type DbClient = Parameters<typeof logUsage>[0]

export async function loadReliability(db: DbClient): Promise<void> {
  try {
    const { data } = await db
      .from('ai_settings')
      .select('key, value')
      .like('key', 'reliability:%')
    if (!data) return
    for (const row of data as { key: string; value: string }[]) {
      const providerId = row.key.replace('reliability:', '')
      try {
        const parsed = JSON.parse(row.value) as { successes?: number; failures?: number }
        if (typeof parsed.successes === 'number' && typeof parsed.failures === 'number') {
          _reliability.set(providerId, { successes: parsed.successes, failures: parsed.failures })
        }
      } catch { /* ignore malformed */ }
    }
  } catch (err) {
    console.warn('AI ROUTER: failed to load reliability from db', err)
  }
}

async function saveReliability(db: DbClient, providerId: string): Promise<void> {
  const entry = _reliability.get(providerId)
  if (!entry) return
  try {
    await db
      .from('ai_settings')
      .upsert(
        { key: `reliability:${providerId}`, value: JSON.stringify(entry), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
  } catch {
    // Non-fatal
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScore(
  providerId: string,
  step: AiStepKey,
  reliability: number,
  priority: RoutePriority
): number {
  const profile = MODEL_PROFILES[providerId]
  if (!profile) return 0

  const [qw, sw, cw] = TASK_WEIGHTS[step]

  // Boost quality weight for high-priority tasks
  const qualityMultiplier = priority === 'high' ? 1.3 : priority === 'low' ? 0.8 : 1.0
  const base = (qw * qualityMultiplier * profile.quality) + (sw * profile.speed) - (cw * profile.cost)

  return base * reliability
}

// ─── Main routing logic ───────────────────────────────────────────────────────

type RouteCandidate = {
  providerId: string
  model?:     string
  score:      number
  isFree:     boolean
}

export function route(request: RouteRequest): RouteDecision {
  const {
    step,
    priority    = 'normal',
    maxCost     = 'low',
    runId,
  } = request

  const stepConfig = STEP_CONFIGS.find((s) => s.step === step)
  if (!stepConfig) {
    return {
      step,
      provider:      'rules',
      score:         0,
      reason:        `Unknown step "${step}" — falling back to rules`,
      fallbackChain: ['rules'],
    }
  }

  // Filter to available, configured providers
  const available: RouteCandidate[] = stepConfig.providers
    .filter((p) => {
      const status = detectProviderStatus(p)
      if (status !== 'active') return false
      // Cost gate: if maxCost = 'zero', only allow isFree providers
      //            if maxCost = 'low',  block cloud-paid unless priority=high
      const profile = MODEL_PROFILES[p.id]
      if (!profile) return true
      if (maxCost === 'zero' && !profile.isFree) return false
      if (maxCost === 'low' && !profile.isFree && priority !== 'high') return false
      return true
    })
    .map((p) => {
      const profile = MODEL_PROFILES[p.id]
      const reliability = profile
        ? getReliability(p.id, profile.reliabilityDefault)
        : 0.5
      return {
        providerId: p.id,
        model:      p.model,
        score:      computeScore(p.id, step, reliability, priority),
        isFree:     profile?.isFree ?? true,
      }
    })
    .sort((a, b) => b.score - a.score)

  if (available.length === 0) {
    // Last resort: the step's configured fallback (rules / jaccard) — always available
    const fallbackId = stepConfig.fallback
    return {
      step,
      provider:      fallbackId,
      score:         0,
      reason:        'No configured providers available — using hardcoded fallback',
      fallbackChain: [fallbackId],
    }
  }

  let chosen = available[0]
  let reason  = `Best score ${chosen.score.toFixed(2)} for ${step} (priority: ${priority})`

  // FREE FIRST RULE: if the top candidate is paid and a free one is close enough, switch
  if (!chosen.isFree) {
    const bestFree = available.find((c) => c.isFree)
    if (bestFree && (chosen.score - bestFree.score) / chosen.score < FREE_FIRST_MARGIN) {
      chosen = bestFree
      reason = `Free-first: ${bestFree.providerId} within ${(FREE_FIRST_MARGIN * 100).toFixed(0)}% of paid — using free`
    }
  }

  // BOOST MODE: if priority=high, allow paid even when maxCost=low (already gated above)
  if (priority === 'high' && chosen.score < 5 && !runId) {
    reason += ' [BOOST: high-priority]'
  }

  // A/B EXPERIMENT OVERRIDE (UM-AI_CONTROL SM2): if this item is assigned to an
  // experiment arm AND that provider is available, it wins for this item. The
  // best-scored provider stays first in the fallback chain for safety.
  let experimentProvider: string | undefined
  if (request.itemId) {
    const abProvider = providerForStepItem(step, request.itemId)
    const abCandidate = abProvider ? available.find((c) => c.providerId === abProvider) : undefined
    if (abCandidate && abCandidate.providerId !== chosen.providerId) {
      experimentProvider = abCandidate.providerId
      chosen = abCandidate
      reason = `A/B experiment: položka přiřazena do "${abCandidate.providerId}" (arm assignment)`
    } else if (abCandidate) {
      experimentProvider = abCandidate.providerId
    }
  }

  const fallbackChain = [
    chosen.providerId,
    ...available
      .filter((c) => c.providerId !== chosen.providerId)
      .map((c) => c.providerId),
    stepConfig.fallback,
  ].filter((v, i, arr) => arr.indexOf(v) === i)  // deduplicate

  return {
    step,
    provider:      chosen.providerId,
    model:         chosen.model,
    score:         chosen.score,
    reason,
    fallbackChain,
    experimentProvider,
  }
}

// ─── Executor with failover ───────────────────────────────────────────────────
// Tries providers in fallbackChain order.
// Logs each attempt to ai_usage_logs via logUsage (non-fatal).

export type FailoverResult<T> = {
  result:   T
  provider: string
  model?:   string
  attempts: number
  latency_ms: number
}

export async function executeWithFailover<T>(
  decision:    RouteDecision,
  executor:    RouterExecutorFn<T>,
  fallback:    () => T,
  db?:         DbClient,
): Promise<FailoverResult<T>> {
  const chain = decision.fallbackChain

  for (let i = 0; i < chain.length; i++) {
    const providerId = chain[i]
    const stepConfig = STEP_CONFIGS.find((s) => s.step === decision.step)
    const providerDef = stepConfig?.providers.find((p) => p.id === providerId)

    const start = Date.now()
    try {
      const result   = await executor(providerId, providerDef?.model)
      const latency  = Date.now() - start
      recordOutcome(providerId, true)

      if (db) {
        void saveReliability(db, providerId)
        void logUsage(db, {
          step:       decision.step,
          provider:   providerId,
          model:      providerDef?.model,
          latency_ms: latency,
          status:     'success',
          requests:   1,
        })
      }

      return { result, provider: providerId, model: providerDef?.model, attempts: i + 1, latency_ms: latency }
    } catch (err) {
      const latency = Date.now() - start
      recordOutcome(providerId, false)

      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`AI CALL: ${decision.step}/${providerId} failed: ${errMsg}`)

      // Quota/billing 429 = permanent failure for this key — tank reliability immediately
      // so routing skips this provider for the rest of the session and after reload
      const isQuotaExhausted =
        errMsg.includes('quota') || errMsg.includes('billing') || errMsg.includes('Billing')
      if (isQuotaExhausted) {
        _reliability.set(providerId, { successes: 0, failures: 20 })
      }

      if (db) {
        void saveReliability(db, providerId)
        void logUsage(db, {
          step:       decision.step,
          provider:   providerId,
          model:      providerDef?.model,
          latency_ms: latency,
          status:     'error',
          error:      errMsg,
          requests:   1,
        })
      }

      // If there's another provider in the chain, continue
      if (i < chain.length - 1) continue
    }
  }

  // All providers exhausted — use the sync fallback
  console.error(`AI ROUTER: all providers failed for ${decision.step} — using fallback`)
  return {
    result:    fallback(),
    provider:  'fallback',
    attempts:  chain.length,
    latency_ms: 0,
  }
}

// ─── Reliability export (for status dashboard) ────────────────────────────────

export function getReliabilitySnapshot(): Record<string, { successes: number; failures: number; rate: number }> {
  const out: Record<string, { successes: number; failures: number; rate: number }> = {}
  for (const [id, entry] of _reliability.entries()) {
    const total = entry.successes + entry.failures
    out[id] = { ...entry, rate: total > 0 ? entry.successes / total : 1 }
  }
  return out
}

// ─── Scorer export (for status dashboard) ────────────────────────────────────

export function getScoresForStep(step: AiStepKey, priority: RoutePriority = 'normal') {
  const stepConfig = STEP_CONFIGS.find((s) => s.step === step)
  if (!stepConfig) return []

  return stepConfig.providers.map((p) => {
    const profile     = MODEL_PROFILES[p.id]
    const reliability = profile ? getReliability(p.id, profile.reliabilityDefault) : 0
    const score       = computeScore(p.id, step, reliability, priority)
    const status      = detectProviderStatus(p)
    return {
      providerId:  p.id,
      displayName: p.displayName,
      status,
      score:       parseFloat(score.toFixed(3)),
      reliability: parseFloat(reliability.toFixed(3)),
      isFree:      profile?.isFree ?? true,
      profile:     profile ?? null,
    }
  }).sort((a, b) => b.score - a.score)
}
