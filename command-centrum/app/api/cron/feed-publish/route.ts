import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/cron/feed-publish
//
// Auto-publishes scheduled feed posts whose `scheduled_at` has been reached.
// Status guard (`.eq('status','scheduled')`) makes the cron idempotent —
// running twice publishes the same row only once. Mirrors the in-process
// predicate `isPublishDue` from `lib/feed/calendar.ts`.
//
// Auth: Bearer CRON_SECRET (matches the rest of /api/cron/*).

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Atomic, idempotent batch advance: only rows currently 'scheduled' with a
  // scheduled_at in the past flip to 'published'.
  const { data, error } = await db
    .from('feed_posts')
    .update({ status: 'published', published_at: now, updated_at: now })
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)
    .select('id, scheduled_at, published_at')

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const published = data ?? []
  return NextResponse.json({
    ok: true,
    at: now,
    published: published.length,
    ids: published.map((row: { id: string }) => row.id),
  })
}
