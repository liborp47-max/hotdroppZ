import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// GET /api/scout-hq/items?status=&priority=&limit=
// Lists scout_items for the Scout HQ DroppZ dashboard (live data).
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
  const priority = searchParams.get('priority')
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '100'), 1), 300)

  let query = db
    .from('scout_items')
    .select(
      'id, title, title_en, source, url, category, status, priority, is_release, release_type, attention_score, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') query = query.eq('status', status)
  if (priority && priority !== 'all') query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
