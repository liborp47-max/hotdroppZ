import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/distribution/live
// Returns posts currently live in HDUA
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  const { data, error } = await db
    .from('feed_posts')
    .select('id, title, content, artist, category, priority, image_url, spotify_url, youtube_url, created_at, published_at, hdua_distributed_at, distribution_priority, is_radar, view_count, boost_count, like_count, metadata')
    .not('hdua_distributed_at', 'is', null)
    .is('retracted_at', null)
    .order('hdua_distributed_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [], count: (data ?? []).length })
}
