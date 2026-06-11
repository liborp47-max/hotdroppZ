/**
 * Intel Retention — per-source TTL enforcement.
 *
 * Mission spec: "Audit logs forever, run logs 90 dní, real-time events 7 dní."
 * Plan-manager risk #3 honored: per-source table (intel_retention_policies)
 * NOT a global enum — audit_record retention_days = null → forever (delete
 * function explicitly skips null TTL).
 *
 * Strategy: delegate purge to the SQL function intel_purge_expired() which
 * reads policies and deletes from source tables. This layer is a typed
 * wrapper + REST entry-point friendly shape.
 *
 * Forward-compat: if function missing, returns empty result + degraded=true.
 */

import type { IntelDb, PurgeResult, RetentionPolicy } from './types.ts'

export interface PurgeReport {
  results: PurgeResult[]
  totalPurged: number
  ranAt: string
  degraded: boolean
  error?: string
}

export async function purgeExpired(db: IntelDb, now: Date = new Date()): Promise<PurgeReport> {
  try {
    const { data, error } = await db.rpc('intel_purge_expired')
    if (error) {
      return {
        results: [],
        totalPurged: 0,
        ranAt: now.toISOString(),
        degraded: true,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    type RpcRow = { source: string; purged_count: number | string }
    const results: PurgeResult[] = ((data ?? []) as RpcRow[]).map((r) => ({
      source: r.source,
      purgedCount: typeof r.purged_count === 'number' ? r.purged_count : Number(r.purged_count) || 0,
    }))
    const totalPurged = results.reduce((sum, r) => sum + r.purgedCount, 0)
    return { results, totalPurged, ranAt: now.toISOString(), degraded: false }
  } catch (err) {
    return {
      results: [],
      totalPurged: 0,
      ranAt: now.toISOString(),
      degraded: true,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function getPolicies(db: IntelDb): Promise<RetentionPolicy[]> {
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

/**
 * Safety check — list policies where retentionDays would purge audit-class
 * data. Callers should refuse to apply such policies.
 */
export function findUnsafePolicies(policies: RetentionPolicy[]): RetentionPolicy[] {
  return policies.filter((p) => {
    if (p.source.includes('audit') && p.retentionDays !== null) return true
    return false
  })
}
