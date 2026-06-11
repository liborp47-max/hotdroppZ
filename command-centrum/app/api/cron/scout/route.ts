import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn('cron_unauthorized', {
      endpoint: '/api/cron/scout',
      result: 'unauthorized',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  logger.info('cron_scout_disabled', {
    endpoint: '/api/cron/scout',
    result: 'disabled',
    reason: 'Scout cron pipeline is disabled (legacy)',
  })

  return NextResponse.json(
    {
      ok: false,
      error: 'Scout cron pipeline is disabled (legacy).',
    },
    { status: 410 }
  )
}
