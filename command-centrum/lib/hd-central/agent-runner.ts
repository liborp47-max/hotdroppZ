/**
 * agent-runner.ts — P0-TRUTH-002-REAL-AGENT-BACKEND.
 *
 * Real Claude agent (Anthropic SDK, tool use) that VERIFIES a mission's
 * deliverables and runs its real covering tests, producing a genuine evidence
 * pack (testsRun exit codes + changedFiles) for evaluateEvidence + auditor sign-off.
 *
 * SCOPE / SAFETY DECISION (documented honestly):
 *   This runner is invoked from a server route. Granting an autonomous agent
 *   arbitrary Write/Edit/rm/Bash from a web button is a security hole, so the
 *   tool surface here is READ-ONLY inspection + an ALLOWLISTED command runner
 *   (typecheck + test:* only). DONE is therefore earned the same way the rest of
 *   this session earns it: real artefacts on disk + passing tests — verified by a
 *   real model run — not by an agent autonomously rewriting the repo from a route.
 *
 * Everything is injectable (client + executor) so the agentic loop is
 * deterministically unit-testable with no network, no API spend, no fs mutation.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'
import { execRunner, gitChangedFiles, type CommandRunner } from './local-runner.ts'
import type { Mission } from './types.ts'
import type { MissionEvidence } from './evidence-contract.ts'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const ALLOWED_COMMAND = /^npm run (--silent )?(typecheck|test:[a-z0-9-]+)$/

// ─── Tool surface exposed to the agent ──────────────────────────────────────

export const AGENT_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file by repo-relative path. Returns up to 8KB.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'repo-relative file path' } },
      required: ['path'],
    },
  },
  {
    name: 'grep',
    description: 'Search files for a regex. Returns matching paths.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'optional dir to scope the search' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'run_check',
    description: 'Run an allowlisted verification command (npm run typecheck | npm run test:<name>) and return its real exit code + tail of output.',
    input_schema: {
      type: 'object' as const,
      properties: { command: { type: 'string', description: 'e.g. "npm run test:evidence-contract"' } },
      required: ['command'],
    },
  },
]

export interface AgentToolExecutor {
  read_file(path: string): string
  grep(pattern: string, path?: string): string
  run_check(command: string): { exitCode: number; output: string }
}

/** Minimal shape of the Anthropic client so tests can inject a fake. */
export interface AnthropicLike {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
  }
}

export interface AgentRunResult {
  ranRealAgent: boolean
  toolCalls: number
  testsRun: Array<{ name: string; result: number; output?: string }>
  changedFiles: string[]
  finalText: string
  stopReason: string | null
  error?: string
}

export interface RunAgentOptions {
  client?: AnthropicLike | null
  executor?: AgentToolExecutor
  commandRunner?: CommandRunner
  model?: string
  maxIterations?: number
  /** Inject for tests; defaults to git working tree. */
  changedFiles?: string[]
}

// ─── Default real executor (read-only + allowlisted commands) ───────────────

// AUD-SEC-002: confine agent file access to the repo and deny secrets. The agent
// only ever needs source files to verify a mission; resolving outside the repo
// root (path traversal) or reading dotenv/.git/node_modules is rejected.
function confinePath(p: string): string | null {
  const root = process.cwd()
  const abs = path.resolve(root, p)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null // escapes repo
  const rel = path.relative(root, abs).replace(/\\/g, '/')
  if (/(^|\/)\.env(\.|$)/i.test(rel) || /(^|\/)\.git(\/|$)/.test(rel) || /(^|\/)node_modules(\/|$)/.test(rel)) return null
  return abs
}

export function createDefaultExecutor(commandRunner: CommandRunner = execRunner): AgentToolExecutor {
  return {
    read_file(p) {
      const abs = confinePath(p)
      if (!abs) return 'ERROR: path denied (outside repo or secret/ignored file)'
      try { return fs.readFileSync(abs, 'utf-8').slice(0, 8192) } catch (e) { return `ERROR: ${(e as Error).message}` }
    },
    grep(pattern, p) {
      // execFileSync (no shell) — args are passed as an array so $(...)/backticks
      // in `pattern` are NOT interpreted. `--` stops a `-`-prefixed pattern being
      // read as a flag. Search dir is confined to the repo.
      const dir = p ? confinePath(p) : process.cwd()
      if (!dir) return 'ERROR: path denied'
      try {
        const out = execFileSync('npx', ['--no-install', 'rg', '-l', '--', pattern, dir], { encoding: 'utf-8', stdio: 'pipe' })
        return String(out).slice(0, 4096)
      } catch { return '(no matches)' }
    },
    run_check(command) {
      if (!ALLOWED_COMMAND.test(command.trim())) {
        return { exitCode: -1, output: `BLOCKED: only "npm run typecheck" and "npm run test:*" are allowed, got: ${command}` }
      }
      const r = commandRunner(command)
      return { exitCode: r.exitCode, output: r.output }
    },
  }
}

// ─── Anthropic tool-use agentic loop ────────────────────────────────────────

function defaultClient(): AnthropicLike | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as AnthropicLike
}

function missionBrief(mission: Pick<Mission, 'id' | 'purpose' | 'modulePath' | 'successCriteria'>): string {
  return [
    `Mission ${mission.id}.`,
    `Purpose: ${mission.purpose ?? '—'}`,
    `Declared deliverables (modulePath): ${mission.modulePath ?? '—'}`,
    `Success criteria:\n${(mission.successCriteria ?? []).map((c, i) => `  ${i + 1}. ${c}`).join('\n') || '  (none)'}`,
    '',
    'Your job: VERIFY the deliverables exist on disk (read_file/grep) and run the relevant',
    'verification commands (run_check: npm run typecheck and any npm run test:* that covers',
    'this mission). Then reply with a short verdict: VERIFIED if deliverables exist and all',
    'checks pass, otherwise UNVERIFIED with the reason. Do not attempt to modify files.',
  ].join('\n')
}

/**
 * Run a real Claude agent that verifies the mission and runs its tests.
 * Falls back gracefully (ranRealAgent=false) when no client/key is available.
 */
export async function runAgentForMission(
  mission: Pick<Mission, 'id' | 'purpose' | 'modulePath' | 'successCriteria'>,
  opts: RunAgentOptions = {},
): Promise<AgentRunResult> {
  const client = opts.client === undefined ? defaultClient() : opts.client
  const model = opts.model ?? DEFAULT_MODEL
  const maxIterations = opts.maxIterations ?? 6

  const testsRun: AgentRunResult['testsRun'] = []
  let toolCalls = 0
  let finalText = ''
  let stopReason: string | null = null

  if (!client) {
    return { ranRealAgent: false, toolCalls: 0, testsRun, changedFiles: [], finalText: '', stopReason: null, error: 'No Anthropic client (ANTHROPIC_API_KEY unset)' }
  }

  const executor = opts.executor ?? createDefaultExecutor(opts.commandRunner)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: missionBrief(mission) }]

  try {
    for (let i = 0; i < maxIterations; i++) {
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        system: 'You are a precise verification agent. Use tools to check facts. Never fabricate a PASS.',
        tools: AGENT_TOOLS,
        messages,
      })
      stopReason = res.stop_reason
      messages.push({ role: 'assistant', content: res.content })

      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n')
      if (text) finalText = text

      if (res.stop_reason !== 'tool_use' || toolUses.length === 0) break

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        toolCalls++
        const input = tu.input as Record<string, string>
        let content = ''
        if (tu.name === 'read_file') content = executor.read_file(input.path)
        else if (tu.name === 'grep') content = executor.grep(input.pattern, input.path)
        else if (tu.name === 'run_check') {
          const r = executor.run_check(input.command)
          testsRun.push({ name: input.command, result: r.exitCode, output: r.output.slice(-500) })
          content = `exitCode=${r.exitCode}\n${r.output.slice(-1500)}`
        } else content = `Unknown tool: ${tu.name}`
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    const changedFiles = opts.changedFiles ?? gitChangedFiles(opts.commandRunner ?? execRunner)
    return { ranRealAgent: true, toolCalls, testsRun, changedFiles, finalText, stopReason }
  } catch (e) {
    return { ranRealAgent: false, toolCalls, testsRun, changedFiles: [], finalText, stopReason, error: (e as Error).message }
  }
}

// ─── Auditor sign-off + evidence assembly ───────────────────────────────────

export interface AuditorSignOff {
  auditorVerdict: MissionEvidence['auditorVerdict']
  reasons: string[]
}

/**
 * @system-auditor cross-check: a run earns PASS only when the agent actually
 * ran, all executed checks passed (exit 0), and the model concluded VERIFIED.
 * Any failing check -> FAIL. No checks / no agent / UNVERIFIED -> SIMULATED_ONLY.
 */
export function auditorSignOff(result: AgentRunResult): AuditorSignOff {
  const reasons: string[] = []
  if (!result.ranRealAgent) return { auditorVerdict: 'SIMULATED_ONLY', reasons: [result.error ?? 'agent did not run'] }

  const failed = result.testsRun.filter((t) => t.result !== 0)
  if (failed.length > 0) {
    return { auditorVerdict: 'FAIL', reasons: [`checks failed: ${failed.map((t) => t.name).join(', ')}`] }
  }
  if (result.testsRun.length === 0) reasons.push('no verification checks were run')
  const saysVerified = /\bVERIFIED\b/i.test(result.finalText) && !/\bUNVERIFIED\b/i.test(result.finalText)
  if (!saysVerified) reasons.push('agent did not conclude VERIFIED')

  if (reasons.length === 0) return { auditorVerdict: 'PASS', reasons: [] }
  return { auditorVerdict: 'SIMULATED_ONLY', reasons }
}

/** Turn an agent run + auditor verdict into the MissionEvidence pack for the gate. */
export function buildEvidenceFromAgentRun(
  result: AgentRunResult,
  signOff: AuditorSignOff,
  deliverables: string[] = [],
): MissionEvidence {
  return {
    testsRun: result.testsRun.map((t) => ({ name: t.name, result: t.result, output: t.output })),
    changedFiles: result.changedFiles,
    deliverables,
    auditorVerdict: signOff.auditorVerdict,
  }
}
