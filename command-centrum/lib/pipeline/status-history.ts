/**
 * Status-history helpers (UM-CC_AUDIT_TRAIL / SM3 support).
 *
 * Pure functions to maintain scout_items.status_history at the app layer and to
 * merge status transitions + audit_log rows into a single chronological timeline
 * for the /items/:id/history endpoint. Dependency-free => unit-testable.
 */

export interface StatusTransition {
  status: string
  changed_at: string // ISO
  reason?: string | null
  user_id?: string | null
}

export interface AuditLogEntry {
  action: string
  changes?: Record<string, { old: unknown; new: unknown }>
  changed_at: string // ISO
  changed_by?: string | null
  entity_type?: string
}

export interface TimelineEvent {
  kind: 'status' | 'audit'
  at: string // ISO
  label: string
  detail?: string
}

/** Tolerant parse of a status_history jsonb value (array, JSON string, or null). */
export function parseStatusHistory(raw: unknown): StatusTransition[] {
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
    .map((e) => ({
      status: String(e.status ?? ''),
      changed_at: String(e.changed_at ?? ''),
      reason: (e.reason as string | null | undefined) ?? null,
      user_id: (e.user_id as string | null | undefined) ?? null,
    }))
    .filter((t) => t.status !== '')
}

/**
 * Append a transition — mirrors the DB trigger so app-layer status updates keep
 * status_history consistent. No-op when the status is unchanged from the last
 * entry (avoids duplicate consecutive records).
 */
export function appendStatusTransition(
  history: StatusTransition[],
  transition: { status: string; changed_at?: string; reason?: string | null; user_id?: string | null },
): StatusTransition[] {
  const last = history[history.length - 1]
  if (last && last.status === transition.status) return history
  return [
    ...history,
    {
      status: transition.status,
      changed_at: transition.changed_at ?? new Date().toISOString(),
      reason: transition.reason ?? null,
      user_id: transition.user_id ?? null,
    },
  ]
}

/** Merge status transitions + audit-log rows into one chronological timeline. */
export function buildHistoryTimeline(
  statusHistory: StatusTransition[],
  auditLog: AuditLogEntry[] = [],
): TimelineEvent[] {
  const fromStatus: TimelineEvent[] = statusHistory.map((t) => ({
    kind: 'status',
    at: t.changed_at,
    label: `status -> ${t.status}`,
    detail: t.reason ?? undefined,
  }))
  const fromAudit: TimelineEvent[] = auditLog.map((a) => ({
    kind: 'audit',
    at: a.changed_at,
    label: a.action,
    detail: a.changes ? Object.keys(a.changes).join(', ') : undefined,
  }))
  return [...fromStatus, ...fromAudit].sort((x, y) => {
    const dx = Date.parse(x.at) || 0
    const dy = Date.parse(y.at) || 0
    return dx - dy
  })
}
