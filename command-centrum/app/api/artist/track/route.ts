import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { runTrackingCycle, getNextArtistsForTracking } from '@/lib/services/artistTracker'

export async function POST(req: NextRequest) {
  // Allow both cron (CRON_SECRET) and authenticated users
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { artistId, limit = 20 } = body as { artistId?: string; limit?: number }

    const db = createAdminClient()
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

    if (artistId) {
      // Single artist tracking trigger
      // (delegate to artistTracker for single check — simplified here)
      return NextResponse.json({ message: 'single tracking triggered', artistId })
    }

    // Run full tracking cycle
    const result = await runTrackingCycle(limit)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    console.error('ATE API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'next') {
      // Get next batch of artists due for tracking
      const artists = await getNextArtistsForTracking(20)
      return NextResponse.json({ artists })
    }

    // Default: return recent stats
    const db = createAdminClient()
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

    const { data: stats } = await db
      .from('mv_artist_activity')
      .select('*')
      .order('releases_7d', { ascending: false })
      .limit(10)

    const { data: queueRows } = await db
      .from('droppz_queue')
      .select('status')
      .in('status', ['pending','scouting','written'])

    const queueStats = (queueRows ?? []).reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status)
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      topArtists: stats,
      queue: queueStats,
    })
  } catch (err) {
    console.error('ATE GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
