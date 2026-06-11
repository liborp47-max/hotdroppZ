/**
 * Mission SLA tracking + alerts (UM-MISSIONS_UI — SM3).
 *
 * Missions carry a deadline (`slaDeadline`), an impact `severity` and an
 * `ownerAgent`. This module derives an SLA status per mission and builds an
 * ordered alert feed for missions that have missed — or are about to miss —
 * their SLA. Pure module: no I/O.
 */
import type { Mission, Severity } from '@/lib/hd-central/types'
import { deriveTimelineState } from './mission-state-machine'

export type SlaStatus = 'none' | 'ok' | 'at_risk' | 'breached'

/** Hours before the deadline at which a mission is flagged `at_risk`. */
export const SLA_AT_RISK_WINDOW_HOURS = 24

const HOUR_MS = 3_600_000

const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Unknown: 0,
}

/**
 * SLA status of a single mission at a given time.
 * `none`     — no deadline set, nothing to track.
 * `ok`       — within SLA (or already done).
 * `at_risk`  — deadline is within SLA_AT_RISK_WINDOW_HOURS.
 * `breached` — deadline has passed and the mission is not done.
 */
export function slaStatus(mission: Mission, now: Date = new Date()): SlaStatus {
  if (!mission.slaDeadline) return 'none'
  const deadline = Date.parse(mission.slaDeadline)
  if (Number.isNaN(deadline)) return 'none'

  // A completed mission can never breach its SLA.
  if (deriveTimelineState(mission) === 'done') return 'ok'

  const msLeft = deadline - now.getTime()
  if (msLeft < 0) return 'breached'
  if (msLeft <= SLA_AT_RISK_WINDOW_HOURS * HOUR_MS) return 'at_risk'
  return 'ok'
}

export type SlaAlert = {
  missionId: string
  missionName: string
  status: 'at_risk' | 'breached'
  slaDeadline: string
  severity: Severity
  ownerAgent: string
  /** Hours past the deadline. Negative while still within SLA (`at_risk`). */
  hoursOverdue: number
}

/**
 * Builds an ordered alert feed for every non-deleted mission that has missed
 * or is about to miss its SLA. Most urgent first: breached before at_risk,
 * then by severity, then by how overdue it is.
 */
export function computeSlaAlerts(missions: Mission[], now: Date = new Date()): SlaAlert[] {
  const alerts: SlaAlert[] = []

  for (const mission of missions) {
    if (mission.isDeleted) continue
    const status = slaStatus(mission, now)
    if (status !== 'breached' && status !== 'at_risk') continue

    const deadline = Date.parse(mission.slaDeadline as string)
    alerts.push({
      missionId: mission.id,
      missionName: mission.name,
      status,
      slaDeadline: mission.slaDeadline as string,
      severity: mission.severity ?? 'Unknown',
      ownerAgent: mission.ownerAgent ?? mission.subMissions?.[0]?.owner ?? 'unassigned',
      hoursOverdue: Math.round((now.getTime() - deadline) / HOUR_MS),
    })
  }

  return alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'breached' ? -1 : 1
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (severityDiff !== 0) return severityDiff
    return b.hoursOverdue - a.hoursOverdue
  })
}
