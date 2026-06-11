import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { runPipelineB, buildPipelineAlert } from '@/lib/pipeline/pipeline-b'
import { sendOpsAlert } from '@/lib/alerts/ops-alert'

// GET /api/cron/pipeline
//
// Hourly Pipeline B automation (P0-006-CRON): curator → enrichment → writer →
// feed. Each stage is isolated — one failure is recorded and alerted, the run
// continues. Per-stage metrics land in pipeline_stage_runs; failures fan out to
// OPS_ALERT_WEBHOOK_URL (best-effort, no-op if unset).
//
// Auth: Bearer CRON_SECRET (matches the rest of /api/cron/*). Idempotent —
// every stage uses status guards, so overlapping fires don't double-process.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const endpoint = '/api/cron/pipeline'
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn('cron_unauthorized', { endpoint, result: 'unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    logger.error('cron_pipeline_no_admin', undefined, { endpoint, result: 'error' })
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const runId = randomUUID()
  logger.info('cron_pipeline_start', { endpoint, run_id: runId, result: 'started' })

  const summary = await runPipelineB(db, { runId, triggeredBy: 'cron' })

  // Fan out failures to ops alerting (never blocks the response).
  const alert = buildPipelineAlert(summary)
  if (alert) {
    const { sent, reason } = await sendOpsAlert(alert)
    logger.error('cron_pipeline_failed', undefined, {
      endpoint,
      run_id: runId,
      result: 'partial_failure',
      failed_stages: summary.failedStages,
      duration_ms: summary.durationMs,
      alert_sent: sent,
      alert_reason: reason,
    })
  } else {
    logger.info('cron_pipeline_success', {
      endpoint,
      run_id: runId,
      result: 'success',
      duration_ms: summary.durationMs,
      skipped_stages: summary.skippedStages,
    })
  }

  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 })
}
