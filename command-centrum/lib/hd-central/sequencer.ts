import type { Mission, Phase, Priority } from '@/lib/hd-central/types'

const PHASE_ORDER: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']

const DOMAIN_PHASE: Record<string, Phase> = {
  SECURITY: 'Foundation',
  INFRASTRUCTURE: 'Foundation',
  DATABASE: 'Foundation',
  PIPELINE: 'Build',
  BACKEND: 'Build',
  FRONTEND: 'Build',
  QUALITY: 'Validate',
  DISTRIBUTION: 'Launch',
  ANALYTICS: 'Scale',
  OPERATIONS: 'Scale',
}

const PRIORITY_RANK: Record<Priority, number> = { P0: 4, P1: 3, P2: 2, P3: 1 }

function phaseRank(phase: Phase | undefined): number {
  if (!phase) return PHASE_ORDER.length
  const idx = PHASE_ORDER.indexOf(phase)
  return idx === -1 ? PHASE_ORDER.length : idx
}

function inferPhase(mission: Mission): Phase {
  if (mission.phase) return mission.phase
  const domain = mission.domains?.[0]
  if (domain && DOMAIN_PHASE[domain]) return DOMAIN_PHASE[domain]
  return 'Scale'
}

function priorityRank(priority: Priority | undefined): number {
  if (!priority) return 0
  return PRIORITY_RANK[priority] ?? 0
}

/**
 * Order missions logically: phase precedence → priority → urgencyScore → createdAt.
 * Assigns sequenceIndex on each mission. Returns a new array; does not mutate.
 *
 * Treats `inTimeline === false` as "not on the timeline" — those keep their index undefined.
 */
export function sequenceMissions(missions: Mission[], actorAgent = 'plan-manager'): Mission[] {
  const now = new Date().toISOString()

  const onTimeline: Mission[] = []
  const offTimeline: Mission[] = []
  for (const m of missions) {
    if (m.inTimeline === false) offTimeline.push(m)
    else onTimeline.push(m)
  }

  const ordered = [...onTimeline].sort((a, b) => {
    const phaseDiff = phaseRank(inferPhase(a)) - phaseRank(inferPhase(b))
    if (phaseDiff !== 0) return phaseDiff

    const prioDiff = priorityRank(b.priority) - priorityRank(a.priority)
    if (prioDiff !== 0) return prioDiff

    const urgencyDiff = (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
    if (urgencyDiff !== 0) return urgencyDiff

    const aCreated = Date.parse(a.createdAt ?? '') || 0
    const bCreated = Date.parse(b.createdAt ?? '') || 0
    if (aCreated !== bCreated) return aCreated - bCreated

    return a.id.localeCompare(b.id)
  })

  const indexed = ordered.map((m, i) => ({
    ...m,
    sequenceIndex: i,
    sequencedAt: now,
    sequencedBy: actorAgent,
  }))

  // Preserve offTimeline missions as-is (no sequenceIndex)
  const indexedIds = new Set(indexed.map((m) => m.id))
  const passthrough = offTimeline.map((m) => ({
    ...m,
    sequenceIndex: undefined,
  }))

  // Return in original-mission-order shape (callers usually re-sort anyway, but keep stable):
  return missions.map((original) => {
    if (indexedIds.has(original.id)) {
      return indexed.find((m) => m.id === original.id) as Mission
    }
    return passthrough.find((m) => m.id === original.id) ?? original
  })
}

export function setMissionsOnTimeline(
  missions: Mission[],
  ids: string[],
  actorAgent = 'plan-manager',
): Mission[] {
  const idSet = new Set(ids)
  const updated = missions.map((m) =>
    idSet.has(m.id) ? { ...m, inTimeline: true } : m,
  )
  return sequenceMissions(updated, actorAgent)
}

export function pushAllToTimeline(missions: Mission[], actorAgent = 'plan-manager'): Mission[] {
  const updated = missions.map((m) =>
    m.inTimeline === false && !m.isDeleted ? { ...m, inTimeline: true } : m,
  )
  return sequenceMissions(updated, actorAgent)
}

export function pullMissionFromTimeline(missions: Mission[], id: string): Mission[] {
  const updated = missions.map((m) =>
    m.id === id ? { ...m, inTimeline: false, sequenceIndex: undefined } : m,
  )
  return sequenceMissions(updated)
}
