/**
 * Provider A/B testing — registry + sample store (UM-AI_CONTROL / SM2).
 *
 * Holds active experiments and recorded samples in process, exposes the runtime
 * switch (`providerForStepItem`) and report aggregation. Pure decision logic is
 * delegated to ab-core.ts. Persistence is dependency-injected (a Supabase-like
 * client passed in) so this module imports no `@/` value deps and stays testable.
 */
import type { AiStepKey } from './registry.ts'
import {
  evaluateExperiment,
  providerForItem,
  type AbExperiment,
  type AbReport,
  type AbSample,
} from './ab-core.ts'

const _experiments = new Map<string, AbExperiment>()
const _samples = new Map<string, AbSample[]>()
const SAMPLE_CAP = 5000 // ring-cap per experiment to bound memory

export function registerExperiment(exp: AbExperiment): AbExperiment {
  _experiments.set(exp.id, exp)
  if (!_samples.has(exp.id)) _samples.set(exp.id, [])
  return exp
}

export function removeExperiment(id: string): boolean {
  _samples.delete(id)
  return _experiments.delete(id)
}

export function listExperiments(): AbExperiment[] {
  return [..._experiments.values()]
}

/** The active experiment for a step, if any. First active wins. */
export function getActiveExperimentForStep(step: AiStepKey): AbExperiment | null {
  for (const exp of _experiments.values()) {
    if (exp.active && exp.step === step) return exp
  }
  return null
}

/**
 * Runtime switch: the provider an item should use for a step under any active
 * experiment, or null when no experiment applies (caller keeps normal routing).
 */
export function providerForStepItem(step: AiStepKey, itemId: string): string | null {
  const exp = getActiveExperimentForStep(step)
  if (!exp) return null
  return providerForItem(exp, itemId)
}

export function recordAbSample(experimentId: string, sample: AbSample): void {
  const bucket = _samples.get(experimentId)
  if (!bucket) return // unknown experiment — ignore
  bucket.push(sample)
  if (bucket.length > SAMPLE_CAP) bucket.splice(0, bucket.length - SAMPLE_CAP)
}

export function getReport(experimentId: string): AbReport | null {
  const exp = _experiments.get(experimentId)
  if (!exp) return null
  return evaluateExperiment(exp, _samples.get(experimentId) ?? [])
}

export function getAllReports(): AbReport[] {
  return [..._experiments.keys()]
    .map((id) => getReport(id))
    .filter((r): r is AbReport => r !== null)
}

// ─── Optional persistence (dependency-injected) ──────────────────────────────
// Experiments persist to ai_settings (key `abtest:<id>`); samples stay in memory
// (high-volume, derived). All non-fatal — A/B is a tuning aid, never load-bearing.

type AbDbClient = {
  from: (table: string) => {
    select: (cols: string) => { like: (col: string, pat: string) => Promise<{ data: unknown }> }
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<unknown>
  }
}

export async function loadExperiments(db: AbDbClient): Promise<number> {
  try {
    const { data } = await db.from('ai_settings').select('key, value').like('key', 'abtest:%')
    if (!Array.isArray(data)) return 0
    let n = 0
    for (const row of data as { key: string; value: string }[]) {
      try {
        const exp = JSON.parse(row.value) as AbExperiment
        if (exp && exp.id) {
          registerExperiment(exp)
          n++
        }
      } catch {
        /* skip malformed */
      }
    }
    return n
  } catch {
    return 0
  }
}

export async function persistExperiment(db: AbDbClient, exp: AbExperiment): Promise<void> {
  try {
    await db.from('ai_settings').upsert(
      { key: `abtest:${exp.id}`, value: JSON.stringify(exp), updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  } catch {
    /* non-fatal */
  }
}

/** Test/maintenance helper — clears in-process state. */
export function _resetAbState(): void {
  _experiments.clear()
  _samples.clear()
}
