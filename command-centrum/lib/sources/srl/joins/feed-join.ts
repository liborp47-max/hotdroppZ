/**
 * feed-join — assembles ResolvedSource[] of type='feed' for active RSS feeds.
 *
 * This is the one join that has REAL DATA today via legacy scout_sources
 * (which holds the RSS registry). Spec hard rule: existing code reading
 * scout_sources must keep working, so this join uses scout_sources as
 * primary source of truth and maps its minimal columns to ResolvedSource
 * shape.
 *
 * Authority for feeds is derived from health + freshness + total_items_found
 * since scout_sources lacks authority_score.
 */

import type { ResolvedSource, SourceHealthStatus, SrlDb } from '../types.ts'
import { computeAuthority } from '../scoring/index.ts'

interface ScoutSourceRow {
  id: string
  name: string
  url: string
  category: string
  lang: string
  active: boolean
  last_fetched_at: string | null
  total_items_found: number
  health: 'ok' | 'error' | 'unknown'
  error_message: string | null
}

export interface FeedJoinFilter {
  category?: string
  lang?: string
  region?: string
  active?: boolean
  limit?: number
  /** Restrict to specific scout_sources IDs (driven by source_assignments). */
  ids?: string[]
}

export async function joinFeedsToSources(
  db: SrlDb,
  filter: FeedJoinFilter = {},
  now: Date = new Date(),
): Promise<ResolvedSource[]> {
  const rows = await fetchScoutSources(db, filter)
  return rows.map((r) => mapScoutSourceToResolved(r, now))
}

async function fetchScoutSources(db: SrlDb, filter: FeedJoinFilter): Promise<ScoutSourceRow[]> {
  try {
    let query = db
      .from('scout_sources')
      .select(
        'id, name, url, category, lang, active, last_fetched_at, total_items_found, health, error_message',
      )

    if (filter.category) query = query.eq('category', filter.category)
    if (filter.lang) query = query.eq('lang', filter.lang)
    if (typeof filter.active === 'boolean') query = query.eq('active', filter.active)
    else query = query.eq('active', true)
    if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids)

    query = query.limit(filter.limit ?? 200)

    const { data, error } = await query
    if (error || !data) return []
    return data as ScoutSourceRow[]
  } catch {
    return []
  }
}

function mapScoutSourceToResolved(row: ScoutSourceRow, now: Date): ResolvedSource {
  const health = mapLegacyHealth(row.health)

  // Derive synthetic authority from legacy fields since scout_sources has
  // no authority_score. Base 40, +10 for items found, +/- by health, freshness.
  const authorityBase = row.total_items_found > 0 ? Math.min(80, 40 + Math.log10(row.total_items_found + 1) * 10) : 40
  const errorRate = row.health === 'error' ? 0.5 : 0
  const authority = computeAuthority(
    {
      authorityBase,
      verifiedHandlesCount: 1,
      recentlyValidated: isFresh(row.last_fetched_at, now),
      errorRate30d: errorRate,
      lastValidatedAt: row.last_fetched_at ?? undefined,
    },
    now,
  )

  return {
    sourceId: row.id,
    type: 'feed',
    name: row.name,
    authority,
    health,
    handles: { rss: row.url },
    metadata: {
      category: row.category,
      lang: row.lang,
      total_items_found: row.total_items_found,
      error_message: row.error_message,
    },
    lastValidatedAt: row.last_fetched_at ?? undefined,
    priority: priorityFromCategory(row.category),
  }
}

function mapLegacyHealth(legacy: 'ok' | 'error' | 'unknown'): SourceHealthStatus {
  if (legacy === 'ok') return 'green'
  if (legacy === 'error') return 'red'
  return 'unknown'
}

function isFresh(lastFetchedAt: string | null, now: Date): boolean {
  if (!lastFetchedAt) return false
  const ts = Date.parse(lastFetchedAt)
  if (Number.isNaN(ts)) return false
  return now.getTime() - ts < 24 * 60 * 60 * 1000
}

function priorityFromCategory(category: string): number {
  switch (category) {
    case 'rap_core':
      return 90
    case 'culture':
      return 70
    case 'drama':
      return 60
    case 'fashion':
      return 50
    case 'global_news':
      return 30
    case 'science':
      return 20
    default:
      return 50
  }
}
