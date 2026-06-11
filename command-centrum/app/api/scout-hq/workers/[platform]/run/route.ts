import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params
  const now = new Date().toISOString()
  return NextResponse.json({
    ok: true,
    runId: `mock-run-${Date.now().toString(36)}`,
    workerPlatform: platform,
    startedAt: now,
    status: 'queued',
    note: 'Mock trigger — worker queue handler lands in PR-2.',
  })
}
