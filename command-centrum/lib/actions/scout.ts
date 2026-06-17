'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSourceResolver, type SrlDb } from '@/lib/sources/srl'
import type { SourceDefinition } from '@/lib/scout-sources'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { supabase, user }
}

/**
 * PR-S4 #05 — keep the SRL cache coherent with source CRUD.
 *
 * The SourceResolver layer has no write surface, so these legacy server actions
 * stay the CRUD authority (API surface unchanged — the Sources UI is unaffected).
 * What they MUST do is invalidate SRL's cached resolutions for any source whose
 * membership/identity changed, so consumers (workers, enrichment) never serve
 * stale bundles. Effective against the shared Upstash cache in production; a
 * harmless no-op against the per-process in-memory cache in dev. Best-effort —
 * cache hygiene never blocks or fails the mutation.
 */
async function invalidateSrlCache(supabase: unknown, ...sourceIds: string[]): Promise<void> {
  try {
    const srl = createSourceResolver(supabase as SrlDb)
    await Promise.all(sourceIds.map((id) => srl.invalidateCache(id)))
  } catch {
    // cache invalidation is non-critical — swallow
  }
}

// ── Sources ──────────────────────────────────────────────────────────────────

export async function toggleSource(id: string, active: boolean) {
  const { supabase } = await requireAuth()
  const { error } = await supabase
    .from('scout_sources')
    .update({ active })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await invalidateSrlCache(supabase, id)
  revalidatePath('/scout')
  revalidatePath('/scout/sources')
}

export async function addSource(source: Omit<SourceDefinition, never> & { active?: boolean }) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('scout_sources').insert({
    name: source.name,
    url: source.url,
    category: source.category,
    lang: source.lang,
    active: source.active ?? true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/scout/sources')
}

export async function updateSource(
  id: string,
  data: { name?: string; url?: string; category?: string; lang?: string }
) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('scout_sources').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  await invalidateSrlCache(supabase, id)
  revalidatePath('/scout/sources')
}

export async function deleteSource(id: string) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('scout_sources').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await invalidateSrlCache(supabase, id)
  revalidatePath('/scout/sources')
}

export async function bulkToggleSources(ids: string[], active: boolean) {
  const { supabase } = await requireAuth()
  const { error } = await supabase
    .from('scout_sources')
    .update({ active })
    .in('id', ids)
  if (error) throw new Error(error.message)
  await invalidateSrlCache(supabase, ...ids)
  revalidatePath('/scout/sources')
}

// Import all default sources that aren't in DB yet
export async function importDefaultSources(sources: SourceDefinition[]) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('scout_sources').upsert(
    sources.map((s) => ({
      name: s.name,
      url: s.url,
      category: s.category,
      lang: s.lang,
      active: true,
    })),
    { onConflict: 'url', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)
  revalidatePath('/scout/sources')
}

// ── Scout Runs ───────────────────────────────────────────────────────────────

export async function triggerManualRun(activeSourceCount: number): Promise<string> {
  const { supabase } = await requireAuth()
  const { data, error } = await supabase
    .from('scout_runs')
    .insert({
      status: 'running',
      sources_count: activeSourceCount,
      triggered_by: 'manual',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/scout')
  return data.id
}

export async function markRunComplete(
  runId: string,
  itemsFound: number,
  durationMs: number
) {
  const { supabase } = await requireAuth()
  await supabase
    .from('scout_runs')
    .update({
      status: 'complete',
      items_found: itemsFound,
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
  revalidatePath('/scout')
}

export async function markRunError(runId: string, errorMessage: string) {
  const { supabase } = await requireAuth()
  await supabase
    .from('scout_runs')
    .update({
      status: 'error',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
  revalidatePath('/scout')
}

export async function updateSourceHealth(
  url: string,
  health: 'ok' | 'error',
  errorMessage?: string
) {
  const { supabase } = await requireAuth()
  await supabase
    .from('scout_sources')
    .update({
      health,
      error_message: errorMessage ?? null,
      last_fetched_at: new Date().toISOString(),
    })
    .eq('url', url)
}
