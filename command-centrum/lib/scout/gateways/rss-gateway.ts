/**
 * RSS Gateway — reference implementation (mock for PR-5).
 *
 * Shared by media workers: RSS, Blogs, Magazines.
 * Real impl (PR-3) wires to lib/services/rss-parser.ts + per-host throttling.
 */

import type { GatewayHealth, NormalizedEvent, WorkerPlatform } from '@/lib/scout/types'
import type { MediaGateway } from './gateway.interface'

export class RssGateway implements MediaGateway {
  readonly id = 'rss_gateway' as const
  readonly platform: WorkerPlatform[] = ['rss', 'blogs', 'magazines']

  async healthCheck(): Promise<GatewayHealth> {
    return { ok: true, latencyMs: 850, cacheHitRate: 0.18 }
  }

  async getFeedItems(_feedUrl: string, _sinceIso?: string): Promise<NormalizedEvent[]> {
    // PR-3: parse RSS/Atom/JSON Feed via lib/services/rss-parser.ts; dedup by url
    return []
  }

  async getWebPage(url: string): Promise<{ title: string; html: string }> {
    // PR-3: server-side fetch with browser-like UA + per-host throttle
    return { title: `Mock page ${url}`, html: '' }
  }
}
