import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

type SaveRunPayload = {
  runId?: string | null
  status?: 'running' | 'completed' | 'error' | 'stopped'
  startedAt?: string | number | null
  completedAt?: string | number | null
  durationMs?: number | null
  logs?: unknown[]
  errorMessage?: string | null
  summary?: {
    scoutItemsCount?: number
    filterItemsCount?: number
    curatedItemsCount?: number
    clusteredItemsCount?: number
    enrichedItemsCount?: number
    avgMomentum?: number | null
    avgViralScore?: number | null
    uniqueSources?: number | null
  }
  scoutItems?: Array<{
    id?: string
    title: string
    source: string
    category?: string | null
    url: string
    momentum: number
    entities?: number
    links?: number
    relevance?: number
    viralScore: number
    status?: 'fresh' | 'curated' | 'clustered' | 'enriched'
    metadata?: Record<string, unknown>
    timestamp?: string
  }>
}

function toIso(input?: string | number | null): string | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return new Date(input).toISOString()
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function POST(request: Request) {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() ?? authClient

  let body: SaveRunPayload
  try {
    body = (await request.json()) as SaveRunPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const startedAt = toIso(body.startedAt) ?? new Date().toISOString()
  const completedAt = toIso(body.completedAt)

  const summary = body.summary ?? {}
  const status = body.status ?? 'completed'

  try {
    const upsertPayload = {
      id: body.runId ?? undefined,
      user_id: user.id,
      started_at: startedAt,
      completed_at: completedAt,
      status,
      duration_ms: body.durationMs ?? null,
      scout_items_count: summary.scoutItemsCount ?? 0,
      filter_items_count: summary.filterItemsCount ?? 0,
      curated_items_count: summary.curatedItemsCount ?? 0,
      clustered_items_count: summary.clusteredItemsCount ?? 0,
      enriched_items_count: summary.enrichedItemsCount ?? 0,
      avg_momentum: summary.avgMomentum ?? null,
      avg_viral_score: summary.avgViralScore ?? null,
      unique_sources: summary.uniqueSources ?? null,
      logs: body.logs ?? [],
      error_message: body.errorMessage ?? null,
    }

    const { data: run, error: runError } = await db
      .from('pipeline_runs')
      .upsert(upsertPayload)
      .select('id')
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { error: runError?.message ?? 'Failed to save pipeline run' },
        { status: 500 }
      )
    }

    const scoutItems = body.scoutItems ?? []
    if (scoutItems.length > 0) {
      const itemsPayload = scoutItems.map((item) => ({
        run_id: run.id,
        user_id: user.id,
        title: item.title,
        source: item.source,
        category: item.category ?? null,
        url: item.url,
        momentum: item.momentum,
        entities_count: item.entities ?? 0,
        cross_references: item.links ?? 0,
        relevance: item.relevance ?? 0,
        viral_score: item.viralScore,
        status: item.status ?? 'fresh',
        status_history: [],
        metadata: item.metadata ?? {},
      }))

      const { error: deleteError } = await db
        .from('scout_items_results')
        .delete()
        .eq('run_id', run.id)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      const { error: itemsError } = await db
        .from('scout_items_results')
        .insert(itemsPayload)

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, runId: run.id, itemsSaved: scoutItems.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist pipeline run'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
