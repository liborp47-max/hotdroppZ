import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) ?? []

  let query = db
    .from('media_assets')
    .select('id, name, type, url, mime_type, width, height, duration_s, tags, artist_hint, category, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (type) query = query.eq('type', type)
  if (tags.length > 0) query = query.overlaps('tags', tags)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: data ?? [] })
}

export async function POST(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const body = await request.json() as {
    name: string
    type: string
    url: string
    mime_type?: string
    tags?: string[]
    artist_hint?: string
    category?: string
    language?: string
    use_rules?: Record<string, unknown>
  }

  if (!body.name || !body.type || !body.url) {
    return NextResponse.json({ error: 'name, type, url required' }, { status: 400 })
  }

  const { data, error } = await db.from('media_assets').insert({
    name: body.name,
    type: body.type,
    url: body.url,
    mime_type: body.mime_type ?? null,
    tags: body.tags ?? [],
    artist_hint: body.artist_hint ?? null,
    category: body.category ?? null,
    language: body.language ?? null,
    use_rules: body.use_rules ?? null,
    uploaded_by: user.email ?? user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data })
}

export async function DELETE(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db.from('media_assets').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
