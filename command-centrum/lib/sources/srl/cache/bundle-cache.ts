/**
 * Bundle cache — typed wrapper around CacheAdapter with spec TTL table:
 *
 *   resolveForWorker(workerId, intent)        →  60s     srl:worker:{workerId}:{intent}
 *   resolveForArtist(artistId)                →  300s    srl:artist:{artistId}
 *   resolveCrossPlatformLinks(name)           →  3600s   srl:xplatform:{normalized(name)}
 *   resolveTrackedEntities(filter)            →  120s    srl:tracked:{hash(filter)}
 *   search(query, filters)                    →  30s     srl:search:{hash(q+filters)}
 *
 * Single source of truth for cache keys + TTLs so resolver and invalidation
 * stay in sync.
 */

import type { CacheAdapter, SearchFilters, TrackedEntityFilter, WorkerIntent } from '../types.ts'
import { LruCacheAdapter } from './lru.ts'
import { createUpstashAdapterFromEnv } from './upstash-adapter.ts'

export const CACHE_TTL = {
  worker: 60,
  artist: 300,
  xplatform: 3600,
  tracked: 120,
  search: 30,
  campaign: 120,
  cluster: 300,
} as const

export type CachePattern = keyof typeof CACHE_TTL

export const CACHE_KEY = {
  worker: (workerId: string, intent: WorkerIntent) =>
    `srl:worker:${workerId}:${intent}`,
  artist: (artistId: string) => `srl:artist:${artistId}`,
  xplatform: (name: string) => `srl:xplatform:${normalizeName(name)}`,
  tracked: (filter: TrackedEntityFilter) => `srl:tracked:${hashJson(filter)}`,
  search: (query: string, filters: SearchFilters | undefined) =>
    `srl:search:${hashJson({ q: query.toLowerCase().trim(), f: filters ?? {} })}`,
  campaign: (campaignId: string) => `srl:campaign:${campaignId}`,
  cluster: (clusterId: string) => `srl:cluster:${clusterId}`,
} as const

/** Source-id → cache key patterns we should invalidate when that source changes. */
export const INVALIDATION_PATTERNS = {
  bySource: (sourceId: string) => [
    `srl:artist:${sourceId}`,
    `srl:worker:*`, // worker bundles potentially reference this source
    `srl:tracked:*`,
    `srl:search:*`,
    `srl:campaign:*`,
  ],
} as const

export class BundleCache {
  private readonly adapter: CacheAdapter

  constructor(adapter: CacheAdapter) {
    this.adapter = adapter
  }

  async get<T>(key: string): Promise<T | null> {
    return this.adapter.get<T>(key)
  }

  async set<T>(key: string, value: T, pattern: CachePattern): Promise<void> {
    await this.adapter.set(key, value, CACHE_TTL[pattern])
  }

  async del(key: string): Promise<void> {
    await this.adapter.del(key)
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.adapter.delPattern) {
      await this.adapter.delPattern(pattern)
    }
  }

  get adapterInstance(): CacheAdapter {
    return this.adapter
  }
}

/**
 * Default cache factory — prefers Upstash when env vars present, falls back
 * to in-memory LRU. Mirrors the spec hard rule "Cache miss is OK".
 */
export function createDefaultCache(): BundleCache {
  const upstash = createUpstashAdapterFromEnv()
  if (upstash) return new BundleCache(upstash)
  return new BundleCache(new LruCacheAdapter({ maxEntries: 1000 }))
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Stable JSON hash — sorts keys so equivalent filters produce same key. */
export function hashJson(obj: unknown): string {
  return djb2(stableStringify(obj))
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]),
  )
  return '{' + pairs.join(',') + '}'
}

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}
