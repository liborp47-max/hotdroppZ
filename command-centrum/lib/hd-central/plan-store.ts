/**
 * Shared plan.json store (AUD-DATA-001-PLUS).
 *
 * Problem: ~21 hd-central routes each had their own read-modify-write of
 * NOTES/plan.json. The reads/writes were inconsistent — some wrote via a shared
 * `.tmp` name (collision between concurrent writers), most wrote in place with a
 * plain writeFileSync (partial reads + lost updates). Two requests that both did
 * `read → mutate → write` would clobber each other.
 *
 * This module is the single source of truth for reading and writing the plan:
 *   - `readPlan()`        — raw parse, null on missing/corrupt (the contract most routes use).
 *   - `writePlanAtomic()` — unique temp + rename, so a reader never sees a half file
 *                           and two writers never share a temp path.
 *   - `mutatePlan()`      — serialized read-modify-write. All mutations in this
 *                           process funnel through one promise chain (in-process
 *                           mutex), so the read→write window can't interleave and
 *                           lose an update. An optional optimistic version check
 *                           (CAS) guards against an external edit landing between
 *                           the caller's read and its write → PlanConflictError (409).
 *
 * Route handlers in one Next.js server instance share this module state, so the
 * mutex covers same-instance concurrency (the common case). The version CAS is
 * the cross-process / external-editor safety net.
 */
import fs from 'fs'
import path from 'path'
import type { Plan } from './types'

// Default location is NOTES/plan.json next to command-centrum. HDCC_PLAN_FILE
// overrides it (used by tests so they never touch the real plan).
export const PLAN_FILE = process.env.HDCC_PLAN_FILE
  ? path.resolve(process.env.HDCC_PLAN_FILE)
  : path.join(process.cwd(), '..', 'NOTES', 'plan.json')

export function emptyPlan(): Plan {
  return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
}

/** Raw read. Returns null when the file is missing or unparseable. */
export function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return null
  }
}

/** Atomic write: unique temp file + rename. No partial reads, no shared-temp collision. */
export function writePlanAtomic(plan: Plan): void {
  const dir = path.dirname(PLAN_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${PLAN_FILE}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  fs.renameSync(tmp, PLAN_FILE)
}

/** Thrown when the on-disk plan version no longer matches the caller's expectation. */
export class PlanConflictError extends Error {
  readonly expectedVersion: number
  readonly actualVersion: number
  constructor(expectedVersion: number, actualVersion: number) {
    super(`plan.json version conflict: expected ${expectedVersion}, found ${actualVersion}`)
    this.name = 'PlanConflictError'
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}

/** Thrown when a mutation runs but plan.json does not exist. */
export class PlanMissingError extends Error {
  constructor() {
    super('plan.json not found')
    this.name = 'PlanMissingError'
  }
}

// In-process mutex: every mutation chains onto the previous one so two concurrent
// read-modify-write cycles can never interleave. Errors are isolated so one
// failed mutation never wedges the chain for later callers.
let writeChain: Promise<unknown> = Promise.resolve()

export interface MutatePlanOptions {
  /** Optimistic concurrency: reject (PlanConflictError) if on-disk version differs. */
  expectedVersion?: number
  /** Skip the automatic version + updatedAt bump (caller manages them). */
  noBump?: boolean
  /** Bootstrap an empty plan instead of throwing PlanMissingError when absent. */
  createIfMissing?: boolean
}

/**
 * Serialized read-modify-write of plan.json.
 *
 * The mutator receives a deep copy of the current plan and may either mutate it
 * in place (returning void) or return a replacement Plan. On success the plan is
 * version-bumped (unless `noBump`), `updatedAt` refreshed, and atomically written.
 * Resolves to the persisted plan.
 *
 * Throws PlanMissingError if the file is absent, or PlanConflictError when
 * `expectedVersion` is supplied and does not match the current on-disk version.
 */
export function mutatePlan(
  mutator: (plan: Plan) => Plan | void | Promise<Plan | void>,
  opts: MutatePlanOptions = {},
): Promise<Plan> {
  const run = async (): Promise<Plan> => {
    const current = readPlan() ?? (opts.createIfMissing ? emptyPlan() : null)
    if (!current) throw new PlanMissingError()
    if (opts.expectedVersion != null && (current.version ?? 0) !== opts.expectedVersion) {
      throw new PlanConflictError(opts.expectedVersion, current.version ?? 0)
    }
    // Deep clone so a mutator throwing midway can't leave a half-mutated object
    // observable to anything (the chain only commits on a clean return).
    const draft = JSON.parse(JSON.stringify(current)) as Plan
    const result = ((await mutator(draft)) ?? draft) as Plan
    if (!opts.noBump) {
      result.version = (current.version ?? 0) + 1
      result.updatedAt = new Date().toISOString()
    }
    writePlanAtomic(result)
    return result
  }

  const next = writeChain.then(run, run)
  // Keep the chain alive regardless of this mutation's outcome.
  writeChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}
