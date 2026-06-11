// ─── AI Dispatch Layer ────────────────────────────────────────────────────────
// Provider-agnostic wrappers for pipeline steps.
// Accepts a provider ID + model, delegates to the right implementation.
// New providers: add a branch here — pipeline files stay unchanged.

import { batchTranslateToEn, writeJournalistArticle, checkAndFixArticle } from '@/lib/pipeline/ai'
import { ollamaBatchTranslate, ollamaWriteJournalistArticle, ollamaCheckAndFix, OLLAMA_MODELS } from '@/lib/ai/ollama'
import { haikuWriteJournalistArticle } from '@/lib/ai/anthropic'
import type { TranslationOutput, JournalistOutput, QualityResult, StoryInput } from '@/lib/pipeline/ai'
import type { PipelineOptions } from '@/config/testMode'

type RawInput = { title: string; content: string | null; category?: string }

// ─── Translate ────────────────────────────────────────────────────────────────

export async function translateViaProvider(
  items:      RawInput[],
  providerId: string,
  model?:     string,
): Promise<TranslationOutput[]> {
  const fallback = (): TranslationOutput[] =>
    items.map((i) => ({ lang_detected: 'en', title_en: i.title, content_en: i.content ?? '' }))

  if (!items.length) return fallback()

  if (providerId === 'groq') {
    return batchTranslateToEn(items)
  }

  if (providerId === 'ollama_mistral' || providerId === 'ollama_llama3') {
    const resolvedModel = model ?? OLLAMA_MODELS[providerId] ?? 'mistral:7b'
    return ollamaBatchTranslate(items, resolvedModel)
  }

  // local-rules / fallback — pass through originals unchanged
  return fallback()
}

// ─── Write article ────────────────────────────────────────────────────────────

export async function writeArticleViaProvider(
  story:      StoryInput,
  providerId: string,
  model?:     string,
  options:    PipelineOptions = {},
): Promise<JournalistOutput> {
  if (providerId === 'groq') {
    return writeJournalistArticle(story, options)
  }

  if (providerId === 'ollama_mistral' || providerId === 'ollama_llama3') {
    const resolvedModel = model ?? OLLAMA_MODELS[providerId] ?? 'mistral:7b'
    return ollamaWriteJournalistArticle(story, resolvedModel)
  }

  if (providerId === 'claude_haiku') {
    return haikuWriteJournalistArticle(story)
  }

  // Fallback: use Groq if available, else return bare content
  return writeJournalistArticle(story, options)
}

// ─── Quality check ────────────────────────────────────────────────────────────

export async function checkAndFixViaProvider(
  article:    string,
  providerId: string,
  model?:     string,
): Promise<QualityResult> {
  if (providerId === 'groq') {
    return checkAndFixArticle(article)
  }

  if (providerId === 'ollama_mistral' || providerId === 'ollama_llama3') {
    const resolvedModel = model ?? OLLAMA_MODELS[providerId] ?? 'mistral:7b'
    return ollamaCheckAndFix(article, resolvedModel)
  }

  return checkAndFixArticle(article)
}
