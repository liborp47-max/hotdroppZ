import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  buildSourcePerformanceReport,
  type ArtistPostRecord,
  type SourceItemRecord,
} from '@/lib/sources/source-performance'

/**
 * GET /api/sources/performance
 * Source performance report (UM-SOURCES / SM5): which feeds produce the most
 * valuable content + which artists drive engagement. Degrades to an empty
 * report when the tables/DB are absent.
 */
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  let degraded = false

  let feedRows: Array<{
    source_name: string | null
    artist: string | null
    views: number | null
    clicks: number | null
    shares: number | null
    engagement_rate: number | null
  }> = []
  let scoutRows: Array<{ source_name: string | null }> = []

  try {
    const [feed, scout] = await Promise.all([
      db.from('feed_posts').select('source_name, artist, views, clicks, shares, engagement_rate').limit(5000),
      db.from('scout_items').select('source_name').limit(5000),
    ])
    feedRows = (feed.data as typeof feedRows | null) ?? []
    scoutRows = (scout.data as typeof scoutRows | null) ?? []
    if (feed.error || scout.error) degraded = true
  } catch {
    degraded = true
  }

  // Published items (feed_posts) carry engagement; one record each.
  const items: SourceItemRecord[] = feedRows.map((f) => ({
    source: f.source_name || 'unknown',
    published: true,
    views: f.views ?? 0,
    clicks: f.clicks ?? 0,
    shares: f.shares ?? 0,
  }))

  // Scouted-but-unpublished remainder per source = scouted - published.
  const scoutedBySource = new Map<string, number>()
  for (const s of scoutRows) {
    const k = s.source_name || 'unknown'
    scoutedBySource.set(k, (scoutedBySource.get(k) ?? 0) + 1)
  }
  const publishedBySource = new Map<string, number>()
  for (const i of items) publishedBySource.set(i.source, (publishedBySource.get(i.source) ?? 0) + 1)
  for (const [source, scouted] of scoutedBySource) {
    const remainder = Math.max(0, scouted - (publishedBySource.get(source) ?? 0))
    for (let i = 0; i < remainder; i++) items.push({ source, published: false, views: 0, clicks: 0, shares: 0 })
  }

  const posts: ArtistPostRecord[] = feedRows.map((f) => ({
    artist: f.artist || '',
    views: f.views ?? 0,
    clicks: f.clicks ?? 0,
    shares: f.shares ?? 0,
    engagementRate: f.engagement_rate ?? 0,
  }))

  const report = buildSourcePerformanceReport(items, posts)
  return NextResponse.json({ ...report, degraded })
}
