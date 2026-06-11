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
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20'), 1), 100)

  try {
    const { data, error } = await db
      .from('pipeline_runs')
      .select('id, started_at, completed_at, status, duration_ms, scout_items_count, avg_momentum, avg_viral_score, unique_sources, error_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ runs: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load recent runs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
