// Shared filter utilities — used by both server pages and client components

export type DateRange = '24h' | '7d' | '30d' | 'all'

export function dateRangeToISO(range: DateRange | string): string | null {
  if (!range || range === 'all') return null
  const ms: Record<string, number> = {
    '24h':  24 * 60 * 60 * 1000,
    '7d':    7 * 24 * 60 * 60 * 1000,
    '30d':  30 * 24 * 60 * 60 * 1000,
  }
  return ms[range] ? new Date(Date.now() - ms[range]).toISOString() : null
}

// Map priority letter to attention_score threshold range
export const PRIORITY_SCORE_RANGES: Record<string, [number, number]> = {
  P0: [18, 99],
  P1: [12, 17],
  P2: [6,  11],
  P3: [0,   5],
}
