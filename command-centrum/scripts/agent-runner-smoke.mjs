/**
 * agent-runner-smoke.mjs — proves P0-TRUTH-002 criterion #1 with a REAL agent run.
 *
 * Loads ANTHROPIC_API_KEY from .env.local, then invokes runAgentForMission against
 * a small real mission (verify evidence-contract.ts + run test:evidence-contract).
 * Makes one real (cheap, read-only, haiku) Anthropic call. Prints the evidence pack
 * + auditor verdict. Run: node --experimental-strip-types scripts/agent-runner-smoke.mjs
 */

import fs from 'fs'
import path from 'path'

// Minimal .env.local loader (node --test / scripts don't auto-load dotenv).
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { runAgentForMission, auditorSignOff, buildEvidenceFromAgentRun } = await import('../lib/hd-central/agent-runner.ts')
const { evaluateEvidence } = await import('../lib/hd-central/evidence-contract.ts')

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('NO ANTHROPIC_API_KEY — cannot run real smoke. Criterion #1 stays unproven.')
  process.exit(2)
}

const mission = {
  id: 'SMOKE-EVIDENCE-CONTRACT',
  purpose: 'Verify the evidence gate module exists and its tests pass.',
  modulePath: 'lib/hd-central/evidence-contract.ts',
  successCriteria: ['evidence-contract.ts exists', 'test:evidence-contract passes'],
}

console.log('Invoking REAL Claude agent (haiku, read-only + allowlisted checks)...')
const t0 = Date.now()
const run = await runAgentForMission(mission, { maxIterations: 5 })
const signOff = auditorSignOff(run)
const evidence = buildEvidenceFromAgentRun(run, signOff, ['SYSTEM/INFO/MISSIONS/smoke.md'])
const gate = evaluateEvidence({ id: mission.id, subMissions: [], successCriteria: mission.successCriteria }, evidence)

console.log(JSON.stringify({
  ranRealAgent: run.ranRealAgent,
  durationMs: Date.now() - t0,
  toolCalls: run.toolCalls,
  testsRun: run.testsRun.map((t) => ({ name: t.name, exit: t.result })),
  changedFiles: run.changedFiles.length,
  stopReason: run.stopReason,
  agentConclusion: run.finalText.slice(0, 240),
  auditorVerdict: signOff.auditorVerdict,
  gateVerdict: gate.verdict,
  error: run.error,
}, null, 2))

// Persist transcript as the evidence artefact.
const dir = path.join(process.cwd(), '..', 'INFO', 'MISSIONS', 'P0-TRUTH-002-smoke')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, `smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
  JSON.stringify({ mission, run, signOff, evidence, gate }, null, 2))
console.log('\nSmoke artefact saved to SYSTEM/INFO/MISSIONS/P0-TRUTH-002-smoke/')
