/**
 * Scout HQ — scout-item dashboard helpers (UM-SCOUT_HQ, re-scope: live wiring).
 *
 * Pure module — no I/O, no framework imports — so it is unit-testable in
 * isolation (`node --experimental-strip-types`). Backs the live Scout HQ
 * DroppZ dashboard: bulk-action resolution, item filtering, run-history
 * filtering + aggregation.
 */

export type ScoutItemPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface ScoutItemRow {
  id: string
  title: string
  title_en?: string | null
  source: string | null
  category: string | null
  status: string
  priority: string | null
  is_release?: boolean | null
  release_type?: string | null
  attention_score?: number | null
  created_at: string
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────

export type BulkActionId = 'move_to_translated' | 'discard'

export interface BulkActionSpec {
  id: BulkActionId
  label: string
  /** Item must currently sit in one of these statuses for the action to apply. */
  fromStatuses: string[]
  toStatus: string
}

export const BULK_ACTIONS: Record<BulkActionId, BulkActionSpec> = {
  move_to_translated: {
    id: 'move_to_translated',
    label: 'Move to Translated',
    fromStatuses: ['SCOUTED'],
    toStatus: 'TRANSLATED',
  },
  discard: {
    id: 'discard',
    label: 'Discard',
    fromStatuses: ['new', 'SCOUTED', 'TRANSLATED', 'CURATED'],
    toStatus: 'discarded',
  },
}

/** Resolves a raw action string to its spec, or null when unknown. */
export function resolveBulkAction(action: string): BulkActionSpec | null {
  return BULK_ACTIONS[action as BulkActionId] ?? null
}

/** True when a bulk action can legally apply to an item in its current status. */
export function canApplyBulkAction(item: { status: string }, action: BulkActionId): boolean {
  const spec = BULK_ACTIONS[action]
  if (!spec) return false
  return spec.fromStatuses.includes(item.status)
}

/**
 * Splits a selection into ids the action can apply to and ids it must skip.
 * Drives the manual-override UI feedback ("N applied, M skipped").
 */
export function partitionBulkTargets<T extends { id: string; status: string }>(
  items: T[],
  action: BulkActionId,
): { applicable: string[]; skipped: string[] } {
  const applicable: string[] = []
  const skipped: string[] = []
  for (const item of items) {
    if (canApplyBulkAction(item, action)) applicable.push(item.id)
    else skipped.push(item.id)
  }
  return { applicable, skipped }
}

// ─── Item filtering ───────────────────────────────────────────────────────────

export interface ScoutItemFilter {
  status?: string
  priority?: string
  search?: string
}

/** Pure client/server filter for the scout-item table. */
export function filterScoutItems<T extends ScoutItemRow>(items: T[], filter: ScoutItemFilter): T[] {
  const search = filter.search?.trim().toLowerCase()
  return items.filter((item) => {
    if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.priority && filter.priority !== 'all' && item.priority !== filter.priority) return false
    if (search) {
      const haystack = `${item.title} ${item.source ?? ''} ${item.category ?? ''}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

// ─── Run history ──────────────────────────────────────────────────────────────

export interface ScoutRunRow {
  id: string
  status: string                // running | complete | error
  sources_count: number
  items_found: number
  duration_ms: number | null
  triggered_by: string
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface RunFilter {
  status?: string
  /** ISO lower bound on started_at. */
  since?: string
}

/** Filters scout runs by status and a started-at lower bound. */
export function filterRuns(runs: ScoutRunRow[], filter: RunFilter): ScoutRunRow[] {
  const sinceMs = filter.since ? Date.parse(filter.since) : Number.NaN
  return runs.filter((run) => {
    if (filter.status && filter.status !== 'all' && run.status !== filter.status) return false
    if (!Number.isNaN(sinceMs) && Date.parse(run.started_at) < sinceMs) return false
    return true
  })
}

export interface RunSummary {
  total: number
  complete: number
  errors: number
  running: number
  itemsFound: number
  errorRate: number             // 0..1, rounded to 2 decimals
}

/** Aggregates a run list into headline stats for the run-history panel. */
export function summarizeRuns(runs: ScoutRunRow[]): RunSummary {
  const total = runs.length
  const complete = runs.filter((r) => r.status === 'complete').length
  const errors = runs.filter((r) => r.status === 'error').length
  const running = runs.filter((r) => r.status === 'running').length
  const itemsFound = runs.reduce((sum, r) => sum + (r.items_found ?? 0), 0)
  return {
    total,
    complete,
    errors,
    running,
    itemsFound,
    errorRate: total > 0 ? Math.round((errors / total) * 100) / 100 : 0,
  }
}
