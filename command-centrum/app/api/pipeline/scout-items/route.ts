import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() ?? authClient
  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '100'), 1), 300)

  try {
    let targetRunId = runId

    if (!targetRunId) {
      const { data: latestRun, error: runError } = await db
        .from('pipeline_runs')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (runError) {
        return NextResponse.json({ error: runError.message }, { status: 500 })
      }

      targetRunId = latestRun?.id ?? null
      if (!targetRunId) {
        return NextResponse.json({ runId: null, items: [] })
      }
    }

    const { data, error } = await db
      .from('scout_items_results')
      .select('id, title, source, category, momentum, entities_count, cross_references, relevance, viral_score, status, url, created_at')
      .eq('run_id', targetRunId)
      .eq('user_id', user.id)
      .order('viral_score', { ascending: false })
      .order('momentum', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      category: row.category ?? 'unknown',
      momentum: row.momentum,
      entities: row.entities_count,
      links: row.cross_references,
      relevance: row.relevance,
      viralScore: row.viral_score,
      status: row.status,
      url: row.url,
      timestamp: row.created_at,
    }))

    return NextResponse.json({ runId: targetRunId, items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load scout items'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
