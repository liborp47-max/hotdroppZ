import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { toCategory, CATEGORIES } from '@/lib/categories'

export const dynamic = 'force-dynamic'

// GET /api/search?q=...&category=...&section=...&limit=...
// Searches across: scout_items, story_clusters, feed_posts
// section filter: 'scout' | 'cluster' | 'feed' | 'all' (default: all)

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q = (searchParams.get('q') ?? '').trim()
  const category = searchParams.get('category') ?? ''
  const section = searchParams.get('section') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  if (q.length < 2) return NextResponse.json({ results: [], total: 0 })

  const db = createAdminClient() ?? authClient
  const canonicalCategory = CATEGORIES.includes(category as typeof CATEGORIES[number])
    ? category
    : null

  const results: SearchResult[] = []

  // ── Scout items ─────────────────────────────────────────────────────────────
  if (section === 'all' || section === 'scout') {
    let sq = db
      .from('scout_items')
      .select('id, title, content, category, artist, source_name, published_at, created_at')
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,artist.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (canonicalCategory) {
      // match both new and legacy values
      const legacyKeys = Object.entries(
        await import('@/lib/categories').then(m => m.LEGACY_CATEGORY_MAP)
      )
        .filter(([, v]) => v === canonicalCategory)
        .map(([k]) => k)
      sq = sq.in('category', [...new Set([canonicalCategory, ...legacyKeys])])
    }

    const { data } = await sq
    for (const row of data ?? []) {
      results.push({
        id: row.id,
        section: 'scout',
        title: row.title ?? '',
        excerpt: (row.content ?? '').slice(0, 160),
        artist: row.artist ?? null,
        category: toCategory(row.category),
        date: row.published_at ?? row.created_at,
        href: `/scout-hq/pool`,
      })
    }
  }

  // ── Story clusters ───────────────────────────────────────────────────────────
  if (section === 'all' || section === 'cluster') {
    let cq = db
      .from('story_clusters')
      .select('id, main_entity, title, summary, category, confidence, created_at')
      .or(`title.ilike.%${q}%,main_entity.ilike.%${q}%,summary.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (canonicalCategory) {
      const legacyKeys = Object.entries(
        await import('@/lib/categories').then(m => m.LEGACY_CATEGORY_MAP)
      )
        .filter(([, v]) => v === canonicalCategory)
        .map(([k]) => k)
      cq = cq.in('category', [...new Set([canonicalCategory, ...legacyKeys])])
    }

    const { data } = await cq
    for (const row of data ?? []) {
      results.push({
        id: row.id,
        section: 'cluster',
        title: row.title ?? row.main_entity ?? '',
        excerpt: (row.summary ?? '').slice(0, 160),
        artist: row.main_entity ?? null,
        category: toCategory(row.category),
        date: row.created_at,
        href: `/cluster`,
      })
    }
  }

  // ── Feed posts ───────────────────────────────────────────────────────────────
  if (section === 'all' || section === 'feed') {
    let fq = db
      .from('feed_posts')
      .select('id, title, content, category, artist, created_at, published_at, status')
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,artist.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (canonicalCategory) {
      const legacyKeys = Object.entries(
        await import('@/lib/categories').then(m => m.LEGACY_CATEGORY_MAP)
      )
        .filter(([, v]) => v === canonicalCategory)
        .map(([k]) => k)
      fq = fq.in('category', [...new Set([canonicalCategory, ...legacyKeys])])
    }

    const { data } = await fq
    for (const row of data ?? []) {
      results.push({
        id: row.id,
        section: 'feed',
        title: row.title ?? '',
        excerpt: (row.content ?? '').slice(0, 160),
        artist: row.artist ?? null,
        category: toCategory(row.category),
        date: row.created_at,
        href: row.published_at ? `/feed/published` : `/feed/incoming`,
        status: row.status ?? undefined,
      })
    }
  }

  // Sort all sections by date desc, respect limit
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const sliced = results.slice(0, limit)

  return NextResponse.json({
    results: sliced,
    total: sliced.length,
    query: q,
    category: canonicalCategory,
    section,
  })
}

type SearchResult = {
  id: string
  section: 'scout' | 'cluster' | 'feed'
  title: string
  excerpt: string
  artist: string | null
  category: import('@/lib/categories').Category
  date: string
  href: string
  status?: string
}
