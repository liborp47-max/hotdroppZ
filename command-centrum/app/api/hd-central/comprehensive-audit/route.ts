import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Comprehensive audit is disabled (legacy).',
      timestamp: new Date().toISOString(),
    },
    { status: 410 }
  )
}
