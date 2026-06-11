/**
 * Authority scoring — spec §Scoring algoritmy.
 *
 * authority = baseScore
 *           + (verified_handles * 5)
 *           + (recent_validation * 10)
 *           - (error_rate_30d * 50)
 *           - stale_penalty
 *
 * Clamped to [0, 100].
 */

import type { ScoringContext } from '../types.ts'

const RECENT_VALIDATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const STALE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const STALE_PENALTY = 20
const RECENT_VALIDATION_BONUS = 10
const PER_HANDLE_BONUS = 5
const ERROR_RATE_WEIGHT = 50

export function computeAuthority(ctx: ScoringContext, now: Date = new Date()): number {
  const base = clamp(ctx.authorityBase ?? 0, 0, 100)
  const handlesBonus = Math.max(0, ctx.verifiedHandlesCount) * PER_HANDLE_BONUS
  const recentBonus = ctx.recentlyValidated ? RECENT_VALIDATION_BONUS : 0
  const errorPenalty = clamp(ctx.errorRate30d, 0, 1) * ERROR_RATE_WEIGHT
  const stalePenalty = isStale(ctx.lastValidatedAt, now) ? STALE_PENALTY : 0

  const score = base + handlesBonus + recentBonus - errorPenalty - stalePenalty
  return clamp(Math.round(score), 0, 100)
}

export function isRecentlyValidated(lastValidatedAt: string | undefined, now: Date): boolean {
  if (!lastValidatedAt) return false
  const ts = Date.parse(lastValidatedAt)
  if (Number.isNaN(ts)) return false
  return now.getTime() - ts < RECENT_VALIDATION_WINDOW_MS
}

function isStale(lastValidatedAt: string | undefined, now: Date): boolean {
  if (!lastValidatedAt) return true
  const ts = Date.parse(lastValidatedAt)
  if (Number.isNaN(ts)) return true
  return now.getTime() - ts > STALE_WINDOW_MS
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}
