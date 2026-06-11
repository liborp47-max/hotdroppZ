// Translation engine stats — used by dashboard translation monitor.
// GET /api/translation/stats

import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET() {
  let db: ReturnType<typeof createAdminClient>
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    db = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!db) return NextResponse.json({ error: 'Internal error' }, { status: 500 })

  const [cacheStats, queueStats, recentJobs] = await Promise.allSettled([
    // Cache stats
    db.from('translation_cache')
      .select('hash, source_lang, created_at', { count: 'exact' })
      .gt('expires_at', new Date().toISOString())
      .limit(1),

    // Items currently pending translation
    db.from('scout_items')
      .select('lang_detected', { count: 'exact' })
      .eq('status', 'SCOUTED')
      .limit(1),

    // Recent translated items (last 24h) — lang distribution
    db.from('scout_items')
      .select('lang_detected')
      .eq('status', 'TRANSLATED')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(200),
  ])

  const cacheCount = cacheStats.status === 'fulfilled' ? (cacheStats.value.count ?? 0) : 0
  const pendingCount = queueStats.status === 'fulfilled' ? (queueStats.value.count ?? 0) : 0

  // Build lang breakdown from recent translations
  const langBreakdown: Record<string, number> = {}
  if (recentJobs.status === 'fulfilled' && recentJobs.value.data) {
    for (const row of recentJobs.value.data) {
      const lang = row.lang_detected ?? 'unknown'
      langBreakdown[lang] = (langBreakdown[lang] ?? 0) + 1
    }
  }
  const totalTranslated24h = Object.values(langBreakdown).reduce((a, b) => a + b, 0)

  return NextResponse.json({
    cache: {
      entries:      cacheCount,
      ttl_days:     7,
    },
    queue: {
      pending_items: pendingCount,
    },
    last_24h: {
      translated:     totalTranslated24h,
      lang_breakdown: langBreakdown,
    },
    modes: {
      pipeline:   'active',
      publishing: 'active',
    },
    providers: {
      primary: 'groq/llama-3.1-8b-instant',
      large:   'groq/llama-3.3-70b-versatile',
      fallback: 'passthrough',
    },
  })
}
