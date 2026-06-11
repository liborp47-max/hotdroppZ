/**
 * Gateway registry — single source of truth for all gateways.
 *
 * Workers resolve their gateway via `getGateway(worker.config.gatewayId)`.
 * Adding a platform:
 *   1. Implement `Gateway` in `lib/scout/gateways/<platform>-gateway.ts`
 *   2. Register here
 *   3. Workers reference it through `WorkerConfig.gatewayId`
 */

import type { GatewayId } from '@/lib/scout/types'
import type { BaseGateway } from './gateway.interface'
import { SpotifyGateway } from './spotify-gateway'
import { RssGateway } from './rss-gateway'

const registry = new Map<GatewayId, BaseGateway>()

registry.set('spotify_gateway', new SpotifyGateway())
registry.set('rss_gateway', new RssGateway())

// PR-2…PR-4 will register:
//   apple_music_gateway, deezer_gateway,
//   youtube_gateway, instagram_gateway, tiktok_gateway,
//   web_gateway (blogs/magazines), social_gateway (cross-platform aggregator),
//   charts_gateway, trends_gateway

export function getGateway(id: GatewayId): BaseGateway | null {
  return registry.get(id) ?? null
}

export function listGateways(): BaseGateway[] {
  return Array.from(registry.values())
}
