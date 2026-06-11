// Translation engine core.
// Flow: detect → EN skip OR cache hit → route → translate (primary → fallback) → cache set → log job → return
// Two modes: 'pipeline' (machine normalization) and 'publishing' (cultural adaptation).

import { detectLanguage } from './languageDetector'
import { chunkText, recombineChunks } from './chunker'
import { makeTranslationHash, getCachedTranslation, setCachedTranslation, type CachedTranslation } from './cache'
import { routeTranslation } from './routing/aiRouter'
import { logTranslationJob } from './logs/translationHistory'
import { isDeepLAvailable, translateWithDeepL } from './providers/deeplProvider'
import { PIPELINE_TRANSLATION_SYSTEM, PUBLISHING_TRANSLATION_SYSTEM } from '@/lib/pipeline/prompts'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { TranslationProvider, TranslationRequest } from './providers/types'

// Languages where DeepL outperforms generic LLMs (Slavic morphology, accents, slang)
const DEEPL_PREFERRED_LANGS = new Set(['cs', 'sk', 'pl'])

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export type TranslationMode   = 'pipeline' | 'publishing'
export type TranslationStatus = 'done' | 'failed' | 'fallback_used' | 'skipped'

export type TranslationInput = {
  title:    string
  summary?: string | null
  body?:    string | null
  tags?:    string[]
}

export type TranslationOutput = {
  title_en:           string
  summary_en:         string | null
  body_en:            string | null
  tags_en:            string[]
  detected_lang:      string
  lang_confidence:    number
  translation_status: TranslationStatus
  cache_hit:          boolean
  provider:           string
  tokens_used:        number
}

// ─── Provider call with retry + fallback chain ───────────────────────────────

const RATE_LIMIT_CODES = ['429', 'rate', 'too many', 'quota']

function isRateLimit(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return RATE_LIMIT_CODES.some(k => msg.includes(k))
}

async function callWithRetry(
  provider: TranslationProvider,
  req: TranslationRequest,
  maxRetries = 2,
): Promise<{ text: string; tokens: number }> {
  let delay = 1500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.call(req)
    } catch (err) {
      if (attempt < maxRetries && isRateLimit(err)) {
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error(`${provider.name}: all retries exhausted`)
}

async function callWithFallback(
  primary: TranslationProvider,
  fallback: TranslationProvider,
  req: TranslationRequest,
): Promise<{ text: string; tokens: number; provider: string; used_fallback: boolean }> {
  try {
    const res = await callWithRetry(primary, req)
    return { ...res, provider: primary.name, used_fallback: false }
  } catch (primaryErr) {
    console.warn(`TRANSLATION: primary ${primary.name} failed — trying fallback`, primaryErr)
    try {
      const res = await callWithRetry(fallback, req)
      return { ...res, provider: fallback.name, used_fallback: true }
    } catch (fallbackErr) {
      console.error(`TRANSLATION: fallback ${fallback.name} also failed`, fallbackErr)
      throw fallbackErr
    }
  }
}

function parseTranslationJSON(raw: string): Partial<CachedTranslation> {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0])
  } catch {
    return {}
  }
}

// ─── Body chunked translation ─────────────────────────────────────────────────

async function translateBody(
  body: string,
  sourceLang: string,
  systemPrompt: string,
  primary: TranslationProvider,
  fallback: TranslationProvider,
): Promise<{ translated: string; tokens: number; used_fallback: boolean }> {
  const chunks = chunkText(body)
  let totalTokens = 0
  let usedFallback = false
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const req: TranslationRequest = {
      systemPrompt,
      userContent: `Translate this body text from ${sourceLang} to English. Return ONLY the translated text, no JSON wrapper:\n\n${chunk}`,
    }
    const res = await callWithFallback(primary, fallback, req)
    translatedChunks.push(res.text.trim())
    totalTokens  += res.tokens
    if (res.used_fallback) usedFallback = true
  }

  return { translated: recombineChunks(translatedChunks), tokens: totalTokens, used_fallback: usedFallback }
}

// ─── Core: translate one item ─────────────────────────────────────────────────

export async function translateItem(
  db: PipelineDbClient,
  input: TranslationInput,
  mode: TranslationMode = 'pipeline',
  targetLang = 'en',
): Promise<TranslationOutput> {
  const combinedText = [input.title, input.summary, input.body].filter(Boolean).join(' ')
  const detection    = detectLanguage(combinedText)

  const base = {
    detected_lang:   detection.detected,
    lang_confidence: detection.confidence,
  }

  // Layer 1: EN passthrough — no API cost
  if (detection.skip_translation && targetLang === 'en') {
    return {
      ...base,
      title_en:           input.title,
      summary_en:         input.summary  ?? null,
      body_en:            input.body     ?? null,
      tags_en:            input.tags     ?? [],
      translation_status: 'skipped',
      cache_hit:          false,
      provider:           'passthrough',
      tokens_used:        0,
    }
  }

  // Layer 2: Cache check
  const cacheKey = makeTranslationHash(combinedText, detection.detected, targetLang)
  const cached   = await getCachedTranslation(db, cacheKey)

  if (cached) {
    return {
      ...base,
      title_en:           cached.title_en   ?? input.title,
      summary_en:         cached.summary_en ?? null,
      body_en:            cached.body_en    ?? null,
      tags_en:            cached.tags_en    ?? [],
      translation_status: 'done',
      cache_hit:          true,
      provider:           'cache',
      tokens_used:        0,
    }
  }

  // Layer 2.5: DeepL fast lane — higher accuracy for CZ/SK/PL, no token cost
  if (DEEPL_PREFERRED_LANGS.has(detection.detected) && isDeepLAvailable()) {
    try {
      const dl = await translateWithDeepL(input, detection.detected)
      const cacheResult: CachedTranslation = { title_en: dl.title_en, summary_en: dl.summary_en, body_en: dl.body_en, tags_en: dl.tags_en }
      await setCachedTranslation(db, cacheKey, detection.detected, combinedText, cacheResult, targetLang).catch(() => {})
      await logTranslationJob(db, { status: 'done', source_lang: detection.detected, target_lang: targetLang, provider: 'deepl', tokens_used: 0 })
      return {
        ...base,
        ...dl,
        translation_status: 'done',
        cache_hit:          false,
        provider:           'deepl',
        tokens_used:        0,
      }
    } catch (deeplErr) {
      console.warn('TRANSLATION: DeepL failed, falling back to LLM', deeplErr)
      // fall through to layer 3
    }
  }

  // Layer 3: Route to provider + model
  const systemPrompt = mode === 'publishing' ? PUBLISHING_TRANSLATION_SYSTEM : PIPELINE_TRANSLATION_SYSTEM
  const { primary, fallback } = routeTranslation(combinedText.length)

  let totalTokens  = 0
  let titleEn      = input.title
  let summaryEn    = input.summary  ?? null
  let bodyEn       = input.body     ?? null
  let tagsEn       = input.tags     ?? []
  let status: TranslationStatus = 'done'
  let providerUsed = primary.name
  let usedFallback = false

  try {
    if (input.body && input.body.length > 3000) {
      // Large body: translate title+summary fast, body in chunks
      const smallReq: TranslationRequest = {
        systemPrompt,
        userContent: `Translate from ${detection.detected} to English. Return JSON with title_en, summary_en, tags_en:\n${JSON.stringify({ title: input.title, summary: input.summary ?? '', tags: input.tags ?? [] })}`,
      }
      const smallRes = await callWithFallback(primary, fallback, smallReq)
      totalTokens += smallRes.tokens
      if (smallRes.used_fallback) usedFallback = true
      const smallParsed = parseTranslationJSON(smallRes.text)
      if (smallParsed.title_en)   titleEn   = smallParsed.title_en
      if (smallParsed.summary_en) summaryEn = smallParsed.summary_en
      if (smallParsed.tags_en)    tagsEn    = smallParsed.tags_en

      const bodyRes = await translateBody(input.body, detection.detected, systemPrompt, primary, fallback)
      bodyEn       = bodyRes.translated
      totalTokens += bodyRes.tokens
      if (bodyRes.used_fallback) usedFallback = true

    } else {
      // Small/medium: single call for all fields
      const req: TranslationRequest = {
        systemPrompt,
        userContent: `Translate from ${detection.detected} to English:\n${JSON.stringify({ title: input.title, summary: input.summary ?? '', body: input.body ?? '', tags: input.tags ?? [] })}`,
      }
      const res = await callWithFallback(primary, fallback, req)
      totalTokens += res.tokens
      if (res.used_fallback) usedFallback = true
      const parsed = parseTranslationJSON(res.text)
      if (parsed.title_en)   titleEn   = parsed.title_en
      if (parsed.summary_en) summaryEn = parsed.summary_en
      if (parsed.body_en)    bodyEn    = parsed.body_en
      if (parsed.tags_en)    tagsEn    = parsed.tags_en
    }

    if (usedFallback) {
      status       = 'fallback_used'
      providerUsed = fallback.name
    }

  } catch (err) {
    console.error('TRANSLATION ENGINE ERROR:', err)
    status       = 'failed'
    providerUsed = 'passthrough'
    // Return original on total failure — never block pipeline
  }

  // Layer 4 (pipeline mode): write to cache
  if (status === 'done' || status === 'fallback_used') {
    const result: CachedTranslation = { title_en: titleEn, summary_en: summaryEn, body_en: bodyEn, tags_en: tagsEn }
    await setCachedTranslation(db, cacheKey, detection.detected, combinedText, result, targetLang).catch(() => {})
  }

  // Log to translation_jobs
  await logTranslationJob(db, {
    status:      status,
    source_lang: detection.detected,
    target_lang: targetLang,
    provider:    providerUsed,
    tokens_used: totalTokens,
    error:       status === 'failed' ? 'All providers failed' : undefined,
  })

  return {
    ...base,
    title_en:           titleEn,
    summary_en:         summaryEn,
    body_en:            bodyEn,
    tags_en:            tagsEn,
    translation_status: status,
    cache_hit:          false,
    provider:           providerUsed,
    tokens_used:        totalTokens,
  }
}

// ─── Batch with concurrency cap ───────────────────────────────────────────────

export async function translateBatch(
  db: PipelineDbClient,
  items: TranslationInput[],
  mode: TranslationMode = 'pipeline',
  concurrency = 3,
): Promise<TranslationOutput[]> {
  const results: TranslationOutput[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const slice   = items.slice(i, i + concurrency)
    const settled = await Promise.allSettled(slice.map(item => translateItem(db, item, mode)))

    for (let j = 0; j < settled.length; j++) {
      const s = settled[j]
      if (s.status === 'fulfilled') {
        results.push(s.value)
      } else {
        results.push({
          title_en:           items[i + j].title,
          summary_en:         items[i + j].summary ?? null,
          body_en:            items[i + j].body    ?? null,
          tags_en:            items[i + j].tags    ?? [],
          detected_lang:      'unknown',
          lang_confidence:    0,
          translation_status: 'failed',
          cache_hit:          false,
          provider:           'passthrough',
          tokens_used:        0,
        })
      }
    }
  }

  return results
}
