// ─── Ollama Provider ───────────────────────────────────────────────────────────
// Self-hosted AI via Ollama — zero cost, runs locally.
// Implements the same output contracts as lib/pipeline/ai.ts (Groq implementations).
// Uses /api/chat endpoint (messages format) for consistent prompt handling.

import { PROMPTS } from '@/lib/pipeline/prompts'
import type { TranslationOutput, JournalistOutput, QualityResult, ArticleSection, StoryInput } from '@/lib/pipeline/ai'

// ─── Config ───────────────────────────────────────────────────────────────────

export const OLLAMA_MODELS: Record<string, string> = {
  ollama_mistral: 'mistral:7b',
  ollama_llama3:  'llama3.2:3b',
}

// Smaller models need smaller batches to maintain quality
const BATCH_SIZES: Record<string, number> = {
  'mistral:7b':   5,
  'llama3.2:3b':  3,
}

// Ollama is local — allow longer timeouts (models generate slowly)
const TIMEOUT_MS: Record<string, number> = {
  'mistral:7b':  90_000,
  'llama3.2:3b': 60_000,
}

function getOllamaUrl(): string {
  return process.env.OLLAMA_URL ?? 'http://localhost:11434'
}

// ─── Low-level chat call ──────────────────────────────────────────────────────

type OllamaChatResponse = {
  model:             string
  message:           { role: string; content: string }
  done:              boolean
  prompt_eval_count?: number
  eval_count?:        number
}

type CallOptions = {
  temperature?: number
  maxTokens?:   number
}

export async function callOllama(
  model:   string,
  system:  string,
  user:    string,
  options: CallOptions = {},
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const url     = getOllamaUrl()
  const timeout = TIMEOUT_MS[model] ?? 60_000

  const body = {
    model,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
      num_predict: options.maxTokens   ?? 2048,
    },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
  }

  const res = await fetch(`${url}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(timeout),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = await res.json() as OllamaChatResponse
  const text = data.message?.content?.trim() ?? ''

  return {
    text,
    promptTokens:     data.prompt_eval_count ?? 0,
    completionTokens: data.eval_count        ?? 0,
  }
}

// ─── Translation ──────────────────────────────────────────────────────────────

type RawInput = { title: string; content: string | null }

export async function ollamaBatchTranslate(
  items: RawInput[],
  model: string,
): Promise<TranslationOutput[]> {
  const fallback = (): TranslationOutput[] =>
    items.map((i) => ({ lang_detected: 'en', title_en: i.title, content_en: i.content ?? '' }))

  if (!items.length) return fallback()

  const batchSize = BATCH_SIZES[model] ?? 5
  const results: TranslationOutput[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)

    const prompt = batch
      .map((item, idx) =>
        `[${idx}] TITLE: ${item.title.slice(0, 200)}\nCONTENT: ${(item.content ?? '').slice(0, 300)}`
      )
      .join('\n\n')

    try {
      const { text } = await callOllama(model, PROMPTS.TRANSLATOR, prompt, {
        temperature: 0.1,
        maxTokens:   batchSize * 300,
      })

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const parsed = JSON.parse(jsonMatch?.[0] ?? text) as TranslationOutput[]

      if (Array.isArray(parsed) && parsed.length === batch.length) {
        results.push(
          ...parsed.map((t, idx) => ({
            lang_detected: t.lang_detected || 'unknown',
            title_en:      t.title_en      || batch[idx].title,
            content_en:    t.content_en    || batch[idx].content || '',
          }))
        )
      } else {
        results.push(...batch.map((b) => ({ lang_detected: 'unknown', title_en: b.title, content_en: b.content ?? '' })))
      }
    } catch {
      results.push(...batch.map((b) => ({ lang_detected: 'unknown', title_en: b.title, content_en: b.content ?? '' })))
    }
  }

  return results
}

// ─── Journalist writer ────────────────────────────────────────────────────────

export async function ollamaWriteJournalistArticle(
  story: StoryInput,
  model: string,
): Promise<JournalistOutput> {
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

  const contextBlock = story.merged_context
    .map((s, i) => `[${i + 1}] ${s}`)
    .join('\n')

  const prompt = [
    `ENTITY: ${story.main_entity}`,
    `TITLE: ${story.title}`,
    `CATEGORY: ${story.category}`,
    `SOURCE COUNT: ${story.sources.length}`,
    `CONTEXT ITEMS: ${story.merged_context.length}`,
    '',
    'MERGED CONTEXT:',
    contextBlock || story.title,
  ].join('\n')

  try {
    const { text } = await callOllama(model, PROMPTS.JOURNALIST_WRITER, prompt, {
      temperature: 0.3,
      maxTokens:   2048,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as Partial<JournalistOutput> & {
      sections?: ArticleSection[]
    }

    const sections: ArticleSection[] = Array.isArray(parsed.sections)
      ? parsed.sections.filter((s): s is ArticleSection => Boolean(s?.heading && s?.content))
      : [{ heading: 'Intro', content: fallbackLong }]

    const long_version = sections.map((s) => s.content).join('\n\n')
    if (!parsed.short_version || long_version.split(/\s+/).length < 30) return fallback

    return {
      title:         parsed.title        || story.title,
      short_version: parsed.short_version,
      long_version,
      sections,
      key_points:    Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 6) : [],
      tags:          Array.isArray(parsed.tags)        ? parsed.tags.slice(0, 8)       : [story.category],
      media_hint:    parsed.media_hint === 'video'     ? 'video' : 'image',
      confidence:    story.confidence,
    }
  } catch {
    return fallback
  }
}

// ─── Quality check + fixer ────────────────────────────────────────────────────

export async function ollamaCheckAndFix(
  article: string,
  model:   string,
): Promise<QualityResult> {
  try {
    const { text: checkText } = await callOllama(
      model,
      PROMPTS.QUALITY_CHECK,
      article.slice(0, 1200),
      { temperature: 0.1, maxTokens: 256 },
    )

    const checkMatch = checkText.match(/\{[\s\S]*\}/)
    const check = JSON.parse(checkMatch?.[0] ?? checkText) as { status: 'OK' | 'FIX'; issues?: string[] }

    if (check.status !== 'FIX') {
      return { article, fixed: false, issues: [] }
    }

    const { text: fixText } = await callOllama(
      model,
      PROMPTS.QUALITY_FIX,
      article.slice(0, 1200),
      { temperature: 0.2, maxTokens: 1200 },
    )

    const fixMatch = fixText.match(/\{[\s\S]*\}/)
    const fix = JSON.parse(fixMatch?.[0] ?? fixText) as { article_fixed?: string }

    return {
      article: fix.article_fixed || article,
      fixed:   true,
      issues:  Array.isArray(check.issues) ? check.issues : [],
    }
  } catch {
    return { article, fixed: false, issues: [] }
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkOllamaHealth(model: string): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const url   = getOllamaUrl()
  const start = Date.now()

  try {
    const res = await fetch(`${url}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(15_000),
      body:    JSON.stringify({ model, prompt: 'Say "ok"', stream: false }),
    })

    const latency_ms = Date.now() - start
    if (!res.ok) return { ok: false, latency_ms, error: `HTTP ${res.status}` }
    return { ok: true, latency_ms }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
  }
}
