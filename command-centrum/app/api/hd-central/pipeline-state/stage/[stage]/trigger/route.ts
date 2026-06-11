import { NextResponse } from 'next/server'
import path from 'path'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { appendHistoryEntry } from '@/lib/hd-central/history-log'
import {
  STATE_ROOT,
  getStageMeta,
  readStageStateFile,
} from '../../../_shared'

const MIN_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes between manual triggers (override via ?force=true)

function internalBaseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/+$/, '')
  const u = new URL(request.url)
  return `${u.protocol}//${u.host}`
}

function readLastRunAt(stageId: string): string | null {
  const raw = readStageStateFile(stageId as Parameters<typeof readStageStateFile>[0])
  return raw?.data?.lastRunAt ?? null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stage: string }> }
) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const { stage } = await params
  const meta = getStageMeta(stage)

  if (!meta) {
    return NextResponse.json(
      { error: { code: 'invalid_stage', message: `Unknown stage: ${stage}` } },
      { status: 400 }
    )
  }

  // Retired stage — explicit gone.
  if (stage === 'translator') {
    return NextResponse.json(
      { error: { code: 'stage_retired', message: 'Translator stage is retired' } },
      { status: 410 }
    )
  }

  // Auto-only stage — no manual trigger.
  if (!meta.manualTriggerEndpoint) {
    return NextResponse.json(
      {
        error: {
          code: 'manual_trigger_not_allowed',
          message: `Stage ${stage} runs auto-only (no manual trigger endpoint).`,
        },
      },
      { status: 405 }
    )
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'

  // Confirmation guard — 409 if last run < 5 minutes ago.
  const lastRunAt = readLastRunAt(meta.id)
  if (!force && lastRunAt) {
    const last = Date.parse(lastRunAt)
    if (!Number.isNaN(last)) {
      const since = Date.now() - last
      if (since < MIN_INTERVAL_MS) {
        const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - since) / 1000)
        return NextResponse.json(
          {
            error: {
              code: 'too_soon',
              message: 'Stage was triggered recently. Pass ?force=true to override.',
              details: { lastRunAt, retryAfterSec },
            },
          },
          { status: 409, headers: { 'Retry-After': String(retryAfterSec) } }
        )
      }
    }
  }

  const correlationId = randomUUID()
  const triggeredAt = new Date().toISOString()

  logger.info('hd_central_manual_trigger', {
    stage: meta.id,
    actor: user.email,
    correlation_id: correlationId,
    endpoint: meta.manualTriggerEndpoint,
    forced: force,
  })

  // Audit log entry (before fan-out — even failed upstream calls must be auditable).
  const stageDir = path.join(STATE_ROOT, 'PIPELINE_STAGES', meta.id)
  appendHistoryEntry(stageDir, 'pipeline-stage', meta.id, 'manual_trigger', {
    actor: user.email ?? user.id,
    corr: correlationId,
    forced: force ? 'true' : 'false',
  })

  // Fan out to upstream stage runner.
  const upstream = `${internalBaseUrl(request)}${meta.manualTriggerEndpoint}`
  let runResponse: unknown = null
  let upstreamStatus = 0
  let upstreamOk = false

  try {
    const cookie = request.headers.get('cookie') ?? ''
    const res = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        'X-Trigger-Source': 'ceo-manual',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      // Empty body — existing /api/<stage>/run handlers accept POST without body.
      body: '{}',
    })
    upstreamStatus = res.status
    upstreamOk = res.ok
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      runResponse = await res.json()
    } else {
      runResponse = await res.text()
    }
  } catch (e) {
    logger.error('[pipeline-state/trigger] upstream fetch failed', e, {
      stage: meta.id,
      upstream,
      correlation_id: correlationId,
    })
    appendHistoryEntry(stageDir, 'pipeline-stage', meta.id, 'run_error', {
      corr: correlationId,
      reason: 'upstream_unreachable',
    })
    return NextResponse.json(
      {
        ok: false,
        stage: meta.id,
        correlationId,
        triggeredAt,
        error: {
          code: 'upstream_unreachable',
          message: (e as Error).message,
        },
      },
      { status: 502 }
    )
  }

  // Terminal log entry so active-runs query stops reporting this corr.
  appendHistoryEntry(
    stageDir,
    'pipeline-stage',
    meta.id,
    upstreamOk ? 'run_complete' : 'run_error',
    { corr: correlationId, status: String(upstreamStatus) }
  )

  return NextResponse.json(
    {
      ok: upstreamOk,
      stage: meta.id,
      correlationId,
      triggeredAt,
      upstreamStatus,
      runResponse,
    },
    { status: upstreamOk ? 200 : 502 }
  )
}
