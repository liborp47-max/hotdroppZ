import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * AUD-DATA-001-PLUS — shared plan.json store: atomic write + in-process mutex + CAS.
 *
 * Point the store at a throwaway temp file BEFORE importing it (HDCC_PLAN_FILE),
 * so these tests never touch the real NOTES/plan.json.
 */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planstore-'))
const tmpFile = path.join(tmpDir, 'plan.json')
process.env.HDCC_PLAN_FILE = tmpFile

// require (not import) so HDCC_PLAN_FILE is set before the module computes PLAN_FILE.
// (import statements are hoisted above the env assignment; top-level await is not
// available under the project's CJS test output.)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mutatePlan, readPlan, writePlanAtomic, PlanConflictError, PlanMissingError } = require(
  '../lib/hd-central/plan-store.ts',
) as typeof import('../lib/hd-central/plan-store.ts')

type Plan = NonNullable<ReturnType<typeof readPlan>>

function seed(plan: Partial<Plan> = {}): void {
  writePlanAtomic({
    version: 1,
    updatedAt: new Date().toISOString(),
    missions: [],
    tasks: [],
    ...plan,
  } as Plan)
}

test('mutatePlan: concurrent writes do not lose updates (in-process mutex)', async () => {
  seed({ missions: [] })
  const N = 25

  // Each mutation awaits inside the mutator — the read→write window that, without
  // the mutex, lets concurrent writers read the same state and clobber each other.
  await Promise.all(
    Array.from({ length: N }, (_, i) =>
      mutatePlan(async (plan) => {
        await new Promise((r) => setTimeout(r, Math.random() * 5))
        ;(plan.missions as unknown[]).push({ id: `m${i}` })
      }),
    ),
  )

  const final = readPlan()!
  assert.equal(final.missions.length, N, 'every concurrent push must survive')
  const ids = new Set((final.missions as Array<{ id: string }>).map((m) => m.id))
  assert.equal(ids.size, N, 'no duplicate / lost ids')
  assert.equal(final.version, 1 + N, 'version bumped once per mutation')
})

test('mutatePlan: returning a replacement plan is persisted', async () => {
  seed({ missions: [{ id: 'old' }] as unknown as Plan['missions'] })
  const out = await mutatePlan(() => ({
    version: 99,
    updatedAt: 'x',
    missions: [{ id: 'new' }],
    tasks: [],
  }) as unknown as Plan)
  assert.deepEqual((out.missions as Array<{ id: string }>).map((m) => m.id), ['new'])
  assert.equal(readPlan()!.missions.length, 1)
})

test('mutatePlan: optimistic CAS rejects a stale expectedVersion', async () => {
  seed({ version: 5 })
  await assert.rejects(
    () => mutatePlan((p) => p, { expectedVersion: 4 }),
    (err: unknown) => err instanceof PlanConflictError,
  )
  // current version matches → succeeds
  const ok = await mutatePlan((p) => p, { expectedVersion: 5 })
  assert.equal(ok.version, 6)
})

test('mutatePlan: noBump leaves version/updatedAt to the caller', async () => {
  seed({ version: 10 })
  const out = await mutatePlan((p) => {
    p.version = 42
  }, { noBump: true })
  assert.equal(out.version, 42)
})

test('mutatePlan: throws PlanMissingError when file is absent', async () => {
  fs.rmSync(tmpFile, { force: true })
  await assert.rejects(() => mutatePlan((p) => p), (err: unknown) => err instanceof PlanMissingError)
})

test('mutatePlan: createIfMissing bootstraps an empty plan instead of throwing', async () => {
  fs.rmSync(tmpFile, { force: true })
  const out = await mutatePlan((p) => {
    ;(p.missions as unknown[]).push({ id: 'bootstrapped' })
  }, { createIfMissing: true })
  assert.equal(out.missions.length, 1)
  assert.equal(readPlan()!.missions.length, 1)
})

test('writePlanAtomic: leaves no .tmp file behind and writes valid JSON', () => {
  seed({ version: 7 })
  const leftovers = fs.readdirSync(tmpDir).filter((f) => f.includes('.tmp'))
  assert.deepEqual(leftovers, [], 'temp files must be renamed away')
  const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'))
  assert.equal(parsed.version, 7)
})

test('a failed mutation does not wedge the chain for later callers', async () => {
  seed({ version: 1, missions: [] })
  await assert.rejects(() =>
    mutatePlan(() => {
      throw new Error('boom')
    }),
  )
  // chain still works after the rejection
  const ok = await mutatePlan((p) => {
    ;(p.missions as unknown[]).push({ id: 'after' })
  })
  assert.equal(ok.missions.length, 1)
})
