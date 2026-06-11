/**
 * Source Resolution Layer (SRL) — core types.
 *
 * Source of truth: SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/04-srl-spec.md
 *
 * Forward-compat note: the registry schema (PR-S1) is not yet shipped. SRL
 * therefore degrades gracefully when source_handles / platform_identifiers /
 * worker_runs / source_assignments tables are missing — joins return empty
 * arrays, scoring falls back to defaults, health defaults to 'unknown'.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────────────────────
// Consumer model — who is asking SRL for sources, and what they need
// ────────────────────────────────────────────────────────────────────────────

export type ConsumerType =
  | 'worker'
  | 'writer'
  | 'curator'
  | 'enrichment'
  | 'creator'
  | 'intelligence'
  | 'distribution'

export type WorkerIntent =
  | 'tracked_artists'
  | 'curated_playlists'
  | 'active_feeds'
  | 'chart_snapshot'
  | 'topic_keywords'

export interface ConsumerContext {
  consumerType: ConsumerType
  consumerId: string
  intent?: WorkerIntent
  region?: string
  language?: string
  /** 0-100, filters out sources with authority below this threshold */
  priorityMin?: number
  /** Max sources to return. Defaults to 50 if unspecified. */
  limit?: number
}

// ────────────────────────────────────────────────────────────────────────────
// Resolved source model
// ────────────────────────────────────────────────────────────────────────────

export type SourceType = 'artist' | 'playlist' | 'feed' | 'chart' | 'topic' | 'asset'

/** Spec health vocabulary (different from legacy scout_sources.health = ok/error/unknown). */
export type SourceHealthStatus = 'green' | 'amber' | 'red' | 'unknown'

export interface ResolvedSource {
  sourceId: string
  type: SourceType
  name: string
  /** Composite authority score 0-100. Computed via scoring/authority.ts. */
  authority: number
  health: SourceHealthStatus
  /**
   * Platform handle map. Keys match WorkerPlatform from lib/scout/types:
   * `spotify_artists`, `spotify_playlists`, `apple_music`, `deezer`, `youtube`,
   * `instagram`, `tiktok`, `rss`, etc.
   *
   * Values are platform-native IDs (Spotify URI fragment, RSS feed URL, …).
   */
  handles: Record<string, string>
  metadata: Record<string, unknown>
  lastValidatedAt?: string
  /** Assignment priority 0-100 (from source_assignments.priority). */
  priority: number
}

export interface SourceBundle {
  consumerId: string
  resolvedAt: string
  cacheHit: boolean
  cacheKey: string
  ttlSeconds: number
  sources: ResolvedSource[]
}

// ────────────────────────────────────────────────────────────────────────────
// Cross-platform artist profile (used by Writer / Curator / Enrichment)
// ────────────────────────────────────────────────────────────────────────────

export interface CrossPlatformProfile {
  artistId: string
  canonicalName: string
  authority: number
  handles: {
    spotify_artists?: string
    spotify_playlists?: string
    apple_music?: string
    deezer?: string
    youtube?: string
    instagram?: string
    tiktok?: string
    genius?: string
  }
  images: Array<{ kind: string; url: string }>
  recentReleases?: Array<{ id: string; title: string; releasedAt: string }>
  signalStats: {
    chartMentions7d: number
    socialMentions7d: number
    rssMentions7d: number
  }
}

export interface PlatformLinks {
  artistName: string
  /** Resolved internal artist id when a match was found; undefined when confidence=0. */
  artistId?: string
  links: Partial<Record<string, string>>
  /** 0-1 confidence in the link match (1 = verified, 0 = guess) */
  confidence: number
}

// ────────────────────────────────────────────────────────────────────────────
// Health reporting + cache invalidation
// ────────────────────────────────────────────────────────────────────────────

export interface SourceHealthReport {
  status: 'success' | 'failure' | 'rate_limited'
  latencyMs?: number
  itemsFound?: number
  errorCode?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Tracked entity filters + search
// ────────────────────────────────────────────────────────────────────────────

export type TrackedPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface TrackedEntityFilter {
  type?: 'artist' | 'playlist' | 'feed' | 'chart'
  priority?: TrackedPriority
  region?: string
  minAuthority?: number
  limit?: number
}

export interface SearchFilters {
  type?: SourceType[]
  tags?: string[]
  region?: string
  minAuthority?: number
}

export interface SearchHit {
  source: ResolvedSource
  /** 0-1 match relevance for `query` */
  matchScore: number
}

// ────────────────────────────────────────────────────────────────────────────
// Campaign resolution (Distribution / Creator)
// ────────────────────────────────────────────────────────────────────────────

export interface CampaignResolution {
  artist: CrossPlatformProfile
  assets: Array<{ kind: string; url: string }>
  targets: Array<{ platform: string; handle: string; schedule?: string }>
}

// ────────────────────────────────────────────────────────────────────────────
// SourceResolver public API contract (consumed by every module + REST layer)
// ────────────────────────────────────────────────────────────────────────────

export interface SourceResolver {
  // ─── Scout workers ────────────────────────────────────────────────────────
  resolveForWorker(
    workerId: string,
    intent: WorkerIntent,
    ctx?: Partial<ConsumerContext>,
  ): Promise<SourceBundle>

  // ─── Writer / Curator / Enrichment ────────────────────────────────────────
  resolveForArtist(artistId: string): Promise<CrossPlatformProfile>
  resolveCrossPlatformLinks(artistName: string): Promise<PlatformLinks>
  enrichClusterArtist(clusterId: string): Promise<{
    cluster: { id: string; mainEntity: string; itemsCount: number }
    artist: CrossPlatformProfile | null
  }>

  // ─── CEO / Plan Manager ───────────────────────────────────────────────────
  resolveTrackedEntities(filter: TrackedEntityFilter): Promise<ResolvedSource[]>

  // ─── Distribution / Creator ───────────────────────────────────────────────
  resolveForCampaign(campaignId: string): Promise<CampaignResolution>

  // ─── Generic search ───────────────────────────────────────────────────────
  search(query: string, filters?: SearchFilters): Promise<SearchHit[]>

  // ─── Health + invalidation ────────────────────────────────────────────────
  reportSourceHealth(sourceId: string, metrics: SourceHealthReport): Promise<void>
  invalidateCache(sourceId: string): Promise<void>
}

// ────────────────────────────────────────────────────────────────────────────
// Internal DI types — DB + cache adapters, scoring context
// ────────────────────────────────────────────────────────────────────────────

export type SrlDb = Pick<SupabaseClient, 'from' | 'rpc'>

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  /** Optional pattern delete — used by invalidation. May be a no-op on adapters that lack scan support. */
  delPattern?(pattern: string): Promise<void>
}

export interface ScoringContext {
  authorityBase: number
  verifiedHandlesCount: number
  recentlyValidated: boolean
  errorRate30d: number
  lastValidatedAt?: string
}

export interface ResolverDeps {
  db: SrlDb
  cache: CacheAdapter
  /** Used in tests to freeze time. Defaults to () => new Date(). */
  now?: () => Date
}
