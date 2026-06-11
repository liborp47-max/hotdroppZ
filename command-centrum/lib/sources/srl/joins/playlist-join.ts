/**
 * playlist-join — assembles ResolvedSource[] of type='playlist' for curated
 * playlists across platforms (Spotify, Apple Music, Deezer, YouTube).
 *
 * Forward-compat: if playlists registry table is missing, returns empty.
 * No fallback to scout_sources since scout_sources is RSS-only.
 */

import type { ResolvedSource, SrlDb } from '../types.ts'
import { computeAuthority, deriveHealthBatch, isRecentlyValidated } from '../scoring/index.ts'

const PLAYLIST_TABLE_CANDIDATES = ['curated_playlists', 'playlists', 'tracked_playlists']

interface PlaylistRow {
  id: string
  name: string
  platform: string
  external_id: string
  authority_score?: number | null
  last_validated_at?: string | null
  priority?: number | null
  metadata?: Record<string, unknown> | null
  region?: string | null
}

export interface PlaylistJoinFilter {
  region?: string
  platform?: string
  limit?: number
  /** Restrict to specific source IDs — used by resolveAssignedSources to honor source_assignments without filter-in-memory. */
  ids?: string[]
}

export async function joinPlaylistsToSources(
  db: SrlDb,
  filter: PlaylistJoinFilter = {},
  now: Date = new Date(),
): Promise<ResolvedSource[]> {
  const rows = await fetchPlaylists(db, filter)
  if (rows.length === 0) return []

  const healthMap = await deriveHealthBatch(db, rows.map((r) => r.id), now)

  return rows.map((r) => {
    const handles: Record<string, string> = {}
    handles[r.platform] = r.external_id

    const authority = computeAuthority(
      {
        authorityBase: r.authority_score ?? 0,
        verifiedHandlesCount: 1,
        recentlyValidated: isRecentlyValidated(r.last_validated_at ?? undefined, now),
        errorRate30d: 0,
        lastValidatedAt: r.last_validated_at ?? undefined,
      },
      now,
    )

    return {
      sourceId: r.id,
      type: 'playlist',
      name: r.name,
      authority,
      health: healthMap.get(r.id) ?? 'unknown',
      handles,
      metadata: { ...(r.metadata ?? {}), region: r.region ?? null },
      lastValidatedAt: r.last_validated_at ?? undefined,
      priority: r.priority ?? 50,
    }
  })
}

async function fetchPlaylists(db: SrlDb, filter: PlaylistJoinFilter): Promise<PlaylistRow[]> {
  for (const table of PLAYLIST_TABLE_CANDIDATES) {
    try {
      let query = db
        .from(table)
        .select(
          'id, name, platform, external_id, authority_score, last_validated_at, priority, metadata, region',
        )
      if (filter.region) query = query.eq('region', filter.region)
      if (filter.platform) query = query.eq('platform', filter.platform)
      if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids)
      query = query.limit(filter.limit ?? 100)

      const { data, error } = await query
      if (error) continue
      if (data && data.length > 0) return data as PlaylistRow[]
    } catch {
      continue
    }
  }
  return []
}
