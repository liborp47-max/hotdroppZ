import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/distribution/push
// Body: { ids: string[], priority?: 'urgent' | 'high' | 'normal' | 'low' }
// Pushes approved posts from FEED queue → HDUA (sets hdua_distributed_at)
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { ids?: unknown; priority?: unknown }
  try { body = await req.json() } catch { body = {} }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'No post IDs provided' }, { status: 400 })
  if (ids.length > 50) return NextResponse.json({ error: 'Max 50 posts per push' }, { status: 400 })

  const validPriorities = ['urgent', 'high', 'normal', 'low'] as const
  type Priority = typeof validPriorities[number]
  const priority: Priority = validPriorities.includes(body.priority as Priority) ? body.priority as Priority : 'normal'

  const db = createAdminClient() ?? authClient
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('feed_posts')
    .update({
      hdua_distributed_at: now,
      distribution_priority: priority,
    })
    .in('id', ids)
    .not('published_at', 'is', null)   // only push approved posts
    .is('retracted_at', null)
    .select('id, title, hdua_distributed_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    pushed: data?.length ?? 0,
    posts: data ?? [],
    distributed_at: now,
  })
}
