import type { createAdminClient, createClient } from '@/lib/supabase/server'

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'fallback_used'

export type TranslationJobInsert = {
  article_id?:  string
  status:       JobStatus
  source_lang:  string
  target_lang:  string
  provider:     string
  tokens_used:  number
  error?:       string
}

// Fire-and-forget — never blocks the pipeline.
export async function logTranslationJob(db: DbClient, job: TranslationJobInsert): Promise<void> {
  await db
    .from('translation_jobs')
    .insert({
      article_id:  job.article_id  ?? null,
      status:      job.status,
      source_lang: job.source_lang,
      target_lang: job.target_lang,
      provider:    job.provider,
      tokens_used: job.tokens_used,
      error:       job.error       ?? null,
    })
    .then(() => {}, () => {}) // fire-and-forget, never crash translation
}
