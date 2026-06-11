/**
 * Source Access Layer — Gateway interface.
 *
 * Workers NEVER touch raw APIs. They call standardized gateway methods.
 * Gateways own:
 *   - API keys / OAuth / secrets
 *   - rate limits + queues + backoff
 *   - response caching (shared across workers)
 *   - normalization of platform-specific payloads
 *
 * Adding a new platform:
 *   1. Create `lib/scout/gateways/<platform>-gateway.ts` implementing `Gateway`
 *   2. Register in `lib/scout/gateways/registry.ts`
 *   3. Workers reference by `GatewayId` in their config
 */

import type { GatewayHealth, NormalizedEvent, WorkerPlatform } from '@/lib/scout/types'

export interface BaseGateway {
  readonly id: string
  readonly platform: WorkerPlatform | WorkerPlatform[]
  healthCheck(): Promise<GatewayHealth>
}

// ─── Music-family methods (Spotify, Apple Music, Deezer) ─────────────────────

export interface MusicGateway extends BaseGateway {
  getArtistLatestReleases(artistHandle: string, sinceIso?: string): Promise<NormalizedEvent[]>
  getPlaylistTracks(playlistHandle: string): Promise<NormalizedEvent[]>
  searchArtist(query: string): Promise<{ id: string; name: string; url: string } | null>
}

// ─── Social-family methods (Instagram, TikTok, YouTube) ──────────────────────

export interface SocialGateway extends BaseGateway {
  getProfileRecentPosts(handle: string, sinceIso?: string): Promise<NormalizedEvent[]>
  getChannelUploads?(channelId: string, sinceIso?: string): Promise<NormalizedEvent[]>
}

// ─── Media-family methods (RSS, blogs, magazines) ────────────────────────────

export interface MediaGateway extends BaseGateway {
  getFeedItems(feedUrl: string, sinceIso?: string): Promise<NormalizedEvent[]>
  /** For magazines/blogs that don't expose RSS; fall back to scrape. */
  getWebPage?(url: string): Promise<{ title: string; html: string }>
}

// ─── Signals-family methods (Charts, Trends) ─────────────────────────────────

export interface SignalsGateway extends BaseGateway {
  getChartSnapshot(chartId: string): Promise<NormalizedEvent[]>
  getTrendSpike?(keyword: string, region?: string): Promise<NormalizedEvent[]>
}

// ─── Cache + rate-limit contract ─────────────────────────────────────────────

export interface CacheLayer {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  invalidate(prefix: string): Promise<void>
}

export interface RateLimiter {
  acquire(gatewayId: string, units?: number): Promise<boolean>
  getRemaining(gatewayId: string): Promise<number>
}
