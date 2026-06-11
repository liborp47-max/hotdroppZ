import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PostStatus } from '@/lib/types'

type Action = 'APPROVE' | 'REJECT' | 'PUBLISH'

const ACTION_STATUS: Record<Action, PostStatus> = {
  APPROVE: 'approved',
  REJECT:  'rejected',
  PUBLISH: 'published',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action } = body
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  if (!action || !(action in ACTION_STATUS)) {
    return NextResponse.json({ error: 'action must be APPROVE | REJECT | PUBLISH' }, { status: 400 })
  }

  const status = ACTION_STATUS[action as Action]
  const updateData: Record<string, string> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'published') {
    updateData.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', id)
    .select('id, title, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, post: data })
}
