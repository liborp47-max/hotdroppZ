/**
 * Spotify Artists Worker — SRL reference integration.
 *
 * This is the proof-of-concept worker that demonstrates SRL end-to-end:
 *   1. Worker NEVER reads `sources` / `scout_sources` directly
 *   2. SRL.resolveForWorker(workerId, 'tracked_artists') returns SourceBundle
 *   3. Worker iterates bundle.sources, extracts spotify_artists handle
 *   4. Worker calls SpotifyGateway (Source Access Layer) — gateway owns API keys
 *   5. Worker reports health back via SRL.reportSourceHealth — closes the loop
 *
 * Pattern is identical for spotify-playlists-worker, apple-music-worker,
 * deezer-worker, etc. Workers stay dumb collectors; SRL is the contract.
 */

import { SpotifyGateway } from '@/lib/scout/gateways/spotify-gateway'
import type { NormalizedEvent } from '@/lib/scout/types'
import { createSourceResolver, type SrlDb } from '@/lib/sources/srl'

export interface SpotifyArtistsWorkerOptions {
  workerId?: string
  region?: string
  limit?: number
}

export interface SpotifyArtistsWorkerResult {
  workerId: string
  sourcesProcessed: number
  itemsFetched: number
  errors: number
  cacheHit: boolean
  durationMs: number
  events: NormalizedEvent[]
}

const DEFAULT_OPTIONS: Required<SpotifyArtistsWorkerOptions> = {
  workerId: 'wkr-spotify-artists',
  region: 'EU',
  limit: 50,
}

/**
 * Reference run loop — pure orchestration, no DB or platform-specific logic.
 */
export async function runSpotifyArtistsWorker(
  db: SrlDb,
  options: SpotifyArtistsWorkerOptions = {},
): Promise<SpotifyArtistsWorkerResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startedAt = Date.now()

  const srl = createSourceResolver(db)
  const gateway = new SpotifyGateway()

  const bundle = await srl.resolveForWorker(opts.workerId, 'tracked_artists', {
    region: opts.region,
    limit: opts.limit,
  })

  const events: NormalizedEvent[] = []
  let errors = 0

  for (const source of bundle.sources) {
    const spotifyId = source.handles.spotify_artists
    if (!spotifyId) continue

    const callStart = Date.now()
    try {
      const releases = await gateway.getArtistLatestReleases(spotifyId)
      events.push(...releases)
      await srl.reportSourceHealth(source.sourceId, {
        status: 'success',
        latencyMs: Date.now() - callStart,
        itemsFound: releases.length,
      })
    } catch (e) {
      errors += 1
      await srl.reportSourceHealth(source.sourceId, {
        status: 'failure',
        latencyMs: Date.now() - callStart,
        errorCode: errorCode(e),
      })
    }
  }

  return {
    workerId: opts.workerId,
    sourcesProcessed: bundle.sources.length,
    itemsFetched: events.length,
    errors,
    cacheHit: bundle.cacheHit,
    durationMs: Date.now() - startedAt,
    events,
  }
}

function errorCode(e: unknown): string {
  if (e && typeof e === 'object') {
    const obj = e as { code?: unknown; name?: unknown }
    if (typeof obj.code === 'string') return obj.code
    if (typeof obj.name === 'string') return obj.name
  }
  return 'UNKNOWN_ERROR'
}
