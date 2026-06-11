import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// GET /api/scout-hq/runs?status=&limit=
// Lists scout_runs for the Scout HQ run-history panel (live data, filterable).
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
  const status = searchParams.get('status')
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200)

  let query = db
    .from('scout_runs')
    .select(
      'id, status, sources_count, items_found, duration_ms, triggered_by, error_message, started_at, completed_at',
    )
    .order('started_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ runs: data ?? [] })
}
