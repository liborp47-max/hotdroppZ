import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import {
  createSourceResolver,
  type TrackedEntityFilter,
  type TrackedPriority,
} from '@/lib/sources/srl'

const ALLOWED_TYPES = ['artist', 'playlist', 'feed', 'chart'] as const
const ALLOWED_PRIORITIES: TrackedPriority[] = ['P0', 'P1', 'P2', 'P3']

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const priority = url.searchParams.get('priority')
  const region = url.searchParams.get('region') ?? undefined
  const minAuthority = numericParam(url.searchParams.get('minAuthority'), 0)
  const limit = numericParam(url.searchParams.get('limit'), 50)

  if (type && !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  if (priority && !ALLOWED_PRIORITIES.includes(priority as TrackedPriority)) {
    return NextResponse.json(
      { error: `priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` },
      { status: 400 },
    )
  }

  const filter: TrackedEntityFilter = {
    type: (type as TrackedEntityFilter['type']) ?? undefined,
    priority: (priority as TrackedPriority) ?? undefined,
    region,
    minAuthority,
    limit,
  }

  const srl = createSourceResolver(auth.db)
  const entities = await srl.resolveTrackedEntities(filter)
  return NextResponse.json(entities)
}

function numericParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
