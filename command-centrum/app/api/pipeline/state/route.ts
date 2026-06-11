import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(
    {
      ok: false,
      error: 'Pipeline state endpoint is disabled (legacy).',
      running: false,
      stages: [],
    },
    { status: 410 }
  )
}
