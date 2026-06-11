import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 20)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    switch (step) {
      case 'scout': {
        const { data } = await db
          .from('scout_items')
          .select('id, title, source, url, created_at, status, category, attention_score')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'filter': {
        const { data } = await db
          .from('scout_items')
          .select('id, title, source, created_at, status')
          .eq('status', 'discarded')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'translator': {
        // Items move to CURATED/CLUSTERED after translation — show all that went through this stage
        const { data } = await db
          .from('scout_items')
          .select('id, title, title_en, source, content_en, created_at, category')
          .in('status', ['TRANSLATED', 'CURATED', 'CLUSTERED'])
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'curator': {
        // Items move to CLUSTERED after curation — show all that went through this stage
        const { data } = await db
          .from('scout_items')
          .select('id, title_en, title, source, category, attention_score, created_at')
          .in('status', ['CURATED', 'CLUSTERED'])
          .gte('created_at', since)
          .order('attention_score', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'cluster': {
        const { data } = await db
          .from('story_clusters')
          .select('id, title, category, source_count, confidence, max_attention_score, created_at, status')
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'enrichment': {
        const { data } = await db
          .from('story_clusters')
          .select('id, title, category, artist_name, spotify_url, youtube_url, image_url, created_at')
          .not('artist_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'writer': {
        const { data } = await db
          .from('posts')
          .select('id, title, category, ai_score, status, created_at, source_name')
          .in('status', ['draft', 'approved'])
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'feed': {
        const { data } = await db
          .from('feed_posts')
          .select('id, title, type, tags, created_at, media_hint')
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      case 'multilang': {
        const { data } = await db
          .from('posts')
          .select('id, title, category, created_at')
          .not('localized_versions', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit)
        return NextResponse.json({ items: data ?? [] })
      }

      default:
        return NextResponse.json({ error: 'Unknown step' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
