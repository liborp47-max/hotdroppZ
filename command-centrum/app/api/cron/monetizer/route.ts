import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Monetizer pipeline is disabled (legacy).',
      adminClientReady: Boolean(db),
    },
    { status: 410 }
  )
}
