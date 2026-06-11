/**
 * evidence-summary.ts — P1-UI-001-EVIDENCE-SURFACE.
 *
 * Pure helper that derives the CEO-facing evidence verdict for a mission from its
 * lifecycleStatus + auditLog, so the UI can show WHY a mission is SIMULATED_ONLY
 * instead of DONE. Renderers MUST visually distinguish these (truth gate rule).
 *
 * Kept pure (no React) so it is unit-testable and reusable by drawer + timeline.
 */

import type { Mission } from './types'

export type EvidenceState = 'verified' | 'simulated' | 'rejected' | 'archived' | 'pending'

export interface EvidenceSummary {
  state: EvidenceState
  /** Short Czech label for the badge. */
  label: string
  tone: 'green' | 'amber' | 'red' | 'slate' | 'gray'
  /** Human reasons pulled from the latest evidence audit entries (newest first). */
  reasons: string[]
}

const EVIDENCE_EVENTS = new Set([
  'EVIDENCE_VERIFIED',
  'MISSION_DONE',
  'MISSION_SIMULATED_ONLY',
  'EVIDENCE_REJECTED',
  'MISSION_ARCHIVED_RETIRED',
  'MISSION_ARCHIVED_DUPLICATE',
])

export function getEvidenceSummary(
  mission: Pick<Mission, 'lifecycleStatus' | 'auditLog'>,
): EvidenceSummary {
  const life = mission.lifecycleStatus
  const log = mission.auditLog ?? []

  // Reasons: notes from evidence-related audit entries, newest first (max 3).
  const reasons = [...log]
    .reverse()
    .filter((e) => EVIDENCE_EVENTS.has(e.event) && e.note)
    .map((e) => e.note as string)
    .slice(0, 3)

  const lastEvidenceEvent = [...log].reverse().find((e) => EVIDENCE_EVENTS.has(e.event))?.event

  if (life === 'MISSION_DONE') {
    return { state: 'verified', label: 'Ověřeno · DONE', tone: 'green', reasons }
  }
  if (life === 'SIMULATED_ONLY') {
    return { state: 'simulated', label: 'Bez důkazu · simulováno', tone: 'amber', reasons }
  }
  if (life === 'ARCHIVED') {
    return { state: 'archived', label: 'Archivováno', tone: 'slate', reasons }
  }
  if (lastEvidenceEvent === 'EVIDENCE_REJECTED') {
    return { state: 'rejected', label: 'Důkaz zamítnut', tone: 'red', reasons }
  }
  return { state: 'pending', label: 'Čeká na důkaz', tone: 'gray', reasons }
}
