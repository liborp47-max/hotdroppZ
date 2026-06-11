/**
 * Provider auto-recommendation — pure core (UM-AI_CONTROL / SM1).
 *
 * Dependency-free decision logic so it is unit-testable under
 * `node --experimental-strip-types` (no `@/` value imports, no router/supabase).
 * The integration layer (recommend.ts) feeds it ranked scores from the live
 * router scorer.
 */
import type { AiStepKey } from './registry'

export interface RankedProvider {
  providerId: string
  displayName: string
  status: string
  score: number
  isFree: boolean
  available: boolean
}

export interface StepRecommendation {
  step: AiStepKey
  label: string
  current: string
  recommended: string
  changeSuggested: boolean
  currentScore: number | null
  recommendedScore: number
  delta: number
  reason: string
  ranked: RankedProvider[]
}

/**
 * Pick the recommended provider for a step from its ranked scores.
 * `ranked` is expected sorted by score desc (as getScoresForStep returns).
 * Recommends the best AVAILABLE provider; falls back to `fallback` when none.
 */
export function pickRecommendation(
  step: AiStepKey,
  label: string,
  current: string,
  fallback: string,
  ranked: RankedProvider[],
): StepRecommendation {
  const available = ranked.filter((r) => r.available)
  const top = available[0] ?? null
  const recommended = top?.providerId ?? fallback
  const recommendedScore = top?.score ?? 0

  const currentEntry = ranked.find((r) => r.providerId === current) ?? null
  const currentScore = currentEntry ? currentEntry.score : null
  const currentAvailable = currentEntry?.available ?? false
  const changeSuggested = recommended !== current
  const delta = Number((recommendedScore - (currentScore ?? 0)).toFixed(3))

  let reason: string
  if (!currentAvailable) {
    reason = `Aktuální provider "${current}" není dostupný — doporučen "${recommended}" (score ${recommendedScore}).`
  } else if (!changeSuggested) {
    reason = `Aktuální provider "${current}" je již optimální (score ${recommendedScore}).`
  } else {
    reason =
      `Doporučen "${recommended}" (score ${recommendedScore}) místo "${current}" ` +
      `(score ${currentScore ?? 0}); +${delta} dle cost/latency/quality vah kroku "${step}".`
  }

  return { step, label, current, recommended, changeSuggested, currentScore, recommendedScore, delta, reason, ranked }
}
