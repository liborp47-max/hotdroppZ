/**
 * SM-4 — Multi-language varianty (CS/DE/FR/PL).
 *
 * Wraps the existing MULTILANG_FULL prompt with a per-row content cache
 * (7-day TTL) so re-runs over unchanged feed_posts don't re-spend AI tokens.
 *
 * Flow per feed_post:
 *   1. For each target lang, check cache via lookup() — content_hash + TTL gate
 *   2. Collect cache misses into a single MULTILANG_FULL call (one AI call
 *      yields ALL missing languages — keeps cost low even when 4/4 miss)
 *   3. Parse JSON response, merge with cached hits, persist back to
 *      feed_posts.localized_versions + card_metadata.localizationCache
 *
 * Hard rules:
 *   - Cache key = content hash. NO timestamps in key. (Risk R3)
 *   - Card metadata mutation is functional — caller persists, localizer pure.
 *   - AI call wrapped in try/catch — returns partial results on failure rather
 *     than throwing (pipeline never crashes on model error, per CLAUDE.md).
 */

import type {
  CardMetadata,
  LocalizeInput,
  LocalizeResult,
  LocalizedCardEntry,
  LocalizedVersions,
  SupportedLanguage,
} from './types.ts'
import { SUPPORTED_LANGUAGES } from './types.ts'
import { lookup, markFresh, type LocalizationCacheMap } from './localization-cache.ts'

/**
 * AI dispatcher contract — matches lib/pipeline/ai.ts callAI. Localizer keeps
 * it as a typed function instead of importing the module so unit tests can
 * skip loading the whole AI stack.
 */
export type LocalizerAi = (step: string, system: string, user: string) => Promise<string>

export interface LocalizerDeps {
  /** REQUIRED. Inject the real callAI in production, a fake in tests. */
  ai: LocalizerAi
  /** REQUIRED. Inject MULTILANG_FULL_SYSTEM in production. */
  systemPrompt: string
  /** Frozen time for deterministic tests. */
  now?: () => Date
}

export interface LocalizerContext {
  metadata: CardMetadata | null
  localizedVersions: LocalizedVersions | null
}

export interface LocalizerOutputPatch {
  localizedVersions: LocalizedVersions
  cardMetadata: CardMetadata
}

/**
 * Run localization for one feed_post.
 *
 * Returns the LocalizeResult (analytics-friendly summary) plus a `patch`
 * payload that the orchestrator persists to `feed_posts` columns.
 */
export async function localizeFeedPost(
  input: LocalizeInput,
  context: LocalizerContext,
  deps: LocalizerDeps,
): Promise<{ result: LocalizeResult; patch: LocalizerOutputPatch }> {
  const targets = input.targets ?? SUPPORTED_LANGUAGES
  const now = (deps.now ?? (() => new Date()))()
  const ai = deps.ai
  const systemPrompt = deps.systemPrompt

  const versions: LocalizedVersions = { ...(context.localizedVersions ?? {}) }
  const existingMeta = context.metadata ?? {}
  let cacheMap: LocalizationCacheMap = {
    ...((existingMeta.localizationCache as LocalizationCacheMap | undefined) ?? {}),
  }

  let cacheHits = 0
  const misses: SupportedLanguage[] = []

  for (const target of targets) {
    const lookupResult = lookup({
      metadata: existingMeta,
      localizedVersions: context.localizedVersions,
      englishMaster: input.englishMaster,
      target,
      now: () => now,
    })
    if (lookupResult.hit && lookupResult.cached) {
      versions[target] = lookupResult.cached
      cacheHits += 1
    } else {
      misses.push(target)
    }
  }

  let generated = 0
  if (misses.length > 0) {
    const fresh = await translateBatch(ai, systemPrompt, input.englishMaster, misses)
    for (const target of misses) {
      const entry = fresh[target]
      if (!entry) continue
      versions[target] = entry
      cacheMap = markFresh(cacheMap, target, input.englishMaster, now)
      generated += 1
    }
  }

  const patch: LocalizerOutputPatch = {
    localizedVersions: versions,
    cardMetadata: { ...existingMeta, localizationCache: cacheMap },
  }

  return {
    result: {
      feedPostId: input.feedPostId,
      cacheHits,
      generated,
      versions,
    },
    patch,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// internals
// ────────────────────────────────────────────────────────────────────────────

async function translateBatch(
  ai: LocalizerAi,
  systemPrompt: string,
  englishMaster: { title: string; summary: string },
  targets: SupportedLanguage[],
): Promise<Partial<Record<SupportedLanguage, LocalizedCardEntry>>> {
  const userPayload = JSON.stringify({
    title: englishMaster.title,
    summary: englishMaster.summary,
    body: '',
    targets,
  })

  let raw = ''
  try {
    raw = await ai('multilang', systemPrompt, userPayload)
  } catch {
    return {}
  }

  return parseMultilangResponse(raw, targets)
}

export function parseMultilangResponse(
  raw: string,
  targets: SupportedLanguage[],
): Partial<Record<SupportedLanguage, LocalizedCardEntry>> {
  const out: Partial<Record<SupportedLanguage, LocalizedCardEntry>> = {}
  if (!raw) return out

  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) return out

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
  } catch {
    return out
  }
  if (!parsed || typeof parsed !== 'object') return out

  const obj = parsed as Record<string, unknown>
  for (const lang of targets) {
    const entry = obj[lang]
    if (!entry || typeof entry !== 'object') continue
    const e = entry as { title?: unknown; summary?: unknown }
    if (typeof e.title === 'string' && typeof e.summary === 'string') {
      out[lang] = { title: e.title, summary: e.summary }
    }
  }
  return out
}
