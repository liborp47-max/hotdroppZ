import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { resolveBulkAction } from '@/lib/scout-hq/scout-items'

type BulkBody = { action?: string; ids?: string[] }

// POST /api/scout-hq/items/bulk  { action, ids }
// Applies a bulk status transition to scout_items. The status guard
// (.in('status', fromStatuses)) ensures only items in a valid source status
// are moved — prevents double-processing already-advanced items.
export async function POST(request: Request) {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as BulkBody | null
  if (!body || typeof body.action !== 'string' || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: 'Body must include action and a non-empty ids array' },
      { status: 400 },
    )
  }

  const spec = resolveBulkAction(body.action)
  if (!spec) {
    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }

  const db = createAdminClient() ?? authClient

  const { data, error } = await db
    .from('scout_items')
    .update({ status: spec.toStatus })
    .in('id', body.ids)
    .in('status', spec.fromStatuses)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updated = data?.length ?? 0
  return NextResponse.json({
    ok: true,
    action: spec.id,
    toStatus: spec.toStatus,
    updated,
    skipped: body.ids.length - updated,
  })
}
