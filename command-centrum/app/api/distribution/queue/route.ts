import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/distribution/queue
// Returns posts approved in FEED but not yet pushed to HDUA
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  const { data, error } = await db
    .from('feed_posts')
    .select('id, title, content, artist, category, priority, image_url, spotify_url, youtube_url, created_at, published_at, schedule_data, metadata')
    .not('published_at', 'is', null)
    .is('hdua_distributed_at', null)
    .is('retracted_at', null)
    .order('published_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [], count: (data ?? []).length })
}
