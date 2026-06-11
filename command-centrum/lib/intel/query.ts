/**
 * Intel Query API — read side of intel_events VIEW.
 *
 * Forward-compat: if intel_events VIEW missing (migration not applied),
 * methods return empty + degraded=true. Same pattern as SRL kernel.
 *
 * Plan-manager risks honored:
 *   #4 correlation_id propagation — getEventsByCorrelation lets UI build
 *      drill-down without backfill assumption
 *   #2 schema drift — view-side handles COALESCE; query trusts shape
 */

import type {
  IntelDb,
  IntelEvent,
  IntelEventBatch,
  IntelEventFilter,
  IntelEventKind,
  IntelSeverity,
  RetentionPolicy,
} from './types.ts'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

interface IntelEventRow {
  id: string
  kind: IntelEventKind
  source_table: string
  stage: string | null
  status: string | null
  severity: IntelSeverity
  actor: string
  correlation_id: string | null
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface QueryResult {
  events: IntelEvent[]
  total: number
  degraded: boolean
}

export async function queryEvents(
  db: IntelDb,
  filter: IntelEventFilter = {},
): Promise<QueryResult> {
  const limit = clamp(filter.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = Math.max(0, filter.offset ?? 0)

  try {
    let query = db.from('intel_events').select('*', { count: 'exact' } as never)
    if (filter.kinds && filter.kinds.length > 0) {
      query = query.in('kind', filter.kinds)
    }
    if (filter.severities && filter.severities.length > 0) {
      query = query.in('severity', filter.severities)
    }
    if (filter.stages && filter.stages.length > 0) {
      query = query.in('stage', filter.stages)
    }
    if (filter.actor) {
      query = query.eq('actor', filter.actor)
    }
    if (filter.correlationId) {
      query = query.eq('correlation_id', filter.correlationId)
    }
    if (filter.since) {
      query = query.gte('started_at', filter.since)
    }
    if (filter.until) {
      query = query.lte('started_at', filter.until)
    }
    if (filter.q && filter.q.trim()) {
      const needle = `%${filter.q.trim().replace(/[%_]/g, '\\$&')}%`
      query = query.or(`message.ilike.${needle},actor.ilike.${needle},stage.ilike.${needle}`)
    }
    query = query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = (await query) as {
      data: IntelEventRow[] | null
      error: { message?: string } | null
      count: number | null
    }

    if (error) {
      return { events: [], total: 0, degraded: true }
    }

    return {
      events: (data ?? []).map(rowToEvent),
      total: count ?? data?.length ?? 0,
      degraded: false,
    }
  } catch {
    return { events: [], total: 0, degraded: true }
  }
}

export async function getEventById(db: IntelDb, id: string): Promise<IntelEvent | null> {
  try {
    const { data, error } = await db
      .from('intel_events')
      .select('*')
      .eq('id', id)
      .limit(1)
    if (error || !data || data.length === 0) return null
    return rowToEvent(data[0] as IntelEventRow)
  } catch {
    return null
  }
}

/** Drill-down — returns all events sharing a correlation_id, ordered chronologically. */
export async function getEventsByCorrelation(
  db: IntelDb,
  correlationId: string,
): Promise<IntelEvent[]> {
  try {
    const { data, error } = await db
      .from('intel_events')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('started_at', { ascending: true })
      .limit(MAX_LIMIT)
    if (error || !data) return []
    return (data as IntelEventRow[]).map(rowToEvent)
  } catch {
    return []
  }
}

/** Timeline aggregation — buckets events by hour for SVG timeline component. */
export interface TimelineBucket {
  hourIso: string
  count: number
  errorCount: number
}

export function bucketEventsByHour(events: IntelEvent[]): TimelineBucket[] {
  const buckets = new Map<string, TimelineBucket>()
  for (const ev of events) {
    const hourIso = ev.startedAt.slice(0, 13) + ':00:00.000Z'
    const existing = buckets.get(hourIso) ?? { hourIso, count: 0, errorCount: 0 }
    existing.count += 1
    if (ev.severity === 'error' || ev.severity === 'critical') {
      existing.errorCount += 1
    }
    buckets.set(hourIso, existing)
  }
  return Array.from(buckets.values()).sort((a, b) => (a.hourIso < b.hourIso ? -1 : 1))
}

export async function listRetentionPolicies(db: IntelDb): Promise<RetentionPolicy[]> {
  try {
    const { data, error } = await db
      .from('intel_retention_policies')
      .select('source, retention_days, description')
      .order('source')
    if (error || !data) return []
    type Row = { source: string; retention_days: number | null; description: string | null }
    return (data as Row[]).map((r) => ({
      source: r.source,
      retentionDays: r.retention_days,
      description: r.description,
    }))
  } catch {
    return []
  }
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function rowToEvent(row: IntelEventRow): IntelEvent {
  return {
    id: row.id,
    kind: row.kind,
    sourceTable: row.source_table,
    stage: row.stage,
    status: row.status,
    severity: row.severity,
    actor: row.actor,
    correlationId: row.correlation_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    message: row.message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}
