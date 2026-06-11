/**
 * local-runner.ts — BRAIN-AGENT-RUNNER-LOCAL (interim slice of P0-TRUTH-002).
 *
 * The /solve simulator hardcodes an empty evidence pack so every run is parked
 * SIMULATED_ONLY. This module produces a REAL evidence pack instead: it runs the
 * mission's actual verification commands (typecheck + covering test:* scripts),
 * captures genuine exit codes, and reads `git diff --name-only` for changedFiles.
 *
 * It needs no cloud agent — only the commands already defined in package.json —
 * yet it lets a mission with real, passing, code-touching work legitimately reach
 * `auditorVerdict: 'PASS'`, which evaluateEvidence then gates to MISSION_DONE.
 *
 * Everything is injectable (the `runner`) so it is unit-testable without spawning
 * real processes or requiring a git checkout.
 */

import { execSync } from 'child_process'
import type { Mission } from './types'
import type { MissionEvidence } from './evidence-contract'

export interface CommandResult {
  name: string
  command: string
  exitCode: number
  output: string
}

/** Runs a shell command and reports its real exit code. Replaceable in tests. */
export type CommandRunner = (command: string) => CommandResult

/** Default runner: executes via child_process and captures the real exit code. */
export const execRunner: CommandRunner = (command) => {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe', timeout: 120_000 })
    return { name: command, command, exitCode: 0, output: String(output).slice(-2000) }
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string }
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
    return { name: command, command, exitCode: typeof err.status === 'number' ? err.status : 1, output: String(out).slice(-2000) }
  }
}

// Map mission deliverable keywords -> the npm test script that actually covers them.
// Keys are substrings matched against the mission modulePath/id (case-insensitive).
const COVERAGE_MAP: Array<{ match: RegExp; script: string }> = [
  { match: /stage-registry|stage-table/, script: 'test:stage-registry' },
  { match: /droppz/, script: 'test:droppz' },
  { match: /pipeline\/feed|feed-engine|feed\//, script: 'test:feed-engine' },
  { match: /evidence|truth-gate|truth_gate/, script: 'test:evidence-contract' },
  { match: /refresh-truth|refresh_truth/, script: 'test:refresh-truth' },
  { match: /mission-timeline|mission_timeline|lifecycle|missions/, script: 'test:missions' },
  { match: /resilience|enrichment/, script: 'test:enrichment-resilience' },
  { match: /srl|sources\/srl/, script: 'test:srl' },
  { match: /scout-hq|scout_hq/, script: 'test:scout-hq' },
  { match: /factory/, script: 'test:factory' },
  { match: /intel/, script: 'test:intel' },
]

/**
 * Resolve which verification commands prove a given mission.
 * Always includes `typecheck` (the mission's code must compile); adds any
 * `test:*` script whose coverage keyword matches the mission's surface.
 */
export function resolveMissionCommands(mission: Pick<Mission, 'id' | 'modulePath'>): string[] {
  const surface = `${mission.id ?? ''} ${mission.modulePath ?? ''}`.toLowerCase()
  const cmds = new Set<string>(['npm run --silent typecheck'])
  for (const { match, script } of COVERAGE_MAP) {
    if (match.test(surface)) cmds.add(`npm run --silent ${script}`)
  }
  return Array.from(cmds)
}

/** Parse changed files from `git diff` (working tree + staged). */
export function gitChangedFiles(runner: CommandRunner): string[] {
  const files = new Set<string>()
  for (const cmd of ['git diff --name-only', 'git diff --cached --name-only']) {
    const r = runner(cmd)
    if (r.exitCode === 0) {
      r.output
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((f) => files.add(f))
    }
  }
  return Array.from(files)
}

export interface LocalRunOptions {
  runner?: CommandRunner
  /** Deliverable paths already known to exist (e.g. the report file). */
  deliverables?: string[]
  /** Skip git diff (e.g. when no repo). Defaults to false. */
  skipGit?: boolean
}

/**
 * Run a mission's real verification commands and assemble an honest evidence pack.
 *
 *   - testsRun     : one entry per command, with its real exit code
 *   - changedFiles : from git diff (unless skipGit)
 *   - auditorVerdict: 'FAIL' if any command failed; 'PASS' if all passed AND real
 *                     surface was touched (changed files or deliverables);
 *                     otherwise 'SIMULATED_ONLY' (passed but nothing to show).
 *
 * The returned pack is meant to be fed straight into evaluateEvidence().
 */
export function runMissionLocally(
  mission: Pick<Mission, 'id' | 'modulePath'>,
  opts: LocalRunOptions = {},
): MissionEvidence {
  const runner = opts.runner ?? execRunner
  const commands = resolveMissionCommands(mission)

  const testsRun = commands.map((command) => {
    const r = runner(command)
    return { name: r.name, result: r.exitCode, output: r.output }
  })

  const changedFiles = opts.skipGit ? [] : gitChangedFiles(runner)
  const deliverables = opts.deliverables ?? []

  const anyFailed = testsRun.some((t) => typeof t.result === 'number' && t.result !== 0)
  const touchedSurface = changedFiles.length > 0 || deliverables.length > 0

  const auditorVerdict: MissionEvidence['auditorVerdict'] = anyFailed
    ? 'FAIL'
    : touchedSurface
      ? 'PASS'
      : 'SIMULATED_ONLY'

  return { testsRun, changedFiles, deliverables, auditorVerdict }
}
