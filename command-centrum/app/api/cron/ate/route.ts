import { NextRequest, NextResponse } from 'next/server'
import { runTrackingCycle } from '@/lib/services/artistTracker'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const result = await runTrackingCycle(20)

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
  })
}
