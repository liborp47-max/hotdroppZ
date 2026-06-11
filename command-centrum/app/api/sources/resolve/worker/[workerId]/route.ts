import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver, type WorkerIntent } from '@/lib/sources/srl'

const ALLOWED_INTENTS: WorkerIntent[] = [
  'tracked_artists',
  'curated_playlists',
  'active_feeds',
  'chart_snapshot',
  'topic_keywords',
]

export async function GET(
  request: Request,
  context: { params: Promise<{ workerId: string }> },
): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const { workerId } = await context.params
  const url = new URL(request.url)
  const intentParam = url.searchParams.get('intent')
  if (!intentParam || !ALLOWED_INTENTS.includes(intentParam as WorkerIntent)) {
    return NextResponse.json(
      { error: `intent must be one of: ${ALLOWED_INTENTS.join(', ')}` },
      { status: 400 },
    )
  }

  const region = url.searchParams.get('region') ?? undefined
  const language = url.searchParams.get('language') ?? undefined
  const limit = numericParam(url.searchParams.get('limit'), 50)
  const priorityMin = numericParam(url.searchParams.get('priorityMin'), 0)

  const srl = createSourceResolver(auth.db)
  const bundle = await srl.resolveForWorker(workerId, intentParam as WorkerIntent, {
    region,
    language,
    limit,
    priorityMin,
  })

  return NextResponse.json(bundle)
}

function numericParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
