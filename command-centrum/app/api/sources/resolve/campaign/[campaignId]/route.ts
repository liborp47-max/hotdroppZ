import { NextResponse } from 'next/server'
import { authenticateSrl } from '@/lib/sources/srl/api/auth'
import { createSourceResolver } from '@/lib/sources/srl'

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<NextResponse> {
  const auth = await authenticateSrl(request)
  if (!auth.ok) return auth.response

  const { campaignId } = await context.params
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }

  const srl = createSourceResolver(auth.db)
  const resolution = await srl.resolveForCampaign(campaignId)
  return NextResponse.json(resolution)
}
