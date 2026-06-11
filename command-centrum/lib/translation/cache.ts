// DB-backed translation cache.
// Key: sha256(source_text|source_lang|target_lang) — provider-agnostic.
// TTL: 7 days (set in schema, purged via cron).

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export type CachedTranslation = {
  title_en:   string | null
  summary_en: string | null
  body_en:    string | null
  tags_en:    string[] | null
}

export function makeTranslationHash(
  sourceText: string,
  sourceLang: string,
  targetLang = 'en',
): string {
  return createHash('sha256')
    .update(`${sourceText}|${sourceLang}|${targetLang}`)
    .digest('hex')
}

export async function getCachedTranslation(
  db: PipelineDbClient,
  hash: string,
): Promise<CachedTranslation | null> {
  const { data, error } = await db
    .from('translation_cache')
    .select('title_en, summary_en, body_en, tags_en')
    .eq('hash', hash)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null
  return data as CachedTranslation
}

export async function setCachedTranslation(
  db: PipelineDbClient,
  hash: string,
  sourceLang: string,
  sourceText: string,
  translation: CachedTranslation,
  targetLang = 'en',
): Promise<void> {
  await db.from('translation_cache').upsert({
    hash,
    source_lang: sourceLang,
    target_lang: targetLang,
    source_text: sourceText.slice(0, 10000), // cap stored text size
    title_en:    translation.title_en,
    summary_en:  translation.summary_en,
    body_en:     translation.body_en,
    tags_en:     translation.tags_en,
    expires_at:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'hash' })
}

export async function purgExpiredCache(db: PipelineDbClient): Promise<number> {
  const { count } = await db
    .from('translation_cache')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())
  return count ?? 0
}
