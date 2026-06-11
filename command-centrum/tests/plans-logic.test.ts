import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dependencySort,
  priorityFromUrgency,
  scoreTasks,
  validatePromotion,
  type PlanTask,
} from '@/components/planning-room/plans-logic'

function baseTask(overrides: Partial<PlanTask>): PlanTask {
  const now = '2026-05-14T00:00:00.000Z'
  return {
    id: 'T-1',
    title: 'Task',
    owner: 'Backend',
    status: 'todo',
    priority: 'P2',
    dependencies: [],
    auditIds: ['AUD-1'],
    actionIds: ['ACT-1'],
    evidencePath: 'INFO/AUDITS/AUD-1.md',
    createdAt: now,
    updatedAt: now,
    prompt: 'Do the thing',
    missionCandidate: false,
    ...overrides,
  }
}

test('priorityFromUrgency maps deterministic bands', () => {
  assert.equal(priorityFromUrgency(90), 'P0')
  assert.equal(priorityFromUrgency(75), 'P1')
  assert.equal(priorityFromUrgency(55), 'P2')
  assert.equal(priorityFromUrgency(20), 'P3')
})

test('dependencySort puts dependencies before dependents when possible', () => {
  const tasks: PlanTask[] = [
    baseTask({ id: 'A', status: 'done', dependencies: [], actionIds: ['A1'] }),
    baseTask({ id: 'B', dependencies: ['A'], actionIds: ['B1'] }),
    baseTask({ id: 'C', dependencies: ['B'], actionIds: ['C1'] }),
  ]
  const scored = scoreTasks(tasks, { A1: 'Low', B1: 'High', C1: 'Medium' })
  const sorted = dependencySort(scored)
  const ids = sorted.map((item) => item.id)
  assert.ok(ids.indexOf('A') < ids.indexOf('B'))
  assert.ok(ids.indexOf('B') < ids.indexOf('C'))
})

test('validatePromotion requires done status, audit links and prompt', () => {
  const tasks: PlanTask[] = [
    baseTask({
      id: 'PROM-1',
      status: 'done',
      missionCandidate: true,
      prompt: 'prompt ready',
      auditIds: ['AUD-OK'],
      evidencePath: 'INFO/AUDITS/AUD-OK.md',
    }),
  ]

  const scored = scoreTasks(tasks, {})
  const validation = validatePromotion(scored)
  assert.equal(validation.ready, true)

  const broken = scoreTasks(
    [
      baseTask({
        id: 'PROM-2',
        status: 'todo',
        missionCandidate: true,
        prompt: '',
        auditIds: [],
        evidencePath: undefined,
      }),
    ],
    {},
  )

  const validationBroken = validatePromotion(broken)
  assert.equal(validationBroken.ready, false)
})
