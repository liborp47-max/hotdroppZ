/**
 * Pipeline stage-run helpers (UM-CC_DATA_CONSISTENCY — SM5).
 *
 * Classifies stage failure messages into stable error codes so the
 * pipeline_stage_runs table carries a queryable `error_code` for debugging
 * stage failures. Pure module — no I/O, no framework imports — unit-testable.
 */

export type StageErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'auth_error'
  | 'schema_gap'
  | 'network_error'
  | 'ai_error'
  | 'db_error'
  | 'parse_error'
  | 'unknown'

/** All stable codes, in classification precedence order (most specific first). */
const ERROR_PATTERNS: Array<[StageErrorCode, RegExp]> = [
  ['timeout', /\btimeout\b|timed out|etimedout|deadline exceeded/i],
  ['rate_limit', /rate.?limit|\b429\b|too many requests|quota exceeded/i],
  ['auth_error', /unauthorized|\b401\b|\b403\b|forbidden|invalid (api )?key/i],
  ['schema_gap', /does not exist|undefined column|unknown column|missing column|\bpgrst\d+/i],
  ['network_error', /econnrefused|enotfound|econnreset|network error|fetch failed|socket hang/i],
  ['parse_error', /json|parse error|unexpected token|malformed/i],
  ['ai_error', /\bgroq\b|anthropic|openai|\bllm\b|model (error|overloaded)|completion failed/i],
  ['db_error', /supabase|postgres|database|duplicate key|constraint|violates/i],
]

/**
 * Maps a stage error message to a stable error code. Returns 'unknown' when
 * the message is empty or matches no known pattern.
 */
export function classifyStageError(message: string | null | undefined): StageErrorCode {
  if (!message || !message.trim()) return 'unknown'
  for (const [code, pattern] of ERROR_PATTERNS) {
    if (pattern.test(message)) return code
  }
  return 'unknown'
}

export type StageRunStatus = 'running' | 'complete' | 'error'

/** Derives the terminal status + error code for a finished stage run. */
export function resolveStageOutcome(errorMessage?: string | null): {
  status: StageRunStatus
  error_code: StageErrorCode | null
} {
  if (errorMessage && errorMessage.trim()) {
    return { status: 'error', error_code: classifyStageError(errorMessage) }
  }
  return { status: 'complete', error_code: null }
}

export interface StageRunFailureSummary {
  total: number
  failed: number
  failureRate: number // 0..1, rounded to 2 decimals
  byCode: Record<string, number>
}

/**
 * Aggregates a set of stage runs into a failure summary keyed by error code —
 * drives the "debugging stage failures" view.
 */
export function summarizeStageFailures(
  runs: Array<{ status?: string | null; error_code?: string | null }>,
): StageRunFailureSummary {
  const total = runs.length
  let failed = 0
  const byCode: Record<string, number> = {}
  for (const run of runs) {
    if (run.status !== 'error') continue
    failed += 1
    const code = run.error_code || 'unknown'
    byCode[code] = (byCode[code] ?? 0) + 1
  }
  return {
    total,
    failed,
    failureRate: total > 0 ? Math.round((failed / total) * 100) / 100 : 0,
    byCode,
  }
}
