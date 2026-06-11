/**
 * Freshness scoring — spec §Scoring algoritmy.
 *
 * freshness = 1.0 if last_validated < 1h
 *           | 0.8 if < 24h
 *           | 0.5 if < 7d
 *           | 0.2 if < 30d
 *           | 0.0 otherwise
 */

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const ONE_WEEK_MS = 7 * ONE_DAY_MS
const ONE_MONTH_MS = 30 * ONE_DAY_MS

export function computeFreshness(lastValidatedAt: string | undefined, now: Date = new Date()): number {
  if (!lastValidatedAt) return 0
  const ts = Date.parse(lastValidatedAt)
  if (Number.isNaN(ts)) return 0

  const ageMs = now.getTime() - ts
  if (ageMs < 0) return 1.0
  if (ageMs < ONE_HOUR_MS) return 1.0
  if (ageMs < ONE_DAY_MS) return 0.8
  if (ageMs < ONE_WEEK_MS) return 0.5
  if (ageMs < ONE_MONTH_MS) return 0.2
  return 0.0
}
