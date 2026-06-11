import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'

// ─────────────────────────────────────────────────────────────────────────────
// Alerts endpoint — detects critical pipeline failures for the CEO dashboard.
// UM-CEO / #05. Three detectors:
//   1. pipeline_error   — pipeline_runs with status='error' (last 6h, per stage)
//   2. model_timeout    — error_summary ~ 'timeout' OR duration_ms > 120s
//   3. discarded_spike  — scout_items discarded last-1h vs prev-6h baseline
// All queries wrapped in safeKpiQuery — DB drift / missing tables degrade to
// `degraded: true` + partial alerts instead of crashing the dashboard.
// 30s polling target. Cache 15s.
// ─────────────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertKind = 'pipeline_error' | 'model_timeout' | 'discarded_spike'

export interface Alert {
  id: string
  kind: AlertKind
  severity: AlertSeverity
  title: string
  detail: string
  stage: string | null
  count: number
  firstSeenAt: string
  lastSeenAt: string
}

export interface AlertsResponse {
  generatedAt: string
  alerts: Alert[]
  counts: { critical: number; warning: number; info: number }
  degraded: boolean
}

const WINDOW_6H_MS = 6 * 60 * 60 * 1000
const WINDOW_1H_MS = 60 * 60 * 1000
// 120s = 2min hard cap — aligns with CLAUDE.md token budget context.
const TIMEOUT_DURATION_MS = 120_000

// Tracks whether any detector query degraded. A detector returning its fallback
// flips this so the UI can surface partial-data state honestly.
interface DetectorContext {
  degraded: boolean
}

// Silent wrapper — falls back instead of crashing the whole endpoint.
// Marks the context degraded so partial data is signalled, never hidden.
async function safeKpiQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
  ctx: DetectorContext,
): Promise<T> {
  try {
    const v = await fn()
    return v ?? fallback
  } catch (e) {
    logger.warn('[alerts] query failed', { label, error: (e as Error).message })
    ctx.degraded = true
    return fallback
  }
}

function isoMinusMs(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

// Stable, idempotent id from kind + detail keys — same failure dedupes to the
// same id across polls so the client can persist a dismiss decision.
function alertId(kind: AlertKind, ...parts: string[]): string {
  return createHash('sha1').update([kind, ...parts].join('|')).digest('hex').slice(0, 16)
}

interface PipelineRunRow {
  id: string
  stage: string | null
  status: string | null
  error_summary: string | null
  duration_ms: number | null
  started_at: string
}

// ── Detector 1: pipeline_error ──────────────────────────────────────────────
// pipeline_runs WHERE status='error' AND started_at >= now-6h, grouped by stage.
// critical if >= 3 errors in the stage, warning otherwise.
async function detectPipelineErrors(
  db: SupabaseClient,
  ctx: DetectorContext,
): Promise<Alert[]> {
  const since = isoMinusMs(WINDOW_6H_MS)
  const rows = await safeKpiQuery<PipelineRunRow[]>(
    'pipeline_error',
    async () => {
      const { data, error } = await db
        .from('pipeline_runs')
        .select('id,stage,status,error_summary,duration_ms,started_at')
        .eq('status', 'error')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      return (data ?? []) as PipelineRunRow[]
    },
    [],
    ctx,
  )

  const byStage = new Map<string, PipelineRunRow[]>()
  for (const row of rows) {
    const key = row.stage ?? 'unknown'
    const bucket = byStage.get(key)
    if (bucket) bucket.push(row)
    else byStage.set(key, [row])
  }

  const alerts: Alert[] = []
  for (const [stage, group] of byStage) {
    const count = group.length
    // started_at desc → first element newest, last element oldest.
    const lastSeenAt = group[0].started_at
    const firstSeenAt = group[group.length - 1].started_at
    const severity: AlertSeverity = count >= 3 ? 'critical' : 'warning'
    alerts.push({
      id: alertId('pipeline_error', stage),
      kind: 'pipeline_error',
      severity,
      title: severity === 'critical' ? 'Opakované selhání pipeline' : 'Selhání pipeline',
      detail:
        `Stage "${stage}" zaznamenala ${count}× chybu za posledních 6 hodin.` +
        (group[0].error_summary ? ` Poslední: ${group[0].error_summary}` : ''),
      stage,
      count,
      firstSeenAt,
      lastSeenAt,
    })
  }
  return alerts
}

// ── Detector 2: model_timeout ───────────────────────────────────────────────
// pipeline_runs WHERE (error_summary ILIKE '%timeout%' OR duration_ms > 120000)
// AND started_at >= now-6h, grouped by stage.
async function detectModelTimeouts(
  db: SupabaseClient,
  ctx: DetectorContext,
): Promise<Alert[]> {
  const since = isoMinusMs(WINDOW_6H_MS)
  const rows = await safeKpiQuery<PipelineRunRow[]>(
    'model_timeout',
    async () => {
      const { data, error } = await db
        .from('pipeline_runs')
        .select('id,stage,status,error_summary,duration_ms,started_at')
        .gte('started_at', since)
        .or(`error_summary.ilike.%timeout%,duration_ms.gt.${TIMEOUT_DURATION_MS}`)
        .order('started_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      return (data ?? []) as PipelineRunRow[]
    },
    [],
    ctx,
  )

  const byStage = new Map<string, PipelineRunRow[]>()
  for (const row of rows) {
    const key = row.stage ?? 'unknown'
    const bucket = byStage.get(key)
    if (bucket) bucket.push(row)
    else byStage.set(key, [row])
  }

  const alerts: Alert[] = []
  for (const [stage, group] of byStage) {
    const count = group.length
    const lastSeenAt = group[0].started_at
    const firstSeenAt = group[group.length - 1].started_at
    const slowest = group.reduce(
      (max, r) => Math.max(max, r.duration_ms ?? 0),
      0,
    )
    // >= 3 timeouts in 6h = sustained problem → escalate to critical.
    const severity: AlertSeverity = count >= 3 ? 'critical' : 'warning'
    alerts.push({
      id: alertId('model_timeout', stage),
      kind: 'model_timeout',
      severity,
      title: severity === 'critical' ? 'Opakovaný timeout modelu' : 'Timeout modelu',
      detail:
        `Stage "${stage}" překročila časový limit ${count}× za 6 hodin` +
        (slowest > 0 ? ` (nejpomalejší běh ${Math.round(slowest / 1000)}s, limit ${TIMEOUT_DURATION_MS / 1000}s).` : '.'),
      stage,
      count,
      firstSeenAt,
      lastSeenAt,
    })
  }
  return alerts
}

// ── Detector 3: discarded_spike ─────────────────────────────────────────────
// scout_items discarded count last-1h vs per-hour baseline of prev 6h.
// spike if last-1h > 2x baseline → warning; > 4x baseline → critical.
async function detectDiscardedSpike(
  db: SupabaseClient,
  ctx: DetectorContext,
): Promise<Alert[]> {
  const now = Date.now()
  const lastHourStart = new Date(now - WINDOW_1H_MS).toISOString()
  const baselineStart = new Date(now - 7 * WINDOW_1H_MS).toISOString()

  const countDiscarded = async (sinceIso: string, untilIso: string): Promise<number> => {
    const { count, error } = await db
      .from('scout_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'discarded')
      .gte('updated_at', sinceIso)
      .lt('updated_at', untilIso)
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const nowIso = new Date(now).toISOString()
  const [last1h, prev6h] = await Promise.all([
    safeKpiQuery('discarded_spike.last1h', () => countDiscarded(lastHourStart, nowIso), 0, ctx),
    safeKpiQuery(
      'discarded_spike.prev6h',
      () => countDiscarded(baselineStart, lastHourStart),
      0,
      ctx,
    ),
  ])

  // Per-hour baseline across the 6h window preceding the last hour.
  const baseline = prev6h / 6
  // No baseline yet (cold start) → cannot judge a spike; stay silent.
  if (baseline < 1) return []

  const ratio = last1h / baseline
  if (ratio <= 2) return []

  const severity: AlertSeverity = ratio > 4 ? 'critical' : 'warning'
  return [
    {
      id: alertId('discarded_spike', 'filter'),
      kind: 'discarded_spike',
      severity,
      title: severity === 'critical' ? 'Prudký nárůst zahozených položek' : 'Nárůst zahozených položek',
      detail:
        `Filter zahodil ${last1h} položek za poslední hodinu — ${ratio.toFixed(1)}× ` +
        `nad běžným průměrem (${baseline.toFixed(1)}/h za předchozích 6 hodin).`,
      stage: 'filter',
      count: last1h,
      firstSeenAt: lastHourStart,
      lastSeenAt: nowIso,
    },
  ]
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const db = createAdminClient()
    if (!db) {
      return NextResponse.json(
        { error: { code: 'no_admin_client', message: 'Admin client unavailable' } },
        { status: 500 },
      )
    }

    const ctx: DetectorContext = { degraded: false }

    const [pipelineErrors, modelTimeouts, discardedSpike] = await Promise.all([
      detectPipelineErrors(db, ctx),
      detectModelTimeouts(db, ctx),
      detectDiscardedSpike(db, ctx),
    ])

    const alerts = [...pipelineErrors, ...modelTimeouts, ...discardedSpike].sort((a, b) => {
      const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (rank !== 0) return rank
      // Newest failure first within the same severity tier.
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    })

    const counts = alerts.reduce(
      (acc, a) => {
        acc[a.severity] += 1
        return acc
      },
      { critical: 0, warning: 0, info: 0 },
    )

    const payload: AlertsResponse = {
      generatedAt: new Date().toISOString(),
      alerts,
      counts,
      degraded: ctx.degraded,
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=15',
      },
    })
  } catch (e) {
    logger.error('[hd-central/alerts] fatal', e)
    return NextResponse.json(
      { error: { code: 'alerts_failed', message: 'Failed to compute alerts' } },
      { status: 500 },
    )
  }
}
