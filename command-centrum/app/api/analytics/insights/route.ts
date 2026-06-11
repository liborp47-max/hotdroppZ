import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getFunnel, getModelPerf, getAnomalies } from '@/lib/analytics/pipeline-insights'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') ?? 7)))

  const [funnel, modelPerf, anomalies] = await Promise.all([
    getFunnel(db, days).catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    getModelPerf(db, days).catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    getAnomalies(db).catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
  ])

  return NextResponse.json({ funnel, modelPerf, anomalies, generatedAt: new Date().toISOString() })
}
