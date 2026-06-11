import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { buildDriftReport, type DriftInput } from '@/lib/audit-dashboard/drift-detection'

const DAY = 86_400_000

/**
 * GET /api/hd-central/audit-drift
 * Distribution drift (UM-AUDITOR / SM3): how the pipeline-stage / model-usage /
 * content-quality MIX shifted in the last 24h vs the prior 7-day baseline.
 * Degrades to an empty report when tables/DB are absent.
 */
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const now = Date.now()
  const last24h = new Date(now - DAY).toISOString()
  const prev7dStart = new Date(now - 8 * DAY).toISOString()
  let degraded = false

  const tally = (rows: Array<Record<string, unknown>>, key: string, isCurrent: (ts: string) => boolean) => {
    const cur: Record<string, number> = {}
    const base: Record<string, number> = {}
    for (const r of rows) {
      const k = String(r[key] ?? 'unknown')
      const ts = String(r.created_at ?? r.started_at ?? '')
      const bucket = isCurrent(ts) ? cur : base
      bucket[k] = (bucket[k] ?? 0) + 1
    }
    return { current: cur, baseline: base }
  }
  const inCurrent = (ts: string) => Date.parse(ts) >= now - DAY

  const input: DriftInput = {}
  try {
    const [stageRuns, usage, posts] = await Promise.all([
      db.from('pipeline_stage_runs').select('stage, started_at').gte('started_at', prev7dStart).limit(10000),
      db.from('ai_usage_logs').select('provider, created_at').gte('created_at', prev7dStart).limit(10000),
      db.from('posts').select('ai_score, created_at').gte('created_at', prev7dStart).limit(10000),
    ])
    if (stageRuns.error || usage.error || posts.error) degraded = true

    if (stageRuns.data?.length) {
      input.pipelineDistribution = tally(stageRuns.data as Array<Record<string, unknown>>, 'stage', inCurrent)
    }
    if (usage.data?.length) {
      input.modelUsage = tally(usage.data as Array<Record<string, unknown>>, 'provider', inCurrent)
    }
    if (posts.data?.length) {
      // Bucket ai_score into quality bands, then tally the band distribution.
      const banded = (posts.data as Array<{ ai_score: number | null; created_at: string }>).map((p) => {
        const s = p.ai_score ?? 0
        const band = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low'
        return { band, created_at: p.created_at }
      })
      input.contentQuality = tally(banded as Array<Record<string, unknown>>, 'band', inCurrent)
    }
  } catch {
    degraded = true
  }

  const report = buildDriftReport(input)
  return NextResponse.json({ ...report, degraded, window: { current: '24h', baseline: '7d', since: last24h } })
}
