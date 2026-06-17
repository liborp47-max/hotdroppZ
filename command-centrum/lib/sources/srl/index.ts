/**
 * Source Resolution Layer (SRL) — public barrel.
 *
 * Consumers import:
 *   import { createSourceResolver } from '@/lib/sources/srl'
 *
 * Do NOT import from internal paths (./joins, ./scoring, ./cache) outside of
 * the SRL module — that breaks the layer's single-entry contract.
 */

export * from './types.ts'
export { SrlResolver, createSourceResolver } from './resolver.ts'
export { srlHandlesToUrls, type SrlPlatformUrls } from './links.ts'
export {
  BundleCache,
  LruCacheAdapter,
  UpstashAdapter,
  createUpstashAdapterFromEnv,
  createDefaultCache,
  CACHE_KEY,
  CACHE_TTL,
  INVALIDATION_PATTERNS,
  invalidateForSource,
  handleSourceChangeEvent,
  bindCacheToBus,
  sourceChangeBus,
  type SourceChangeEvent,
  type CachePattern,
} from './cache/index.ts'
