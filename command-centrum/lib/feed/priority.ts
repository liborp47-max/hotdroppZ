/**
 * Feed priority contract — single source of truth.
 *
 * UM-FEED_SCHEMA_AND_EDITOR_DONE sub-02. DB column `feed_posts.priority` is
 * TEXT 'P0'..'P3' (defined in schema-feed-posts-extension.sql). HDUA
 * (frontend-web) reads it as text. Until this sub-mission, CC TypeScript was
 * declaring `priority: number | null` and routes defaulted numeric values
 * (50, 100-i*5), which silently bypassed the DB check constraint and broke
 * the editorial sort.
 *
 * Semantics (matches CLAUDE.md "Content Categories" section):
 *   droppz_news               -> P0 (highest)
 *   rap_core, deep_scout      -> P1
 *   drama, fashion            -> P2
 *   culture, global_news,
 *   science, everything else  -> P3 (lowest)
 *
 * Sort: ascending — P0 first.
 */

export type FeedPriority = 'P0' | 'P1' | 'P2' | 'P3'

export const FEED_PRIORITY_VALUES: readonly FeedPriority[] = ['P0', 'P1', 'P2', 'P3']

export const DEFAULT_FEED_PRIORITY: FeedPriority = 'P2'

export function isFeedPriority(value: unknown): value is FeedPriority {
  return typeof value === 'string' && (FEED_PRIORITY_VALUES as readonly string[]).includes(value)
}

/**
 * Normalize any incoming value to a canonical FeedPriority. Accepts:
 *   - Existing 'P0'..'P3' strings (case-insensitive)
 *   - Numeric values (legacy JSON-fallback): 90+ -> P0, 70+ -> P1, 50+ -> P2, else P3
 *   - Anything else -> DEFAULT_FEED_PRIORITY
 */
export function normalizeFeedPriority(value: unknown): FeedPriority {
  if (typeof value === 'string') {
    const upper = value.toUpperCase()
    if (isFeedPriority(upper)) return upper
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 90) return 'P0'
    if (value >= 70) return 'P1'
    if (value >= 50) return 'P2'
    return 'P3'
  }
  return DEFAULT_FEED_PRIORITY
}

/**
 * Map a content category to its canonical priority. Mirrors the SQL backfill
 * in schema-feed-posts-extension.sql lines 60-72.
 */
export function priorityFromCategory(category: string | null | undefined): FeedPriority {
  switch (category) {
    case 'droppz':
    case 'droppz_news':
      return 'P0'
    case 'usa_rap':
    case 'uk_rap':
    case 'eu_rap':
    case 'ru_rap':
    case 'balkan_rap':
    case 'rap_core':
    case 'deep_scout':
      return 'P1'
    case 'rnb':
    case 'fun':
    case 'fashion':
    case 'drama':
    case 'news':
      return 'P2'
    default:
      return 'P3'
  }
}

/**
 * Comparator for sort()/order() — lower rank first (P0 = highest priority).
 * Returns negative if a is more important than b.
 */
export function comparePriority(a: FeedPriority | null | undefined, b: FeedPriority | null | undefined): number {
  const rank = (p: FeedPriority | null | undefined) => (p ? FEED_PRIORITY_VALUES.indexOf(p) : 99)
  return rank(a) - rank(b)
}
