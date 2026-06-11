import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/distribution/[id]/retract  — pulls post from HDUA
// PATCH /api/distribution/[id]/radar    — toggles is_radar (featured in HDUA)
export async function PATCH(req: NextRequest, { params }: Params) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 })

  let body: { action?: unknown; radar?: unknown }
  try { body = await req.json() } catch { body = {} }

  const db = createAdminClient() ?? authClient

  if (body.action === 'retract') {
    const { data, error } = await db
      .from('feed_posts')
      .update({ retracted_at: new Date().toISOString(), hdua_distributed_at: null })
      .eq('id', id)
      .select('id, title, retracted_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ retracted: true, post: data })
  }

  if (body.action === 'radar') {
    const radar = body.radar === true
    const { data, error } = await db
      .from('feed_posts')
      .update({ is_radar: radar })
      .eq('id', id)
      .select('id, title, is_radar')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ radar: data?.is_radar, post: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
