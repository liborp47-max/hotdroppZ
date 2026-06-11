import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/analytics — track a performance event
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    post_id?: string
    views?: number
    clicks?: number
    shares?: number
    engagement_rate?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.post_id) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  const { error } = await supabase.from('post_analytics').insert({
    post_id: body.post_id,
    views: body.views ?? 0,
    clicks: body.clicks ?? 0,
    shares: body.shares ?? 0,
    engagement_rate: body.engagement_rate ?? 0,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// GET /api/analytics — overview aggregates
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: analyticsRows }, { data: topPosts }] = await Promise.all([
    supabase.from('post_analytics').select('post_id, views, clicks, shares, engagement_rate'),
    supabase
      .from('posts')
      .select('id, title, category, published_at')
      .eq('status', 'published')
      .limit(100),
  ])

  // Aggregate by post
  const map = new Map<string, { views: number; clicks: number; shares: number; engagement_rate: number }>()
  for (const row of analyticsRows ?? []) {
    const ex = map.get(row.post_id)
    if (ex) {
      ex.views += row.views
      ex.clicks += row.clicks
      ex.shares += row.shares
      ex.engagement_rate = Math.max(ex.engagement_rate, row.engagement_rate)
    } else {
      map.set(row.post_id, {
        views: row.views,
        clicks: row.clicks,
        shares: row.shares,
        engagement_rate: row.engagement_rate,
      })
    }
  }

  const totalViews = Array.from(map.values()).reduce((s, r) => s + r.views, 0)
  const totalClicks = Array.from(map.values()).reduce((s, r) => s + r.clicks, 0)
  const totalShares = Array.from(map.values()).reduce((s, r) => s + r.shares, 0)
  const avgCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00'

  // Top 10 posts by views
  const top10 = (topPosts ?? [])
    .map((p) => ({ ...p, ...(map.get(p.id) ?? { views: 0, clicks: 0, shares: 0, engagement_rate: 0 }) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  return NextResponse.json({
    totals: { views: totalViews, clicks: totalClicks, shares: totalShares, ctr: avgCtr },
    top10,
  })
}
