/**
 * Evidence contract — what a mission must produce to be promoted to MISSION_DONE.
 *
 * UM-MISSION_TRUTH_GATE / #02. AUD-20260523-05 surfaced that the orchestrator
 * was writing `MISSION_DONE` for missions whose sub-mission reports were
 * fabricated PASS without real build/test/runtime artifacts. This module is
 * the gate: every promotion to `MISSION_DONE` must call
 * `evaluateEvidence(...)` and only proceed when `verdict === 'PASS'`.
 *
 * The companion type `MissionLifecycleStatus` (types.ts) now includes
 * `SIMULATED_ONLY` for missions whose sub-missions completed but failed this
 * gate. Renderers MUST visually distinguish SIMULATED_ONLY from MISSION_DONE.
 */

import type { Mission } from './types'

export interface MissionEvidence {
  /** Tests actually executed for this mission. Empty array = no evidence. */
  testsRun: Array<{
    name: string
    /** Exit code or pass/fail (use 'PASS' / 'FAIL' for non-numeric). */
    result: 'PASS' | 'FAIL' | number
    output?: string
  }>
  /** File paths the mission modified, with optional line ranges. */
  changedFiles: string[]
  /** External artefacts produced (audit doc, schema migration, etc.). */
  deliverables: string[]
  /** Final verdict from @system-auditor cross-check. */
  auditorVerdict: 'PASS' | 'FAIL' | 'SIMULATED_ONLY' | 'PENDING'
  /** Optional: build/runtime commands and their captured exit codes. */
  realDbOrRuntime?: {
    command: string
    exitCode: number
    summary?: string
  }[]
}

export interface EvidenceEvaluation {
  verdict: 'PASS' | 'SIMULATED_ONLY' | 'FAIL'
  reasons: string[]
}

const MIN_TESTS = 1
const MIN_DELIVERABLES = 1

/**
 * Gate decision for promoting a mission to MISSION_DONE.
 *
 *   PASS            — evidence pack complete + auditorVerdict PASS
 *   SIMULATED_ONLY  — sub-missions done but pack incomplete (e.g. no real
 *                     test exit codes, no auditor sign-off). Mission stays
 *                     in this terminal-but-not-solved state until evidence
 *                     is provided.
 *   FAIL            — auditor explicitly rejected, or required artefacts
 *                     declared FAIL.
 */
export function evaluateEvidence(
  mission: Pick<Mission, 'id' | 'subMissions' | 'successCriteria'>,
  evidence: MissionEvidence,
): EvidenceEvaluation {
  const reasons: string[] = []

  // 1. Auditor verdict is the strongest signal.
  if (evidence.auditorVerdict === 'FAIL') {
    return { verdict: 'FAIL', reasons: ['Auditor verdict: FAIL'] }
  }

  // 2. Tests-run check.
  if (!Array.isArray(evidence.testsRun) || evidence.testsRun.length < MIN_TESTS) {
    reasons.push(`No tests executed (require >= ${MIN_TESTS})`)
  } else {
    const failed = evidence.testsRun.filter((t) =>
      t.result === 'FAIL' || (typeof t.result === 'number' && t.result !== 0),
    )
    if (failed.length > 0) {
      return {
        verdict: 'FAIL',
        reasons: [`Test failures: ${failed.map((t) => t.name).join(', ')}`],
      }
    }
  }

  // 3. Files-changed check (covers code-level work).
  if (!Array.isArray(evidence.changedFiles) || evidence.changedFiles.length === 0) {
    reasons.push('No changedFiles recorded — mission cannot be MISSION_DONE without surface area touched')
  }

  // 4. Deliverables check (covers docs-only sub-missions).
  if (!Array.isArray(evidence.deliverables) || evidence.deliverables.length < MIN_DELIVERABLES) {
    reasons.push(`No deliverables recorded (require >= ${MIN_DELIVERABLES})`)
  }

  // 5. Sub-mission completion check.
  const subs = mission.subMissions ?? []
  if (subs.length > 0) {
    const undone = subs.filter((s) => s.status !== 'done')
    if (undone.length > 0) {
      reasons.push(`${undone.length} sub-mission(s) still open: ${undone.map((s) => s.id).join(', ')}`)
    }
  }

  // 6. Auditor sign-off explicitly required.
  if (evidence.auditorVerdict !== 'PASS') {
    reasons.push(`Auditor verdict required (PASS) — got "${evidence.auditorVerdict}"`)
  }

  if (reasons.length === 0) {
    return { verdict: 'PASS', reasons: [] }
  }
  return { verdict: 'SIMULATED_ONLY', reasons }
}

/**
 * Convenience guard for the promotion path. Throws when evidence rejects.
 * Use in the API handler that transitions lifecycleStatus -> MISSION_DONE.
 */
export function requireEvidenceForDone(
  mission: Pick<Mission, 'id' | 'subMissions' | 'successCriteria'>,
  evidence: MissionEvidence,
): void {
  const result = evaluateEvidence(mission, evidence)
  if (result.verdict !== 'PASS') {
    const err = new Error(
      `Cannot promote mission ${mission.id} to MISSION_DONE: ${result.verdict}. ` +
        `Reasons: ${result.reasons.join('; ')}`,
    )
    ;(err as Error & { code?: string; verdict?: string }).code = 'EVIDENCE_REJECTED'
    ;(err as Error & { code?: string; verdict?: string }).verdict = result.verdict
    throw err
  }
}
