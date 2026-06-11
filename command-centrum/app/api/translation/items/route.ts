// GET /api/translation/items — recent TRANSLATED scout items for the translation monitor

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

  const { data: items, error } = await db
    .from('scout_items')
    .select('id, title, title_en, source, language, lang_detected, category, created_at, updated_at, url')
    .eq('status', 'TRANSLATED')
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: items ?? [] })
}
