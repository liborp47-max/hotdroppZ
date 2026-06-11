import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver } from '@/lib/sources/srl'

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be object' }, { status: 400 })
  }
  const sourceId = (body as Record<string, unknown>).sourceId
  if (typeof sourceId !== 'string' || !sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  const srl = createSourceResolver(auth.db)
  await srl.invalidateCache(sourceId)
  return NextResponse.json({ ok: true, invalidated: sourceId })
}
