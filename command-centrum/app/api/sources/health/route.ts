import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver, type SourceHealthReport } from '@/lib/sources/srl'

const ALLOWED_STATUS: SourceHealthReport['status'][] = ['success', 'failure', 'rate_limited']

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const srl = createSourceResolver(auth.db)
  await srl.reportSourceHealth(parsed.value.sourceId, parsed.value.metrics)
  return NextResponse.json({ ok: true })
}

function parseBody(
  body: unknown,
): { ok: true; value: { sourceId: string; metrics: SourceHealthReport } } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be object' }
  const b = body as Record<string, unknown>
  const sourceId = b.sourceId
  const status = b.status
  if (typeof sourceId !== 'string' || !sourceId) return { ok: false, error: 'sourceId is required' }
  if (typeof status !== 'string' || !ALLOWED_STATUS.includes(status as SourceHealthReport['status'])) {
    return { ok: false, error: `status must be one of: ${ALLOWED_STATUS.join(', ')}` }
  }

  const metrics: SourceHealthReport = {
    status: status as SourceHealthReport['status'],
    latencyMs: typeof b.latencyMs === 'number' ? b.latencyMs : undefined,
    itemsFound: typeof b.itemsFound === 'number' ? b.itemsFound : undefined,
    errorCode: typeof b.errorCode === 'string' ? b.errorCode : undefined,
  }
  return { ok: true, value: { sourceId, metrics } }
}
