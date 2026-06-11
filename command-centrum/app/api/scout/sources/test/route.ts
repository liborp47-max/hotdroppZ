import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFeed } from '@/lib/services/rss-parser'
import { isUrlSafe } from '@/lib/utils/ssrf-guard'

const TEST_TIMEOUT_MS = 10_000

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let url: string
  try {
    const body = await req.json() as { url?: string }
    url = (body.url ?? '').trim()
    if (!url) throw new Error('url required')
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Valid url is required' }, { status: 400 })
  }

  // AUD-SEC-002: block SSRF to loopback/metadata/private/internal hosts.
  const safe = isUrlSafe(url)
  if (!safe.ok) {
    return NextResponse.json({ error: `URL not allowed (${safe.reason})` }, { status: 400 })
  }

  const fetchedAt = Date.now()
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
        'User-Agent': 'HotDroppZ Scout/1.0 (RSS Reader)',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}`, latencyMs: Date.now() - fetchedAt })
    }

    const raw = await res.text()
    const items = parseFeed(raw)
    const latencyMs = Date.now() - fetchedAt

    return NextResponse.json({
      ok: true,
      itemCount: items.length,
      latencyMs,
      sample: items.slice(0, 3).map((i) => ({ title: i.title, pubDate: i.pubDate })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed'
    return NextResponse.json({ ok: false, error: message, latencyMs: Date.now() - fetchedAt })
  }
}
