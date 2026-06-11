/**
 * artist-join — assembles cross-platform handles + signal stats for artists.
 *
 * Forward-compat behavior:
 *  - When `artists` / `source_handles` / `platform_identifiers` tables are
 *    missing, returns empty arrays + minimal shape rather than throwing.
 *  - Spec hard rule: workers nikdy nečtou sources table přímo — they must
 *    invoke SRL.resolveForArtist or .resolveForWorker which delegates here.
 *
 * Zero N+1 — every fetch is a single .select().in() against the relevant
 * table; per-artist post-processing is in-memory grouping only.
 */

import type {
  CrossPlatformProfile,
  PlatformLinks,
  ResolvedSource,
  SrlDb,
} from '../types.ts'
import { computeAuthority, deriveHealthBatch, isRecentlyValidated } from '../scoring/index.ts'

interface ArtistRow {
  id: string
  canonical_name: string
  authority_score?: number | null
  last_validated_at?: string | null
  priority?: number | null
  metadata?: Record<string, unknown> | null
}

interface HandleRow {
  artist_id?: string | null
  source_id?: string | null
  platform: string
  handle: string
  verified?: boolean | null
}

interface PlatformIdRow {
  artist_id: string
  platform: string
  external_id: string
  verified?: boolean | null
}

interface ReleaseRow {
  id: string
  artist_id: string
  title: string
  released_at: string
}

const ARTIST_TABLE_CANDIDATES = ['artists', 'tracked_artists']

/**
 * Batch-resolve N artist IDs → ResolvedSource[] (one per artist).
 * Single query for artists + single query for handles + single for run-counters.
 */
export async function joinArtistsToSources(
  db: SrlDb,
  artistIds: string[],
  now: Date = new Date(),
): Promise<ResolvedSource[]> {
  if (artistIds.length === 0) return []

  const artists = await fetchArtists(db, artistIds)
  if (artists.length === 0) return []

  const handlesByArtist = await fetchHandlesGrouped(db, artistIds)
  const platformIdsByArtist = await fetchPlatformIdsGrouped(db, artistIds)
  const healthMap = await deriveHealthBatch(db, artistIds, now)

  return artists.map((a) => {
    const handles = mergeHandleMaps(
      handlesByArtist.get(a.id) ?? {},
      platformIdsByArtist.get(a.id) ?? {},
    )
    const verifiedHandlesCount = Object.values(handles).length
    const authority = computeAuthority(
      {
        authorityBase: a.authority_score ?? 0,
        verifiedHandlesCount,
        recentlyValidated: isRecentlyValidated(a.last_validated_at ?? undefined, now),
        errorRate30d: 0,
        lastValidatedAt: a.last_validated_at ?? undefined,
      },
      now,
    )

    return {
      sourceId: a.id,
      type: 'artist',
      name: a.canonical_name,
      authority,
      health: healthMap.get(a.id) ?? 'unknown',
      handles,
      metadata: a.metadata ?? {},
      lastValidatedAt: a.last_validated_at ?? undefined,
      priority: a.priority ?? 50,
    }
  })
}

/**
 * Full cross-platform profile for ONE artist — used by Writer / Curator.
 * Joins handles + recent releases + signal stats in 3 batched queries.
 */
export async function buildCrossPlatformProfile(
  db: SrlDb,
  artistId: string,
  now: Date = new Date(),
): Promise<CrossPlatformProfile | null> {
  const artists = await fetchArtists(db, [artistId])
  const artist = artists[0]
  if (!artist) return null

  const handlesByArtist = await fetchHandlesGrouped(db, [artistId])
  const platformIdsByArtist = await fetchPlatformIdsGrouped(db, [artistId])
  const merged = mergeHandleMaps(
    handlesByArtist.get(artistId) ?? {},
    platformIdsByArtist.get(artistId) ?? {},
  )

  const recentReleases = await fetchRecentReleases(db, artistId, 5)
  const signalStats = await fetchSignalStats(db, artistId, now)

  const authority = computeAuthority(
    {
      authorityBase: artist.authority_score ?? 0,
      verifiedHandlesCount: Object.values(merged).length,
      recentlyValidated: isRecentlyValidated(artist.last_validated_at ?? undefined, now),
      errorRate30d: 0,
      lastValidatedAt: artist.last_validated_at ?? undefined,
    },
    now,
  )

  return {
    artistId: artist.id,
    canonicalName: artist.canonical_name,
    authority,
    handles: pickKnownPlatforms(merged),
    images: extractImages(artist.metadata),
    recentReleases: recentReleases.map((r) => ({
      id: r.id,
      title: r.title,
      releasedAt: r.released_at,
    })),
    signalStats,
  }
}

/**
 * Name → PlatformLinks. Used by Enrichment to fill missing platform IDs.
 * Returns 0-confidence empty result when artist table is missing.
 */
export async function lookupPlatformLinksByName(
  db: SrlDb,
  artistName: string,
): Promise<PlatformLinks> {
  const matches = await fetchArtistsByName(db, artistName)
  if (matches.length === 0) {
    return { artistName, links: {}, confidence: 0 }
  }

  const top = matches[0]!
  const handlesByArtist = await fetchHandlesGrouped(db, [top.id])
  const platformIdsByArtist = await fetchPlatformIdsGrouped(db, [top.id])
  const merged = mergeHandleMaps(
    handlesByArtist.get(top.id) ?? {},
    platformIdsByArtist.get(top.id) ?? {},
  )

  const confidence = scoreNameMatch(top.canonical_name, artistName)
  return { artistName, artistId: top.id, links: merged, confidence }
}

// ────────────────────────────────────────────────────────────────────────────
// Internal — tolerant DB fetchers
// ────────────────────────────────────────────────────────────────────────────

async function fetchArtists(db: SrlDb, artistIds: string[]): Promise<ArtistRow[]> {
  for (const table of ARTIST_TABLE_CANDIDATES) {
    try {
      const { data, error } = await db
        .from(table)
        .select('id, canonical_name, authority_score, last_validated_at, priority, metadata')
        .in('id', artistIds)
      if (error) continue
      if (data && data.length > 0) return data as ArtistRow[]
    } catch {
      continue
    }
  }
  return []
}

async function fetchArtistsByName(db: SrlDb, name: string): Promise<ArtistRow[]> {
  const needle = `%${name.replace(/[%_]/g, '\\$&')}%`
  for (const table of ARTIST_TABLE_CANDIDATES) {
    try {
      const { data, error } = await db
        .from(table)
        .select('id, canonical_name, authority_score, last_validated_at, priority, metadata')
        .ilike('canonical_name', needle)
        .limit(5)
      if (error) continue
      if (data && data.length > 0) return data as ArtistRow[]
    } catch {
      continue
    }
  }
  return []
}

async function fetchHandlesGrouped(
  db: SrlDb,
  artistIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const grouped = new Map<string, Record<string, string>>()
  if (artistIds.length === 0) return grouped
  try {
    const { data, error } = await db
      .from('source_handles')
      .select('artist_id, source_id, platform, handle, verified')
      .in('artist_id', artistIds)
    if (error || !data) return grouped
    for (const row of data as HandleRow[]) {
      const key = row.artist_id ?? row.source_id
      if (!key) continue
      const bucket = grouped.get(key) ?? {}
      bucket[row.platform] = row.handle
      grouped.set(key, bucket)
    }
  } catch {
    // table missing → empty map (forward-compat)
  }
  return grouped
}

async function fetchPlatformIdsGrouped(
  db: SrlDb,
  artistIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const grouped = new Map<string, Record<string, string>>()
  if (artistIds.length === 0) return grouped
  try {
    const { data, error } = await db
      .from('platform_identifiers')
      .select('artist_id, platform, external_id, verified')
      .in('artist_id', artistIds)
    if (error || !data) return grouped
    for (const row of data as PlatformIdRow[]) {
      const bucket = grouped.get(row.artist_id) ?? {}
      bucket[row.platform] = row.external_id
      grouped.set(row.artist_id, bucket)
    }
  } catch {
    // table missing → empty map
  }
  return grouped
}

async function fetchRecentReleases(
  db: SrlDb,
  artistId: string,
  limit: number,
): Promise<ReleaseRow[]> {
  try {
    const { data, error } = await db
      .from('artist_releases')
      .select('id, artist_id, title, released_at')
      .eq('artist_id', artistId)
      .order('released_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as ReleaseRow[]
  } catch {
    return []
  }
}

async function fetchSignalStats(
  db: SrlDb,
  artistId: string,
  now: Date,
): Promise<CrossPlatformProfile['signalStats']> {
  const empty = { chartMentions7d: 0, socialMentions7d: 0, rssMentions7d: 0 }
  try {
    const sinceIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('artist_signal_stats')
      .select('artist_id, chart_mentions, social_mentions, rss_mentions')
      .eq('artist_id', artistId)
      .gte('window_start', sinceIso)
      .limit(1)
    if (error || !data || data.length === 0) return empty
    type SigRow = {
      chart_mentions?: number
      social_mentions?: number
      rss_mentions?: number
    }
    const row = data[0] as SigRow
    return {
      chartMentions7d: row.chart_mentions ?? 0,
      socialMentions7d: row.social_mentions ?? 0,
      rssMentions7d: row.rss_mentions ?? 0,
    }
  } catch {
    return empty
  }
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function mergeHandleMaps(
  a: Record<string, string>,
  b: Record<string, string>,
): Record<string, string> {
  return { ...a, ...b }
}

function pickKnownPlatforms(
  handles: Record<string, string>,
): CrossPlatformProfile['handles'] {
  const known: (keyof CrossPlatformProfile['handles'])[] = [
    'spotify_artists',
    'spotify_playlists',
    'apple_music',
    'deezer',
    'youtube',
    'instagram',
    'tiktok',
    'genius',
  ]
  const out: CrossPlatformProfile['handles'] = {}
  for (const k of known) {
    if (handles[k]) out[k] = handles[k]
  }
  return out
}

function extractImages(
  metadata: Record<string, unknown> | null | undefined,
): Array<{ kind: string; url: string }> {
  if (!metadata) return []
  const imagesField = (metadata as { images?: unknown }).images
  if (!Array.isArray(imagesField)) return []
  return imagesField
    .map((entry) => {
      if (typeof entry === 'string') return { kind: 'image', url: entry }
      if (entry && typeof entry === 'object' && 'url' in (entry as object)) {
        const e = entry as { kind?: string; url?: string }
        if (typeof e.url === 'string') return { kind: e.kind ?? 'image', url: e.url }
      }
      return null
    })
    .filter((x): x is { kind: string; url: string } => x !== null)
}

function scoreNameMatch(canonical: string, query: string): number {
  const a = canonical.toLowerCase().trim()
  const b = query.toLowerCase().trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.75
  return 0.4
}
