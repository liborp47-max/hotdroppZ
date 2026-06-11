/**
 * chart-join — assembles ResolvedSource[] of type='chart' for tracked charts
 * (Spotify Top 50, Apple Music Top, Billboard, etc.).
 *
 * Forward-compat: charts registry table is part of PR-S1; when missing,
 * returns empty list.
 */

import type { ResolvedSource, SrlDb } from '../types.ts'
import { computeAuthority, deriveHealthBatch, isRecentlyValidated } from '../scoring/index.ts'

const CHART_TABLE_CANDIDATES = ['tracked_charts', 'charts']

interface ChartRow {
  id: string
  name: string
  platform: string
  external_id: string
  region: string | null
  authority_score?: number | null
  last_validated_at?: string | null
  priority?: number | null
  metadata?: Record<string, unknown> | null
}

export interface ChartJoinFilter {
  region?: string
  platform?: string
  limit?: number
  ids?: string[]
}

export async function joinChartsToSources(
  db: SrlDb,
  filter: ChartJoinFilter = {},
  now: Date = new Date(),
): Promise<ResolvedSource[]> {
  const rows = await fetchCharts(db, filter)
  if (rows.length === 0) return []

  const healthMap = await deriveHealthBatch(db, rows.map((r) => r.id), now)

  return rows.map((r) => {
    const handles: Record<string, string> = { [r.platform]: r.external_id }
    const authority = computeAuthority(
      {
        authorityBase: r.authority_score ?? 60,
        verifiedHandlesCount: 1,
        recentlyValidated: isRecentlyValidated(r.last_validated_at ?? undefined, now),
        errorRate30d: 0,
        lastValidatedAt: r.last_validated_at ?? undefined,
      },
      now,
    )
    return {
      sourceId: r.id,
      type: 'chart',
      name: r.name,
      authority,
      health: healthMap.get(r.id) ?? 'unknown',
      handles,
      metadata: { ...(r.metadata ?? {}), region: r.region },
      lastValidatedAt: r.last_validated_at ?? undefined,
      priority: r.priority ?? 70,
    }
  })
}

async function fetchCharts(db: SrlDb, filter: ChartJoinFilter): Promise<ChartRow[]> {
  for (const table of CHART_TABLE_CANDIDATES) {
    try {
      let query = db
        .from(table)
        .select(
          'id, name, platform, external_id, region, authority_score, last_validated_at, priority, metadata',
        )
      if (filter.region) query = query.eq('region', filter.region)
      if (filter.platform) query = query.eq('platform', filter.platform)
      if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids)
      query = query.limit(filter.limit ?? 50)

      const { data, error } = await query
      if (error) continue
      if (data && data.length > 0) return data as ChartRow[]
    } catch {
      continue
    }
  }
  return []
}
