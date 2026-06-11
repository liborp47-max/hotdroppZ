/**
 * topic-join — assembles ResolvedSource[] of type='topic' for tracked
 * topic-keyword bundles used by trend / signals workers.
 *
 * Forward-compat: if `tracked_topics` table missing, returns empty list.
 */

import type { ResolvedSource, SrlDb } from '../types.ts'
import { computeAuthority, deriveHealthBatch, isRecentlyValidated } from '../scoring/index.ts'

const TOPIC_TABLE_CANDIDATES = ['tracked_topics', 'topics']

interface TopicRow {
  id: string
  name: string
  keywords: string[] | null
  language: string | null
  region: string | null
  authority_score?: number | null
  last_validated_at?: string | null
  priority?: number | null
  metadata?: Record<string, unknown> | null
}

export interface TopicJoinFilter {
  language?: string
  region?: string
  limit?: number
  ids?: string[]
}

export async function joinTopicsToSources(
  db: SrlDb,
  filter: TopicJoinFilter = {},
  now: Date = new Date(),
): Promise<ResolvedSource[]> {
  const rows = await fetchTopics(db, filter)
  if (rows.length === 0) return []

  const healthMap = await deriveHealthBatch(db, rows.map((r) => r.id), now)

  return rows.map((r) => {
    const authority = computeAuthority(
      {
        authorityBase: r.authority_score ?? 50,
        verifiedHandlesCount: 0,
        recentlyValidated: isRecentlyValidated(r.last_validated_at ?? undefined, now),
        errorRate30d: 0,
        lastValidatedAt: r.last_validated_at ?? undefined,
      },
      now,
    )
    return {
      sourceId: r.id,
      type: 'topic',
      name: r.name,
      authority,
      health: healthMap.get(r.id) ?? 'unknown',
      handles: {},
      metadata: {
        ...(r.metadata ?? {}),
        keywords: r.keywords ?? [],
        language: r.language,
        region: r.region,
      },
      lastValidatedAt: r.last_validated_at ?? undefined,
      priority: r.priority ?? 40,
    }
  })
}

async function fetchTopics(db: SrlDb, filter: TopicJoinFilter): Promise<TopicRow[]> {
  for (const table of TOPIC_TABLE_CANDIDATES) {
    try {
      let query = db
        .from(table)
        .select(
          'id, name, keywords, language, region, authority_score, last_validated_at, priority, metadata',
        )
      if (filter.language) query = query.eq('language', filter.language)
      if (filter.region) query = query.eq('region', filter.region)
      if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids)
      query = query.limit(filter.limit ?? 100)

      const { data, error } = await query
      if (error) continue
      if (data && data.length > 0) return data as TopicRow[]
    } catch {
      continue
    }
  }
  return []
}
