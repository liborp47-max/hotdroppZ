import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver } from '@/lib/sources/srl'

export async function GET(
  request: Request,
  context: { params: Promise<{ artistId: string }> },
): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const { artistId } = await context.params
  if (!artistId) {
    return NextResponse.json({ error: 'artistId is required' }, { status: 400 })
  }

  const srl = createSourceResolver(auth.db)
  const profile = await srl.resolveForArtist(artistId)
  return NextResponse.json(profile)
}
