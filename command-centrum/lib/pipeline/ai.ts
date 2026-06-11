import { callAI, getAiUsage, resetAiUsage } from '@/lib/ai/call'
import {
  PROMPTS,
  PIPELINE_SYSTEM,
  WRITER_SYSTEM,
  LOCALIZER_SYSTEM,
  TRANSLATOR_SYSTEM,
  MULTILANG_FULL_SYSTEM,
  QUALITY_CHECK_SYSTEM,
  QUALITY_FIX_SYSTEM,
  ENTITY_SYSTEM,
  WRITER_V2_SYSTEM,
} from './prompts'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'
import {
  detectCzSk,
  scoreTranslationConfidence,
  TtlCache,
  translationCacheKey,
} from './translation-quality'
import { logger } from '@/lib/logger'

// Re-export for callers that import PIPELINE_SYSTEM from here
export { PIPELINE_SYSTEM }
export { callAI }

// ─── Token tracking (delegates to lib/ai/call) ───────────────────────────────

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  calls: number
  estimatedCostUsd: number
}

export function resetUsage() { resetAiUsage() }

export function getUsage(): TokenUsage {
  const u = getAiUsage()
  return {
    promptTokens:     0,           // not tracked per-role with new providers
    completionTokens: 0,
    totalTokens:      u.totalTokens,
    calls:            u.calls,
    estimatedCostUsd: u.estimatedCostUsd,
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CuratedTranslation = {
  language_detected: string
  english_master: string
  tone: string
  category: string
}

export type WriterOutput = {
  final_text_en: string
  style: string
  keywords: string[]
}

export type LocalizerOutput = {
  translated_text: string
  language: string
}

export type TranslationOutput = {
  lang_detected: string
  title_en: string
  content_en: string
  /** 0-1 deterministic quality score (set by batchTranslateToEn). */
  translation_confidence?: number
  /** true when CZ/SK native content was passed through without a Groq call. */
  skipped_translation?: boolean
}

export type MultilangFullEntry = { title: string; summary: string; body: string }
export type MultilangFullOutput = Record<string, MultilangFullEntry>

export type StoryInput = {
  cluster_id: string
  main_entity: string
  category: string
  title: string
  sources: Array<{ source: string; url: string | null; text: string | null }>
  merged_context: string[]
  confidence: number
  spotifyUrl?:  string | null
  youtubeUrl?:  string | null
  imageUrl?:    string | null
  publishedAt?: string | null
}

export type ArticleOutput = {
  final_article: string
  summary: string
  tags: string[]
  confidence: number
}

export type ArticleSection = { heading: string; content: string }

export type JournalistOutput = {
  title: string
  short_version: string
  long_version: string
  sections: ArticleSection[]
  key_points: string[]
  tags: string[]
  media_hint: 'video' | 'image'
  confidence: number
}

export type ShortLongOutput = {
  short_text: string
  long_text: string
  tags: string[]
  media_hint: 'video' | 'image'
  confidence: number
}

export type EntityOutput = {
  artists: string[]
  tracks: string[]
  albums: string[]
  brands: string[]
  locations: string[]
  other: string[]
}

export type QualityResult = {
  article: string
  fixed: boolean
  issues: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(raw: string, pattern: RegExp): Partial<T> | null {
  try {
    const match = raw.match(pattern)
    return match ? (JSON.parse(match[0]) as T) : null
  } catch {
    return null
  }
}

// ─── rewriteForFeed ───────────────────────────────────────────────────────────

export async function rewriteForFeed(title: string, content: string, category: string): Promise<WriterOutput> {
  const fallback: WriterOutput = { final_text_en: content, style: 'informative', keywords: [] }

  try {
    const raw = await callAI(
      'writer',
      WRITER_SYSTEM,
      `TITLE: ${title}\nCONTENT: ${content.slice(0, 800)}\nCATEGORY: ${category}`,
      { maxTokens: 1024 }
    )
    if (!raw) return fallback
    const parsed = parseJSON<WriterOutput>(raw, /\{[\s\S]*\}/)
    return parsed && parsed.final_text_en
      ? (parsed as WriterOutput)
      : fallback
  } catch {
    return fallback
  }
}

// ─── localizeText ─────────────────────────────────────────────────────────────

export async function localizeText(text: string, targetLanguage: string): Promise<LocalizerOutput> {
  const fallback: LocalizerOutput = { translated_text: text, language: targetLanguage }

  try {
    const raw = await callAI(
      'multilang',
      LOCALIZER_SYSTEM,
      `TARGET LANGUAGE: ${targetLanguage}\n\nCONTENT:\n${text}`,
      { maxTokens: 1024 }
    )
    if (!raw) return fallback
    const parsed = parseJSON<LocalizerOutput>(raw, /\{[\s\S]*\}/)
    return parsed && parsed.translated_text ? (parsed as LocalizerOutput) : fallback
  } catch {
    return fallback
  }
}

// ─── batchTranslateToEn ───────────────────────────────────────────────────────

// 24h TTL cache of completed translations (UM-TRANSLATOR+1 #5). Process-local
// stand-in for Redis — reduces repeat Groq calls across pipeline runs.
const translationCache = new TtlCache<TranslationOutput>()

type TranslateItem = { title: string; content: string | null; category?: string }

export async function batchTranslateToEn(
  items: TranslateItem[]
): Promise<TranslationOutput[]> {
  if (items.length === 0) return []

  // Per-item fallback: pass the original through, scored as a failed translation.
  const passThrough = (item: TranslateItem): TranslationOutput => ({
    lang_detected: 'en',
    title_en: item.title,
    content_en: item.content ?? '',
    translation_confidence: 1,
  })

  // Pre-pass: resolve CZ/SK skips (#3) and cache hits (#5); collect the rest.
  const results: Array<TranslationOutput | null> = new Array(items.length).fill(null)
  const pending: Array<{ index: number; item: TranslateItem; key: string }> = []

  items.forEach((item, i) => {
    const source = `${item.title} ${item.content ?? ''}`
    const czsk = detectCzSk(source)
    if (czsk) {
      // Native CZ/SK: copy to english_master with a tag, no Groq call.
      results[i] = {
        lang_detected: czsk,
        title_en: item.title,
        content_en: item.content ?? '',
        translation_confidence: 1,
        skipped_translation: true,
      }
      return
    }
    const key = translationCacheKey(item.title, item.content)
    const cached = translationCache.get(key)
    if (cached) {
      results[i] = cached
      return
    }
    pending.push({ index: i, item, key })
  })

  // Translate the remaining items via Groq in one batch.
  if (pending.length > 0) {
    const prompt = pending
      .map((p, i) => {
        const parts = [`[${i}] TITLE: ${p.item.title.slice(0, 200)}`]
        if (p.item.category) parts.push(`CATEGORY: ${p.item.category}`)
        parts.push(`CONTENT: ${(p.item.content ?? '').slice(0, 1200)}`)
        return parts.join('\n')
      })
      .join('\n\n')

    let parsed: TranslationOutput[] | null = null
    try {
      const raw = await callAI('translation', TRANSLATOR_SYSTEM, prompt, { maxTokens: 4096 })
      if (raw) {
        const p = parseJSON<TranslationOutput[]>(raw, /\[[\s\S]*\]/) as TranslationOutput[] | null
        if (Array.isArray(p) && p.length === pending.length) parsed = p
      }
    } catch {
      // fall through — handled per-item below
    }

    pending.forEach((p, i) => {
      const t = parsed?.[i]
      if (!t) {
        // Groq failed for this batch: fall back to the original (#1 fallback).
        results[p.index] = passThrough(p.item)
        return
      }
      const lang = t.lang_detected || 'unknown'
      const titleEn = t.title_en || p.item.title
      const contentEn = t.content_en || p.item.content || ''
      const confidence = scoreTranslationConfidence(
        `${p.item.title} ${p.item.content ?? ''}`,
        `${titleEn} ${contentEn}`,
        lang,
      )
      const out: TranslationOutput = {
        lang_detected: lang,
        title_en: titleEn,
        content_en: contentEn,
        translation_confidence: confidence,
      }
      results[p.index] = out
      // Only cache trustworthy translations.
      if (confidence >= 0.5) translationCache.set(p.key, out)
    })
  }

  // Guarantee a value for every slot (#1: never crash, always return a draft).
  const final = results.map((r, i) => r ?? passThrough(items[i]))

  // Per-item translation_confidence logging (UM-TRANSLATOR+1 #4 DoD).
  const skipped = final.filter((r) => r.skipped_translation).length
  const confidences = final.map((r) => r.translation_confidence ?? 0)
  const avg = confidences.reduce((s, c) => s + c, 0) / final.length
  logger.info('translation_batch_complete', {
    items: final.length,
    groqTranslated: pending.length,
    czskSkipped: skipped,
    cacheHits: items.length - pending.length - skipped,
    cacheSize: translationCache.size,
    avgConfidence: Number(avg.toFixed(2)),
    lowConfidence: confidences.filter((c) => c < 0.5).length,
  })

  return final
}

// ─── multilangTranslateFull ───────────────────────────────────────────────────

export async function multilangTranslateFull(
  title: string,
  summary: string,
  body: string,
  languages: string[]
): Promise<MultilangFullOutput> {
  const fallback = () =>
    Object.fromEntries(languages.map((l) => [l, { title, summary, body }]))

  if (languages.length === 0) return fallback()

  const truncatedBody = body.slice(0, 3000)
  const BATCH_SIZE = 4
  const result: MultilangFullOutput = {}

  for (let i = 0; i < languages.length; i += BATCH_SIZE) {
    const batch = languages.slice(i, i + BATCH_SIZE)
    try {
      const raw = await callAI(
        'multilang',
        MULTILANG_FULL_SYSTEM,
        `TARGET LANGUAGES: ${batch.join(', ')}\n\nTITLE: ${title.slice(0, 200)}\n\nSUMMARY: ${summary.slice(0, 300)}\n\nBODY:\n${truncatedBody}`,
        { maxTokens: 3000 }
      )
      if (!raw) {
        for (const lang of batch) result[lang] = { title, summary, body }
        continue
      }
      const parsed = parseJSON<MultilangFullOutput>(raw, /\{[\s\S]*\}/)
      for (const lang of batch) {
        const entry = parsed?.[lang]
        result[lang] = (entry && typeof entry === 'object') ? (entry as MultilangFullEntry) : { title, summary, body }
      }
    } catch {
      for (const lang of batch) result[lang] = { title, summary, body }
    }
  }

  return result
}

// ─── writeStoryArticle ────────────────────────────────────────────────────────

export async function writeStoryArticle(story: StoryInput): Promise<ArticleOutput> {
  const fallback: ArticleOutput = {
    final_article: story.merged_context.join(' ') || story.title,
    summary:    story.title,
    tags:       [story.category],
    confidence: story.confidence,
  }

  const contextBlock = story.merged_context.map((s, i) => `[${i + 1}] ${s}`).join('\n')
  const prompt = [
    `ENTITY: ${story.main_entity}`,
    `TITLE: ${story.title}`,
    `CATEGORY: ${story.category}`,
    `SOURCE COUNT: ${story.sources.length}`,
    `CONFIDENCE: ${story.confidence.toFixed(2)}`,
    '',
    'MERGED CONTEXT:',
    contextBlock || story.title,
  ].join('\n')

  try {
    const raw = await callAI('writer', WRITER_V2_SYSTEM, prompt, { maxTokens: 4096, temperature: 0.35 })
    if (!raw) return fallback
    const parsed = parseJSON<ArticleOutput>(raw, /\{[\s\S]*\}/)
    if (parsed?.final_article) {
      return {
        final_article: parsed.final_article,
        summary:    parsed.summary    || story.title,
        tags:       Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [story.category],
        confidence: story.confidence,
      }
    }
  } catch {
    // fall through
  }

  return fallback
}

// ─── writeJournalistArticle ───────────────────────────────────────────────────

export async function writeJournalistArticle(story: StoryInput, options: PipelineOptions = {}): Promise<JournalistOutput> {
  const fallbackLong = story.merged_context.join('\n\n') || story.title
  const fallback: JournalistOutput = {
    title:         story.title,
    short_version: story.title,
    long_version:  fallbackLong,
    sections:      [{ heading: 'Intro', content: fallbackLong }],
    key_points:    [],
    tags:          [story.category],
    media_hint:    'image',
    confidence:    story.confidence,
  }

  const contextLimit = options.testMode ? TEST_MODE_CONFIG.writer_context_items : story.merged_context.length
  const contextCharLimit = options.testMode ? TEST_MODE_CONFIG.ai_input_chars : Number.MAX_SAFE_INTEGER
  const contextBlock = story.merged_context
    .slice(0, contextLimit)
    .map((s, i) => `[${i + 1}] ${s.slice(0, contextCharLimit)}`)
    .join('\n')
  const prompt = [
    `ENTITY: ${story.main_entity}`,
    `TITLE: ${story.title}`,
    `CATEGORY: ${story.category}`,
    `SOURCE COUNT: ${story.sources.length}`,
    `CONTEXT ITEMS: ${story.merged_context.length}`,
    story.spotifyUrl  ? `HAS SPOTIFY: yes`                : '',
    story.youtubeUrl  ? `HAS VIDEO: yes`                  : '',
    story.imageUrl    ? `HAS IMAGE: yes`                  : '',
    story.publishedAt ? `PUBLISHED: ${story.publishedAt}` : '',
    story.sources.length > 0
      ? `SOURCES: ${story.sources.map((s) => s.source).join(', ')}`
      : '',
    '',
    'MERGED CONTEXT (pre-deduplicated factual statements from multiple sources):',
    contextBlock || story.title,
  ].filter(Boolean).join('\n')

  try {
    const raw = await callAI('writer', PROMPTS.JOURNALIST_WRITER, prompt, {
      maxTokens: options.testMode ? 1200 : 4096,
      temperature: 0.35,
    })
    if (!raw) return fallback

    const parsed = parseJSON<JournalistOutput & { sections?: ArticleSection[] }>(raw, /\{[\s\S]*\}/)
    if (!parsed) return fallback

    const sections: ArticleSection[] = Array.isArray(parsed.sections)
      ? parsed.sections.filter((s) => s?.heading && s?.content)
      : [{ heading: 'Intro', content: fallbackLong }]

    const long_version = sections.map((s) => s.content).join('\n\n')
    const wordCount    = long_version.split(/\s+/).length
    if (!parsed.short_version || wordCount < 100) return fallback

    return {
      title:         parsed.title         || story.title,
      short_version: parsed.short_version,
      long_version,
      sections,
      key_points:    Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, options.testMode ? 3 : 6) : [],
      tags:          Array.isArray(parsed.tags)       ? parsed.tags.slice(0, options.testMode ? TEST_MODE_CONFIG.max_entities : 8)       : [story.category],
      media_hint:    parsed.media_hint === 'video'    ? 'video'                        : 'image',
      confidence:    story.confidence,
    }
  } catch {
    return fallback
  }
}

// ─── writeShortAndLong ────────────────────────────────────────────────────────

export async function writeShortAndLong(story: StoryInput): Promise<ShortLongOutput> {
  const result = await writeJournalistArticle(story)
  return {
    short_text: result.short_version,
    long_text:  result.long_version,
    tags:       result.tags,
    media_hint: result.media_hint,
    confidence: result.confidence,
  }
}

// ─── extractEntitiesAI ────────────────────────────────────────────────────────

export async function extractEntitiesAI(content: string): Promise<EntityOutput> {
  const fallback: EntityOutput = { artists: [], tracks: [], albums: [], brands: [], locations: [], other: [] }

  try {
    const raw = await callAI('enrichment', ENTITY_SYSTEM, content.slice(0, 600), { maxTokens: 512, temperature: 0.1 })
    if (!raw) return fallback
    const parsed = parseJSON<EntityOutput>(raw, /\{[\s\S]*\}/)
    if (!parsed) return fallback
    return {
      artists:   Array.isArray(parsed.artists)   ? parsed.artists   : [],
      tracks:    Array.isArray(parsed.tracks)    ? parsed.tracks    : [],
      albums:    Array.isArray(parsed.albums)    ? parsed.albums    : [],
      brands:    Array.isArray(parsed.brands)    ? parsed.brands    : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      other:     Array.isArray(parsed.other)     ? parsed.other     : [],
    }
  } catch {
    return fallback
  }
}

// ─── checkAndFixArticle ───────────────────────────────────────────────────────

export async function checkAndFixArticle(article: string): Promise<QualityResult> {
  try {
    const checkRaw = await callAI('final_editor', QUALITY_CHECK_SYSTEM, article.slice(0, 6000), { maxTokens: 256, temperature: 0.1 })
    if (!checkRaw) return { article, fixed: false, issues: [] }

    const check = parseJSON<{ status: 'OK' | 'FIX'; issues?: string[] }>(checkRaw, /\{[\s\S]*\}/)
    if (!check || check.status !== 'FIX') return { article, fixed: false, issues: [] }

    const fixRaw = await callAI('final_editor', QUALITY_FIX_SYSTEM, article.slice(0, 6000), { maxTokens: 5500, temperature: 0.2 })
    if (!fixRaw) return { article, fixed: false, issues: check.issues ?? [] }

    const fix = parseJSON<{ article_fixed?: string }>(fixRaw, /\{[\s\S]*\}/)
    return {
      article: fix?.article_fixed || article,
      fixed:   true,
      issues:  Array.isArray(check.issues) ? check.issues : [],
    }
  } catch {
    return { article, fixed: false, issues: [] }
  }
}
