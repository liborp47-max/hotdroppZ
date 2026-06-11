import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  runAgentForMission,
  auditorSignOff,
  buildEvidenceFromAgentRun,
  createDefaultExecutor,
  type AgentToolExecutor,
  type AnthropicLike,
} from '../lib/hd-central/agent-runner.ts'
import { evaluateEvidence } from '../lib/hd-central/evidence-contract.ts'

const mission = {
  id: 'UM-DEMO',
  purpose: 'demo',
  modulePath: 'lib/x.ts',
  successCriteria: ['x works'],
}

// Build a fake Anthropic message (only the fields the runner reads).
function msg(content: unknown[], stop_reason: string) {
  return { id: 'm', type: 'message', role: 'assistant', model: 'fake', content, stop_reason, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } as never
}

// Scripted client: first turn asks to run a check, second turn concludes.
function scriptedClient(checkExit: number): AnthropicLike {
  let turn = 0
  return {
    messages: {
      create: async () => {
        turn++
        if (turn === 1) {
          return msg([{ type: 'tool_use', id: 't1', name: 'run_check', input: { command: 'npm run test:evidence-contract' } }], 'tool_use')
        }
        const verdict = checkExit === 0 ? 'VERIFIED: deliverable present, checks pass.' : 'UNVERIFIED: check failed.'
        return msg([{ type: 'text', text: verdict }], 'end_turn')
      },
    },
  }
}

function fakeExecutor(checkExit: number): AgentToolExecutor {
  return {
    read_file: () => 'file contents',
    grep: () => 'lib/x.ts',
    run_check: () => ({ exitCode: checkExit, output: checkExit === 0 ? 'pass 11' : 'fail 1' }),
  }
}

test('real agent loop runs tools, captures exit codes, concludes VERIFIED -> PASS -> DONE', async () => {
  const result = await runAgentForMission(mission, {
    client: scriptedClient(0),
    executor: fakeExecutor(0),
    changedFiles: ['lib/x.ts'],
  })
  assert.equal(result.ranRealAgent, true)
  assert.equal(result.toolCalls, 1)
  assert.equal(result.testsRun.length, 1)
  assert.equal(result.testsRun[0].result, 0)
  assert.match(result.finalText, /VERIFIED/)

  const signOff = auditorSignOff(result)
  assert.equal(signOff.auditorVerdict, 'PASS')

  const evidence = buildEvidenceFromAgentRun(result, signOff, ['SYSTEM/INFO/MISSIONS/run.md'])
  const gate = evaluateEvidence({ id: mission.id, subMissions: [], successCriteria: mission.successCriteria }, evidence)
  assert.equal(gate.verdict, 'PASS', 'real passing agent run reaches MISSION_DONE')
})

test('a failing check -> auditor FAIL -> cannot reach DONE', async () => {
  const result = await runAgentForMission(mission, {
    client: scriptedClient(1),
    executor: fakeExecutor(1),
    changedFiles: ['lib/x.ts'],
  })
  assert.equal(result.testsRun[0].result, 1)
  const signOff = auditorSignOff(result)
  assert.equal(signOff.auditorVerdict, 'FAIL')

  const gate = evaluateEvidence({ id: mission.id, subMissions: [], successCriteria: [] }, buildEvidenceFromAgentRun(result, signOff))
  assert.equal(gate.verdict, 'FAIL')
})

test('AUD-SEC-002: read_file is confined to the repo + denies secrets', () => {
  const ex = createDefaultExecutor()
  // path traversal outside repo
  assert.match(ex.read_file('../../../../../../etc/passwd'), /denied/)
  assert.match(ex.read_file('/etc/passwd'), /denied/)
  // secret + ignored files inside repo
  assert.match(ex.read_file('.env.local'), /denied/)
  assert.match(ex.read_file('.git/config'), /denied/)
  // a normal in-repo source file still reads
  assert.match(ex.read_file('package.json'), /"name"/)
})

test('no client/key -> ranRealAgent false -> SIMULATED_ONLY (honest, no fake DONE)', async () => {
  const result = await runAgentForMission(mission, { client: null })
  assert.equal(result.ranRealAgent, false)
  assert.equal(auditorSignOff(result).auditorVerdict, 'SIMULATED_ONLY')
})

test('agent ran but executed no checks -> SIMULATED_ONLY (not PASS)', async () => {
  const noCheckClient: AnthropicLike = {
    messages: { create: async () => msg([{ type: 'text', text: 'VERIFIED' }], 'end_turn') },
  }
  const result = await runAgentForMission(mission, { client: noCheckClient, executor: fakeExecutor(0), changedFiles: [] })
  assert.equal(result.testsRun.length, 0)
  assert.equal(auditorSignOff(result).auditorVerdict, 'SIMULATED_ONLY')
})
