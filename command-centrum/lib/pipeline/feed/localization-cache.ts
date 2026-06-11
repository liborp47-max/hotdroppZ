/**
 * SM-4 — Localization cache (7-day TTL).
 *
 * Risk R3 (plan-manager triage): cache key MUST be content-hash, not include
 * timestamps. Otherwise cache rate → 0 and AI cost explodes 4× per cluster.
 *
 * Storage strategy: cache metadata lives inside `feed_posts.card_metadata`
 * jsonb at key `localizationCache`. No separate table needed — survives server
 * restart (it's in Postgres), invalidates per-row when englishMaster changes
 * (content hash differs).
 *
 *   card_metadata.localizationCache = {
 *     <lang>: { hash: '<djb2 of english title+summary>', expiresAt: '<ISO>' }
 *   }
 */

import type { CardMetadata, LocalizedVersions, SupportedLanguage } from './types.ts'

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface LocalizationCacheEntry {
  hash: string
  expiresAt: string
}

export type LocalizationCacheMap = Record<string, LocalizationCacheEntry>

export interface CacheLookupInput {
  metadata: CardMetadata | null
  localizedVersions: LocalizedVersions | null
  englishMaster: { title: string; summary: string }
  target: SupportedLanguage
  now?: () => Date
}

export interface CacheLookupResult {
  hit: boolean
  reason: 'fresh' | 'expired' | 'missing' | 'content_changed'
  cached?: { title: string; summary: string }
}

export function lookup(input: CacheLookupInput): CacheLookupResult {
  const cache = input.metadata?.localizationCache as LocalizationCacheMap | undefined
  const versions = input.localizedVersions ?? {}
  const target = input.target
  const expectedHash = contentHash(input.englishMaster)
  const now = (input.now ?? (() => new Date()))()

  const entry = cache?.[target]
  const stored = versions[target]

  if (!entry || !stored) {
    return { hit: false, reason: 'missing' }
  }
  if (entry.hash !== expectedHash) {
    return { hit: false, reason: 'content_changed' }
  }
  const expiresMs = Date.parse(entry.expiresAt)
  if (Number.isNaN(expiresMs) || expiresMs <= now.getTime()) {
    return { hit: false, reason: 'expired' }
  }
  return { hit: true, reason: 'fresh', cached: stored }
}

export function markFresh(
  cache: LocalizationCacheMap,
  target: SupportedLanguage,
  englishMaster: { title: string; summary: string },
  now: Date = new Date(),
): LocalizationCacheMap {
  return {
    ...cache,
    [target]: {
      hash: contentHash(englishMaster),
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    },
  }
}

/**
 * Stable content hash — deterministic across calls with same input.
 * djb2 → base36 (8-10 chars). Title + summary only; body excluded since cards
 * don't render full body.
 */
export function contentHash(input: { title: string; summary: string }): string {
  const canonical = `${normalize(input.title)}|${normalize(input.summary)}`
  let hash = 5381
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}
