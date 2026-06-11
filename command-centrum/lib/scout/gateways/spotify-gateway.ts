/**
 * Spotify Gateway — reference implementation (mock for PR-5).
 *
 * Real implementation (PR-2 backend phase) will wire to:
 *   - lib/services/spotify.ts (existing OAuth client credentials)
 *   - Redis cache layer (shared across spotify_playlists + spotify_artists workers)
 *   - Token-bucket rate limiter (30 req/s, shared across ALL spotify workers)
 *
 * Workers that depend on this gateway:
 *   - workers/music/spotify-playlists-worker → getPlaylistTracks()
 *   - workers/music/spotify-artists-worker   → getArtistLatestReleases()
 *   - workers/signals/charts-worker          → getPlaylistTracks() (Spotify Top 50)
 *
 * NOTE: 1 gateway, multiple workers — cache-share benefits + unified rate limit.
 */

import type { GatewayHealth, NormalizedEvent, WorkerPlatform } from '@/lib/scout/types'
import type { MusicGateway } from './gateway.interface'

export class SpotifyGateway implements MusicGateway {
  readonly id = 'spotify_gateway' as const
  // Single gateway serves multiple Spotify-focused workers (playlists + artists).
  readonly platform: WorkerPlatform[] = ['spotify_playlists', 'spotify_artists']

  async healthCheck(): Promise<GatewayHealth> {
    return { ok: true, latencyMs: 120, cacheHitRate: 0.62, rateLimitRemaining: 18 }
  }

  async getArtistLatestReleases(
    _artistHandle: string,
    _sinceIso?: string,
  ): Promise<NormalizedEvent[]> {
    // PR-2: GET /artists/{id}/albums?include_groups=album,single&market=EU&limit=50
    return []
  }

  async getPlaylistTracks(_playlistHandle: string): Promise<NormalizedEvent[]> {
    // PR-2: GET /playlists/{id}/tracks
    return []
  }

  async searchArtist(query: string): Promise<{ id: string; name: string; url: string } | null> {
    // PR-2: GET /search?type=artist&q=...
    return { id: 'mock', name: query, url: `https://open.spotify.com/artist/mock` }
  }
}
