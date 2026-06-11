/**
 * Factory Coordinator state machine (UM-FACTORY — SM1).
 *
 * Models the content-assembly pipeline as a dependency DAG and derives a
 * parallel execution plan: stages with no dependency between them run in the
 * same batch. Also a per-stage state machine (pending → running → done|failed,
 * failed → running retry).
 *
 * Pure module — no I/O, no framework imports — unit-testable in isolation.
 */

export type FactoryStageId = 'cluster' | 'story_builder' | 'writer' | 'enrichment' | 'creator'

export type StageState = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface FactoryStage {
  id: FactoryStageId
  label: string
  /** Stages that must reach `done` before this stage can run. */
  dependsOn: FactoryStageId[]
}

/**
 * Canonical DAG. cluster is the root; story_builder and enrichment both depend
 * only on cluster (→ run in parallel); writer depends on story_builder;
 * creator depends on writer AND enrichment.
 */
export const FACTORY_STAGES: Record<FactoryStageId, FactoryStage> = {
  cluster: { id: 'cluster', label: 'Cluster', dependsOn: [] },
  story_builder: { id: 'story_builder', label: 'Story Builder', dependsOn: ['cluster'] },
  enrichment: { id: 'enrichment', label: 'Enrichment', dependsOn: ['cluster'] },
  writer: { id: 'writer', label: 'Writer', dependsOn: ['story_builder'] },
  creator: { id: 'creator', label: 'Creator', dependsOn: ['writer', 'enrichment'] },
}

const STAGE_TRANSITIONS: Record<StageState, StageState[]> = {
  pending: ['running', 'skipped'],
  running: ['done', 'failed'],
  done: [],
  failed: ['running'], // retry / replay
  skipped: [],
}

export function canTransitionStage(from: StageState, to: StageState): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Topologically batches the DAG. Each returned batch is a set of stage ids
 * with all dependencies satisfied by earlier batches — stages within one batch
 * are safe to run in parallel. Throws if the DAG contains a cycle.
 */
export function computeExecutionPlan(
  stages: Record<FactoryStageId, FactoryStage> = FACTORY_STAGES,
): FactoryStageId[][] {
  const ids = Object.keys(stages) as FactoryStageId[]
  const done = new Set<FactoryStageId>()
  const plan: FactoryStageId[][] = []

  while (done.size < ids.length) {
    const batch = ids.filter(
      (id) => !done.has(id) && stages[id].dependsOn.every((dep) => done.has(dep)),
    )
    if (batch.length === 0) {
      throw new Error('cycle detected in factory stage DAG')
    }
    for (const id of batch) done.add(id)
    plan.push(batch)
  }
  return plan
}

/** Validates that every dependency references a known stage and the DAG is acyclic. */
export function validateDag(stages: Record<FactoryStageId, FactoryStage> = FACTORY_STAGES): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const ids = new Set(Object.keys(stages))
  for (const stage of Object.values(stages)) {
    for (const dep of stage.dependsOn) {
      if (!ids.has(dep)) errors.push(`${stage.id} depends on unknown stage '${dep}'`)
    }
  }
  if (errors.length === 0) {
    try {
      computeExecutionPlan(stages)
    } catch {
      errors.push('cycle detected in factory stage DAG')
    }
  }
  return { valid: errors.length === 0, errors }
}

/** Transitively collects all dependencies of a stage. */
function allDependencies(
  id: FactoryStageId,
  stages: Record<FactoryStageId, FactoryStage>,
  acc: Set<FactoryStageId> = new Set(),
): Set<FactoryStageId> {
  for (const dep of stages[id].dependsOn) {
    if (!acc.has(dep)) {
      acc.add(dep)
      allDependencies(dep, stages, acc)
    }
  }
  return acc
}

/** True when two stages have no transitive dependency between them — safe to parallelize. */
export function isParallelizable(
  a: FactoryStageId,
  b: FactoryStageId,
  stages: Record<FactoryStageId, FactoryStage> = FACTORY_STAGES,
): boolean {
  if (a === b) return false
  return !allDependencies(a, stages).has(b) && !allDependencies(b, stages).has(a)
}

/** True when every dependency of `id` is `done` in the given state map. */
export function canStageRun(
  id: FactoryStageId,
  states: Partial<Record<FactoryStageId, StageState>>,
  stages: Record<FactoryStageId, FactoryStage> = FACTORY_STAGES,
): boolean {
  return stages[id].dependsOn.every((dep) => states[dep] === 'done')
}

/** Pending stages whose dependencies are all satisfied — the next parallel batch. */
export function nextRunnableStages(
  states: Partial<Record<FactoryStageId, StageState>>,
  stages: Record<FactoryStageId, FactoryStage> = FACTORY_STAGES,
): FactoryStageId[] {
  return (Object.keys(stages) as FactoryStageId[]).filter(
    (id) => (states[id] ?? 'pending') === 'pending' && canStageRun(id, states, stages),
  )
}
