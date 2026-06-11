import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { translateItem } from '@/lib/translation'

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items: Array<{ title: string; summary?: string | null; body?: string | null; tags?: string[] }> =
    Array.isArray(body) ? body : [body as { title: string }]

  if (!items.length || !items[0]?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = createAdminClient() ?? authClient
  const mode = (req.headers.get('x-translation-mode') as 'pipeline' | 'publishing') ?? 'pipeline'

  const results = await Promise.all(
    items.map(item => translateItem(db, item, mode))
  )

  return NextResponse.json(Array.isArray(body) ? results : results[0])
}
