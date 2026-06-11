import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveMissionCommands,
  gitChangedFiles,
  runMissionLocally,
  execRunner,
  type CommandRunner,
  type CommandResult,
} from '../lib/hd-central/local-runner.ts'
import { evaluateEvidence } from '../lib/hd-central/evidence-contract.ts'

// A scripted runner: maps a command (or substring) to a canned result.
function fakeRunner(map: Record<string, Partial<CommandResult>>): CommandRunner {
  return (command: string) => {
    const key = Object.keys(map).find((k) => command.includes(k))
    const r = key ? map[key] : { exitCode: 0, output: '' }
    return { name: command, command, exitCode: r.exitCode ?? 0, output: r.output ?? '' }
  }
}

test('resolveMissionCommands always includes typecheck and adds covering test by surface', () => {
  const cmds = resolveMissionCommands({ id: 'UM-FEED_ENGINE', modulePath: 'command-centrum/lib/pipeline/feed-engine.ts' })
  assert.ok(cmds.some((c) => c.includes('typecheck')), 'typecheck always present')
  assert.ok(cmds.some((c) => c.includes('test:feed-engine')), 'feed surface -> feed-engine test')

  const plain = resolveMissionCommands({ id: 'UM-UNKNOWN', modulePath: 'docs/readme.md' })
  assert.deepEqual(plain, ['npm run --silent typecheck'], 'unknown surface -> just typecheck')
})

test('runMissionLocally: all pass + changed files -> PASS, gates to MISSION_DONE', () => {
  const runner = fakeRunner({
    typecheck: { exitCode: 0 },
    'test:': { exitCode: 0 },
    'git diff --name-only': { exitCode: 0, output: 'lib/pipeline/feed-engine.ts\n' },
    'git diff --cached': { exitCode: 0, output: '' },
  })
  const evidence = runMissionLocally(
    { id: 'UM-FEED_ENGINE', modulePath: 'lib/pipeline/feed-engine.ts' },
    { runner, deliverables: ['SYSTEM/INFO/MISSIONS/run.md'] },
  )
  assert.equal(evidence.auditorVerdict, 'PASS')
  assert.ok(evidence.changedFiles.includes('lib/pipeline/feed-engine.ts'))
  assert.ok(evidence.testsRun.length >= 2)

  const verdict = evaluateEvidence(
    { id: 'UM-FEED_ENGINE', subMissions: [], successCriteria: [] },
    evidence,
  )
  assert.equal(verdict.verdict, 'PASS', 'real passing evidence -> PASS (DONE)')
})

test('runMissionLocally: a failing command -> FAIL (never reaches DONE)', () => {
  const runner = fakeRunner({
    typecheck: { exitCode: 2, output: 'error TS2322' }, // real type error
    'git diff': { exitCode: 0, output: 'lib/x.ts\n' },
  })
  const evidence = runMissionLocally({ id: 'UM-X', modulePath: 'lib/x.ts' }, { runner })
  assert.equal(evidence.auditorVerdict, 'FAIL')

  const verdict = evaluateEvidence({ id: 'UM-X', subMissions: [], successCriteria: [] }, evidence)
  assert.equal(verdict.verdict, 'FAIL', 'broken typecheck cannot be laundered to DONE')
})

test('runMissionLocally: pass but nothing touched -> SIMULATED_ONLY (no fake DONE)', () => {
  const runner = fakeRunner({
    typecheck: { exitCode: 0 },
    'git diff': { exitCode: 0, output: '' }, // no changed files
  })
  const evidence = runMissionLocally({ id: 'UM-Y', modulePath: 'lib/y.ts' }, { runner })
  assert.equal(evidence.auditorVerdict, 'SIMULATED_ONLY')
})

test('gitChangedFiles dedupes working-tree + staged', () => {
  const runner = fakeRunner({
    'git diff --name-only': { exitCode: 0, output: 'a.ts\nb.ts\n' },
    'git diff --cached': { exitCode: 0, output: 'b.ts\nc.ts\n' },
  })
  const files = gitChangedFiles(runner)
  assert.deepEqual(files.sort(), ['a.ts', 'b.ts', 'c.ts'])
})

test('execRunner captures a real non-zero exit code from a real process', () => {
  const ok = execRunner('node -e "process.exit(0)"')
  assert.equal(ok.exitCode, 0)
  const bad = execRunner('node -e "process.exit(3)"')
  assert.equal(bad.exitCode, 3, 'real exit code captured, not faked')
})
