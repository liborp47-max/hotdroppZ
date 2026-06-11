import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  // Fetch all stage runs (last 100)
  const { data: stageRuns, error: stageErr } = await db
    .from('pipeline_stage_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100)

  if (stageErr) {
    return NextResponse.json({ error: stageErr.message }, { status: 500 })
  }

  // Get health summary (one row per stage, latest run)
  const { data: health } = await db
    .from('pipeline_stage_health')
    .select('*')
    .order('stage')

  // Get queue counts
  const { data: queues } = await db
    .from('pipeline_queue_counts')
    .select('*')
    .single()

  // Get cost summary (last 7 days)
  const { data: costSummary } = await db
    .from('pipeline_cost_summary')
    .select('*')
    .order('stage')

  // Get filter discard stats
  const { data: discardStats } = await db
    .from('filter_discard_stats')
    .select('*')
    .order('count desc')

  return NextResponse.json({
    recent_runs: stageRuns ?? [],
    health: health ?? [],
    queues: queues ?? {},
    cost_summary: costSummary ?? [],
    discard_stats: discardStats ?? [],
  })
}
