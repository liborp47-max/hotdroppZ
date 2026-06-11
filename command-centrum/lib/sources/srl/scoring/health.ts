/**
 * Health derivation — spec §Scoring algoritmy.
 *
 * errorRate24h = failed_runs / total_runs
 * health = 'green'  if errorRate24h < 0.05
 *        | 'amber'  if errorRate24h < 0.20
 *        | 'red'    if errorRate24h >= 0.20 || not run in 48h
 *
 * Forward-compat: when worker_runs table is missing (PR-S1 not shipped),
 * deriveHealth() returns 'unknown' — never throws.
 */

import type { SourceHealthStatus, SrlDb } from '../types.ts'

const NO_RUN_THRESHOLD_MS = 48 * 60 * 60 * 1000

export interface RunCounters {
  total: number
  failed: number
  lastRunAt?: string
}

export function deriveHealthFromCounters(
  counters: RunCounters | null,
  now: Date = new Date(),
): SourceHealthStatus {
  if (!counters || counters.total === 0) return 'unknown'

  if (counters.lastRunAt) {
    const lastRunMs = Date.parse(counters.lastRunAt)
    if (!Number.isNaN(lastRunMs) && now.getTime() - lastRunMs > NO_RUN_THRESHOLD_MS) {
      return 'red'
    }
  }

  const errorRate = counters.failed / counters.total
  if (errorRate < 0.05) return 'green'
  if (errorRate < 0.20) return 'amber'
  return 'red'
}

/**
 * Batched fetch — pulls run counters for many sources in one query.
 * Returns Map<sourceId, RunCounters>. Empty map if worker_runs table missing.
 *
 * N+1 protection: single SELECT with GROUP BY, never per-source query.
 */
export async function fetchRunCountersBatch(
  db: SrlDb,
  sourceIds: string[],
  windowMs: number = 24 * 60 * 60 * 1000,
  now: Date = new Date(),
): Promise<Map<string, RunCounters>> {
  const result = new Map<string, RunCounters>()
  if (sourceIds.length === 0) return result

  const sinceIso = new Date(now.getTime() - windowMs).toISOString()

  try {
    const { data, error } = await db
      .from('worker_runs')
      .select('source_id, status, started_at')
      .in('source_id', sourceIds)
      .gte('started_at', sinceIso)

    if (error || !data) return result

    type Row = { source_id: string; status: string; started_at: string }
    for (const row of data as Row[]) {
      const existing = result.get(row.source_id) ?? { total: 0, failed: 0 }
      existing.total += 1
      if (row.status === 'failure' || row.status === 'error' || row.status === 'failed') {
        existing.failed += 1
      }
      if (!existing.lastRunAt || row.started_at > existing.lastRunAt) {
        existing.lastRunAt = row.started_at
      }
      result.set(row.source_id, existing)
    }
  } catch {
    // worker_runs table missing (PR-S1 not yet shipped) — graceful empty map
  }

  return result
}

/**
 * Convenience: derive health for many sources in a single batch query.
 * Returns Map<sourceId, SourceHealthStatus>; sources missing from worker_runs
 * default to 'unknown'.
 */
export async function deriveHealthBatch(
  db: SrlDb,
  sourceIds: string[],
  now: Date = new Date(),
): Promise<Map<string, SourceHealthStatus>> {
  const counters = await fetchRunCountersBatch(db, sourceIds, 24 * 60 * 60 * 1000, now)
  const out = new Map<string, SourceHealthStatus>()
  for (const id of sourceIds) {
    out.set(id, deriveHealthFromCounters(counters.get(id) ?? null, now))
  }
  return out
}
