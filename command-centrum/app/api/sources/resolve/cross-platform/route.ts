import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver } from '@/lib/sources/srl'

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const name = url.searchParams.get('name')
  if (!name) {
    return NextResponse.json({ error: 'name query param is required' }, { status: 400 })
  }

  const srl = createSourceResolver(auth.db)
  const links = await srl.resolveCrossPlatformLinks(name)
  return NextResponse.json(links)
}
