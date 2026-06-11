import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'activity'
  const country = searchParams.get('country') || undefined
  const limit = Number(searchParams.get('limit')) || 20

  try {
    switch (view) {
      case 'trending':
        // Heating-up artists with week-over-week growth
        const { data: trends } = await db
          .from('artist_weekly_trends')
          .select('*')
          .order('week_growth_pct', { ascending: false })
          .limit(limit)
        return NextResponse.json({ trends })

      case 'performance':
        // Artist → feed post performance (joins with feed_posts)
        const { data: perf } = await db
          .from('artist_feed_performance')
          .select('*')
          .order('avg_boosted_score', { ascending: false })
          .limit(limit)
        return NextResponse.json({ performance: perf })

      case 'platforms':
        // Platform conversion effectiveness
        const { data: platforms } = await db
          .from('platform_effectiveness')
          .select('*')
        return NextResponse.json({ platforms })

      case 'conversion':
        // Full conversion funnel per artist
        const { data: funnel } = await db
          .from('release_conversion_funnel')
          .select('*')
          .order('detected_total', { ascending: false })
          .limit(limit)
        return NextResponse.json({ funnel })

      case 'activity':
      default:
        // Top active artists (mv_artist_activity)
        let query = db.from('mv_artist_activity').select('*')
        if (country) query = query.eq('country', country)
        const { data: activity } = await query
          .order('releases_7d', { ascending: false })
          .limit(limit)
        return NextResponse.json({ activity })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// POST — trigger learning cycle manually
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const { action } = await req.json().catch(() => ({ action: 'refresh' }))

  if (action === 'refresh') {
    // Call artist learning edge function
    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/artist-learning`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      return NextResponse.json(data)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
