import type { Mission, Plan } from '@/lib/hd-central/types'

/**
 * Emit-side dedup guard (UM-FOLLOWUP_GUARD, run-20260603).
 *
 * Stops the mission-prompt generator from handing out fresh "solve this" prompts
 * for work that is already MISSION_DONE or is a no-op +N duplicate of a completed
 * module (UM-WRITER -> +1 -> +1+1 ...). This mirrors the lifecycle follow-up guard
 * but at the SOURCE, so the prompt never reaches a human in the first place.
 *
 * Pure + dependency-free (type-only imports) so it is unit-testable and shared by
 * both the mission and sub-mission prompt routes.
 */
export type EmitGuard =
  | { blocked: true; reason: 'mission_already_done' | 'duplicate_of_completed'; message: string; baseId?: string }
  | null

/** "UM-FEED_UI+1+1" -> "UM-FEED_UI" (strip the +N follow-up suffix chain). */
export function baseMissionId(id: string): string {
  return id.split('+')[0]
}

export function checkEmitGuard(mission: Mission, plan: Plan): EmitGuard {
  if (mission.lifecycleStatus === 'MISSION_DONE') {
    return {
      blocked: true,
      reason: 'mission_already_done',
      message: `Mise ${mission.id} je již MISSION_DONE — solve prompt se neemituje. Deduplikuj backlog proti hotovým runům.`,
    }
  }

  // Un-worked follow-up whose base module is already DONE = pure +N duplicate.
  const executed = (mission.subMissions ?? []).some((s) => (s.status ?? 'todo') === 'done')
  if (mission.isFollowUp && !executed) {
    const baseId = baseMissionId(mission.id)
    const base = plan.missions.find((m) => m.id === baseId)
    if (base?.lifecycleStatus === 'MISSION_DONE') {
      return {
        blocked: true,
        reason: 'duplicate_of_completed',
        baseId,
        message: `Follow-up ${mission.id} duplikuje už hotový ${baseId} a nemá žádný provedený krok — solve prompt se neemituje. Vyžaduje human triage, ne další +N re-run.`,
      }
    }
  }

  return null
}

/** Human-readable notice returned in place of an actionable solve prompt. */
export function blockedNotice(missionId: string, guard: NonNullable<EmitGuard>): string {
  return `# Mission ${missionId} — NOT EMITTED (${guard.reason})

${guard.message}

Tato mise se neprocesuje. Viz lifecycle follow-up guard (MAX_FOLLOWUP_LEVEL) a
report run-20260603-um-followup-guard. Pokud je potřeba reálná práce, otevři
cílenou misi proti živému modulu místo +N follow-upu.`
}
