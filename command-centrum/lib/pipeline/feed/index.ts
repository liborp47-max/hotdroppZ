/**
 * UM-FEED_ENGINE — public barrel.
 *
 * Consumers import:
 *   import { runFeedEnginePipeline } from '@/lib/pipeline/feed-engine'
 *   import { pickTemplate, validateCard, localizeFeedPost } from '@/lib/pipeline/feed'
 *
 * Legacy FeedContent-based modules live at legacy-{structure,validator,translator}.ts
 * and are only imported from /api/feed/distribute + /api/distributor/dispatch.
 * Do NOT use legacy paths in new code.
 */

export * from './types.ts'
export { pickTemplate, detectMediaSignals } from './template-picker.ts'
export {
  enrichCardMetadata,
  fetchClustersBatch,
  computeViralityScore,
  makeShortSummary,
} from './metadata-enricher.ts'
export { validateCard, inferAspectRatio } from './validator.ts'
export { localizeFeedPost, parseMultilangResponse } from './localizer.ts'
export {
  lookup as lookupLocalizationCache,
  markFresh as markLocalizationFresh,
  contentHash,
  CACHE_TTL_MS,
  type LocalizationCacheEntry,
  type LocalizationCacheMap,
} from './localization-cache.ts'
