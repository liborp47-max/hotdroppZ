/**
 * Source Resolution Layer — main resolver.
 *
 * Spec: 04-srl-spec.md §Public API.
 *
 * Pipeline per resolve method:
 *   1. compute cache key
 *   2. check cache (LRU primary, Upstash if env present)
 *   3. on miss, run batched joins + scoring
 *   4. populate cache with TTL-per-pattern
 *   5. return bundle/profile/links
 *
 * Hard rules honored:
 *  - No external API calls (joins read DB only)
 *  - No business logic (intent → join dispatch is pure routing)
 *  - Backwards compat: feed-join still reads scout_sources directly
 *  - Cache miss is OK — every method completes without Redis
 */

import type {
  CacheAdapter,
  CampaignResolution,
  ConsumerContext,
  CrossPlatformProfile,
  PlatformLinks,
  ResolvedSource,
  ResolverDeps,
  SearchFilters,
  SearchHit,
  SourceBundle,
  SourceHealthReport,
  SourceResolver,
  SrlDb,
  TrackedEntityFilter,
  WorkerIntent,
} from './types.ts'
import {
  BundleCache,
  CACHE_KEY,
  CACHE_TTL,
  createDefaultCache,
  invalidateForSource,
} from './cache/index.ts'
import {
  buildCrossPlatformProfile,
  joinArtistsToSources,
  joinChartsToSources,
  joinFeedsToSources,
  joinPlaylistsToSources,
  joinTopicsToSources,
  lookupPlatformLinksByName,
} from './joins/index.ts'

interface AssignmentRow {
  source_id: string
  source_type?: string | null
  priority?: number | null
  active?: boolean | null
}

export class SrlResolver implements SourceResolver {
  private readonly db: SrlDb
  private readonly cache: BundleCache
  private readonly now: () => Date

  constructor(deps: ResolverDeps) {
    this.db = deps.db
    this.cache =
      deps.cache instanceof BundleCache ? deps.cache : new BundleCache(deps.cache)
    this.now = deps.now ?? (() => new Date())
  }

  // ─── Workers ────────────────────────────────────────────────────────────
  async resolveForWorker(
    workerId: string,
    intent: WorkerIntent,
    ctx?: Partial<ConsumerContext>,
  ): Promise<SourceBundle> {
    const key = CACHE_KEY.worker(workerId, intent)
    const cached = await this.cache.get<SourceBundle>(key)
    if (cached) return { ...cached, cacheHit: true, cacheKey: key }

    const limit = ctx?.limit ?? 50
    const priorityMin = ctx?.priorityMin ?? 0
    const region = ctx?.region

    const assignments = await this.fetchWorkerAssignments(workerId, intent)
    let sources: ResolvedSource[] = []

    if (assignments.length > 0) {
      sources = await this.resolveAssignedSources(assignments, intent, region)
    } else {
      sources = await this.resolveByIntentFallback(intent, region, limit)
    }

    const filtered = sources
      .filter((s) => s.authority >= priorityMin)
      .sort((a, b) => b.priority - a.priority || b.authority - a.authority)
      .slice(0, limit)

    const bundle: SourceBundle = {
      consumerId: workerId,
      resolvedAt: this.now().toISOString(),
      cacheHit: false,
      cacheKey: key,
      ttlSeconds: CACHE_TTL.worker,
      sources: filtered,
    }
    await this.cache.set(key, bundle, 'worker')
    return bundle
  }

  // ─── Writer / Curator / Enrichment ──────────────────────────────────────
  async resolveForArtist(artistId: string): Promise<CrossPlatformProfile> {
    const key = CACHE_KEY.artist(artistId)
    const cached = await this.cache.get<CrossPlatformProfile>(key)
    if (cached) return cached

    const profile = await buildCrossPlatformProfile(this.db, artistId, this.now())
    const result = profile ?? emptyProfile(artistId)
    await this.cache.set(key, result, 'artist')
    return result
  }

  async resolveCrossPlatformLinks(artistName: string): Promise<PlatformLinks> {
    const key = CACHE_KEY.xplatform(artistName)
    const cached = await this.cache.get<PlatformLinks>(key)
    if (cached) return cached

    const links = await lookupPlatformLinksByName(this.db, artistName)
    await this.cache.set(key, links, 'xplatform')
    return links
  }

  async enrichClusterArtist(clusterId: string): Promise<{
    cluster: { id: string; mainEntity: string; itemsCount: number }
    artist: CrossPlatformProfile | null
  }> {
    const key = CACHE_KEY.cluster(clusterId)
    const cached = await this.cache.get<{
      cluster: { id: string; mainEntity: string; itemsCount: number }
      artist: CrossPlatformProfile | null
    }>(key)
    if (cached) return cached

    const clusterMeta = await this.fetchClusterMeta(clusterId)
    let artist: CrossPlatformProfile | null = null

    if (clusterMeta.mainEntity) {
      const links = await lookupPlatformLinksByName(this.db, clusterMeta.mainEntity)
      if (links.confidence > 0 && links.artistId) {
        artist = await buildCrossPlatformProfile(this.db, links.artistId, this.now())
      }
    }

    const result = { cluster: clusterMeta, artist }
    await this.cache.set(key, result, 'cluster')
    return result
  }

  // ─── CEO / Plan Manager ─────────────────────────────────────────────────
  async resolveTrackedEntities(filter: TrackedEntityFilter): Promise<ResolvedSource[]> {
    const key = CACHE_KEY.tracked(filter)
    const cached = await this.cache.get<ResolvedSource[]>(key)
    if (cached) return cached

    const limit = filter.limit ?? 100
    const minAuthority = filter.minAuthority ?? 0
    let combined: ResolvedSource[] = []

    const types: TrackedEntityFilter['type'][] = filter.type
      ? [filter.type]
      : ['artist', 'playlist', 'feed', 'chart']

    for (const t of types) {
      const part = await this.fetchByType(t!, filter.region, limit)
      combined = combined.concat(part)
    }

    const filtered = combined
      .filter((s) => s.authority >= minAuthority)
      .sort((a, b) => b.priority - a.priority || b.authority - a.authority)
      .slice(0, limit)

    await this.cache.set(key, filtered, 'tracked')
    return filtered
  }

  // ─── Distribution / Creator ─────────────────────────────────────────────
  async resolveForCampaign(campaignId: string): Promise<CampaignResolution> {
    const key = CACHE_KEY.campaign(campaignId)
    const cached = await this.cache.get<CampaignResolution>(key)
    if (cached) return cached

    const meta = await this.fetchCampaignMeta(campaignId)
    const artist = meta.artistId
      ? (await buildCrossPlatformProfile(this.db, meta.artistId, this.now())) ?? emptyProfile(meta.artistId)
      : emptyProfile(campaignId)

    const result: CampaignResolution = {
      artist,
      assets: meta.assets,
      targets: meta.targets,
    }
    await this.cache.set(key, result, 'campaign')
    return result
  }

  // ─── Search ─────────────────────────────────────────────────────────────
  async search(query: string, filters?: SearchFilters): Promise<SearchHit[]> {
    const key = CACHE_KEY.search(query, filters)
    const cached = await this.cache.get<SearchHit[]>(key)
    if (cached) return cached

    const types = filters?.type ?? ['artist', 'playlist', 'feed', 'chart', 'topic']
    const minAuthority = filters?.minAuthority ?? 0
    const region = filters?.region

    let pool: ResolvedSource[] = []
    for (const t of types) {
      if (t === 'asset') continue
      const part = await this.fetchByType(t, region, 50)
      pool = pool.concat(part)
    }

    const needle = query.toLowerCase().trim()
    const hits: SearchHit[] = pool
      .filter((s) => s.authority >= minAuthority)
      .map((s) => ({ source: s, matchScore: nameMatchScore(s.name, needle) }))
      .filter((h) => h.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || b.source.authority - a.source.authority)
      .slice(0, 50)

    await this.cache.set(key, hits, 'search')
    return hits
  }

  // ─── Health + invalidation ──────────────────────────────────────────────
  async reportSourceHealth(sourceId: string, metrics: SourceHealthReport): Promise<void> {
    const startedAt = this.now().toISOString()
    // Best-effort write — table may not exist in current schema (PR-S1 dep)
    try {
      await this.db.from('worker_runs').insert({
        source_id: sourceId,
        status: metrics.status,
        latency_ms: metrics.latencyMs ?? null,
        items_found: metrics.itemsFound ?? null,
        error_code: metrics.errorCode ?? null,
        started_at: startedAt,
      })
    } catch {
      // schema missing — invalidation still fires
    }

    await this.invalidateCache(sourceId)
  }

  async invalidateCache(sourceId: string): Promise<void> {
    await invalidateForSource(this.cache, sourceId)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  private async fetchWorkerAssignments(
    workerId: string,
    intent: WorkerIntent,
  ): Promise<AssignmentRow[]> {
    try {
      const { data, error } = await this.db
        .from('source_assignments')
        .select('source_id, source_type, priority, active')
        .eq('consumer_id', workerId)
        .eq('intent', intent)
        .eq('active', true)
      if (error || !data) return []
      return data as AssignmentRow[]
    } catch {
      return []
    }
  }

  private async resolveAssignedSources(
    assignments: AssignmentRow[],
    intent: WorkerIntent,
    region: string | undefined,
  ): Promise<ResolvedSource[]> {
    const ids = assignments.map((a) => a.source_id)
    const sourceType = intentToType(intent)

    // Each join receives ids as a SQL .in('id', ids) filter — no fetch-then-filter.
    if (sourceType === 'artist') return joinArtistsToSources(this.db, ids, this.now())
    if (sourceType === 'playlist') return joinPlaylistsToSources(this.db, { region, ids }, this.now())
    if (sourceType === 'feed') return joinFeedsToSources(this.db, { ids }, this.now())
    if (sourceType === 'chart') return joinChartsToSources(this.db, { region, ids }, this.now())
    if (sourceType === 'topic') return joinTopicsToSources(this.db, { region, ids }, this.now())
    return []
  }

  private async resolveByIntentFallback(
    intent: WorkerIntent,
    region: string | undefined,
    limit: number,
  ): Promise<ResolvedSource[]> {
    const sourceType = intentToType(intent)
    return this.fetchByType(sourceType, region, limit)
  }

  private async fetchByType(
    type: NonNullable<TrackedEntityFilter['type']> | 'topic',
    region: string | undefined,
    limit: number,
  ): Promise<ResolvedSource[]> {
    if (type === 'artist') {
      // Without assignments we cannot enumerate all artists efficiently;
      // returns empty until PR-S1 ships an enumerate query.
      return []
    }
    if (type === 'playlist') return joinPlaylistsToSources(this.db, { region, limit }, this.now())
    if (type === 'feed') return joinFeedsToSources(this.db, { region, limit }, this.now())
    if (type === 'chart') return joinChartsToSources(this.db, { region, limit }, this.now())
    if (type === 'topic') return joinTopicsToSources(this.db, { region, limit }, this.now())
    return []
  }

  private async fetchClusterMeta(
    clusterId: string,
  ): Promise<{ id: string; mainEntity: string; itemsCount: number }> {
    try {
      const { data, error } = await this.db
        .from('story_clusters')
        .select('id, main_entity, items_count')
        .eq('id', clusterId)
        .limit(1)
      if (error || !data || data.length === 0) {
        return { id: clusterId, mainEntity: '', itemsCount: 0 }
      }
      type Row = { id: string; main_entity?: string | null; items_count?: number | null }
      const row = data[0] as Row
      return {
        id: row.id,
        mainEntity: row.main_entity ?? '',
        itemsCount: row.items_count ?? 0,
      }
    } catch {
      return { id: clusterId, mainEntity: '', itemsCount: 0 }
    }
  }

  private async fetchCampaignMeta(campaignId: string): Promise<{
    artistId: string | null
    assets: Array<{ kind: string; url: string }>
    targets: Array<{ platform: string; handle: string; schedule?: string }>
  }> {
    try {
      const { data, error } = await this.db
        .from('ad_campaigns')
        .select('id, artist_id, assets, targets')
        .eq('id', campaignId)
        .limit(1)
      if (error || !data || data.length === 0) {
        return { artistId: null, assets: [], targets: [] }
      }
      type Row = {
        artist_id?: string | null
        assets?: Array<{ kind: string; url: string }> | null
        targets?: Array<{ platform: string; handle: string; schedule?: string }> | null
      }
      const row = data[0] as Row
      return {
        artistId: row.artist_id ?? null,
        assets: row.assets ?? [],
        targets: row.targets ?? [],
      }
    } catch {
      return { artistId: null, assets: [], targets: [] }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Factory + helpers
// ────────────────────────────────────────────────────────────────────────────

export function createSourceResolver(db: SrlDb, cache?: CacheAdapter | BundleCache): SrlResolver {
  if (!cache) {
    return new SrlResolver({ db, cache: createDefaultCache().adapterInstance })
  }
  if (cache instanceof BundleCache) {
    return new SrlResolver({ db, cache: cache.adapterInstance })
  }
  return new SrlResolver({ db, cache })
}

function intentToType(intent: WorkerIntent): 'artist' | 'playlist' | 'feed' | 'chart' | 'topic' {
  switch (intent) {
    case 'tracked_artists':
      return 'artist'
    case 'curated_playlists':
      return 'playlist'
    case 'active_feeds':
      return 'feed'
    case 'chart_snapshot':
      return 'chart'
    case 'topic_keywords':
      return 'topic'
  }
}

function emptyProfile(id: string): CrossPlatformProfile {
  return {
    artistId: id,
    canonicalName: '',
    authority: 0,
    handles: {},
    images: [],
    recentReleases: [],
    signalStats: { chartMentions7d: 0, socialMentions7d: 0, rssMentions7d: 0 },
  }
}

function nameMatchScore(name: string, needle: string): number {
  const n = name.toLowerCase()
  if (!needle) return 0
  if (n === needle) return 1
  if (n.startsWith(needle)) return 0.85
  if (n.includes(needle)) return 0.6
  return 0
}
