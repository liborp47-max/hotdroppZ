/**
 * Mission Timeline audit trail (UM-MISSIONS_UI — SM4).
 *
 * Persists every timeline-state transition (timestamp / actor / reason) to
 * disk under the Audit Storage Standard:
 *   SYSTEM/INFO/AUDITS/MISSION_TIMELINE_AUDIT/<YYYY-MM-DD>/transitions.log
 *
 * Format is one TSV row per transition. `appendTimelineAudit` never throws —
 * a failed audit write must not break a mission transition.
 */
import fs from 'fs'
import path from 'path'
import type { MissionTimelineTransition } from '@/lib/hd-central/types'

/** Audit type folder under SYSTEM/INFO/AUDITS (AGENTS.md storage standard). */
export const TIMELINE_AUDIT_TYPE = 'MISSION_TIMELINE_AUDIT'

/** Default AUDITS root: command-centrum/../../INFO/AUDITS == SYSTEM/INFO/AUDITS. */
function defaultAuditRoot(): string {
  return path.join(process.cwd(), '..', '..', 'INFO', 'AUDITS', TIMELINE_AUDIT_TYPE)
}

function dayDir(root: string, date: Date): string {
  return path.join(root, date.toISOString().slice(0, 10))
}

function tsvSafe(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ')
}

export type TimelineAuditRow = {
  ts: string
  missionId: string
  from: string
  to: string
  actor: string
  reason: string
}

export type AuditTrailOptions = {
  /** Override the AUDITS root — used by tests to write into a temp dir. */
  auditRoot?: string
}

/**
 * Appends one mission timeline transition to the daily audit trail file.
 * Returns true on success, false on any failure (never throws).
 */
export function appendTimelineAudit(
  missionId: string,
  transition: MissionTimelineTransition,
  opts: AuditTrailOptions = {},
): boolean {
  try {
    const root = opts.auditRoot ?? defaultAuditRoot()
    const dir = dayDir(root, new Date(transition.ts))
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const line =
      [
        transition.ts,
        tsvSafe(missionId),
        transition.from,
        transition.to,
        tsvSafe(transition.actor),
        tsvSafe(transition.reason),
      ].join('\t') + '\n'

    fs.appendFileSync(path.join(dir, 'transitions.log'), line, 'utf-8')
    return true
  } catch {
    return false
  }
}

/** Appends a batch of transitions for one mission. Returns the count written. */
export function appendTimelineAuditBatch(
  missionId: string,
  transitions: MissionTimelineTransition[],
  opts: AuditTrailOptions = {},
): number {
  let written = 0
  for (const transition of transitions) {
    if (appendTimelineAudit(missionId, transition, opts)) written += 1
  }
  return written
}

/** Reads back the timeline audit trail for a given day. Empty array if none. */
export function readTimelineAudit(
  date: Date = new Date(),
  opts: AuditTrailOptions = {},
): TimelineAuditRow[] {
  try {
    const root = opts.auditRoot ?? defaultAuditRoot()
    const file = path.join(dayDir(root, date), 'transitions.log')
    if (!fs.existsSync(file)) return []

    const rows: TimelineAuditRow[] = []
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
      if (!line) continue
      const [ts, missionId, from, to, actor, reason] = line.split('\t')
      if (!ts || !missionId) continue
      rows.push({ ts, missionId, from, to, actor, reason: reason ?? '' })
    }
    return rows
  } catch {
    return []
  }
}
