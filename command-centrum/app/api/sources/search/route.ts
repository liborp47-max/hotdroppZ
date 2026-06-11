import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver, type SearchFilters, type SourceType } from '@/lib/sources/srl'

const ALLOWED_TYPES: SourceType[] = ['artist', 'playlist', 'feed', 'chart', 'topic', 'asset']

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q) {
    return NextResponse.json({ error: 'q query param is required' }, { status: 400 })
  }

  const typeParam = url.searchParams.get('type')
  const types = typeParam
    ? typeParam
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is SourceType => ALLOWED_TYPES.includes(t as SourceType))
    : undefined

  const region = url.searchParams.get('region') ?? undefined
  const minAuthority = numericParam(url.searchParams.get('minAuthority'), 0)
  const tagsParam = url.searchParams.get('tags')
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined

  const filters: SearchFilters = {
    type: types,
    tags,
    region,
    minAuthority,
  }

  const srl = createSourceResolver(auth.db)
  const hits = await srl.search(q, filters)
  return NextResponse.json(hits)
}

function numericParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
