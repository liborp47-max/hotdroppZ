type RunStatus = 'running' | 'completed' | 'error' | 'stopped'

type ProgressLogEntry = {
  timestamp: number
  message: string
}

export type ArtistIntelFinding = {
  label: string
  value: string
  source: string
  timestamp: number
}

export type ArtistIntelRunState = {
  runId: string
  status: RunStatus
  mode: 'single' | 'bulk'
  artistName: string | null
  currentStep: string
  sourcesUsed: string[]
  completedActions: string[]
  updatedFields: string[]
  confidence: number | null
  findings: ArtistIntelFinding[]
  processed: number
  total: number
  startedAt: number
  finishedAt: number | null
  logs: ProgressLogEntry[]
}

const RUN_TTL_MS = 10 * 60 * 1000
const MAX_LOGS = 12
const MAX_FINDINGS = 16
const RUNS = new Map<string, ArtistIntelRunState>()

function cleanupRuns() {
  const now = Date.now()
  for (const [runId, run] of RUNS.entries()) {
    const reference = run.finishedAt ?? run.startedAt
    if (now - reference > RUN_TTL_MS) {
      RUNS.delete(runId)
    }
  }
}

export function startArtistIntelRun(input: {
  runId: string
  mode: 'single' | 'bulk'
  total: number
  artistName?: string | null
  currentStep?: string
  sourcesUsed?: string[]
  completedActions?: string[]
  updatedFields?: string[]
  confidence?: number | null
}): ArtistIntelRunState {
  cleanupRuns()
  const state: ArtistIntelRunState = {
    runId: input.runId,
    status: 'running',
    mode: input.mode,
    artistName: input.artistName ?? null,
    currentStep: input.currentStep ?? 'Initializing Get Intel...',
    sourcesUsed: input.sourcesUsed ?? [],
    completedActions: input.completedActions ?? [],
    updatedFields: input.updatedFields ?? [],
    confidence: input.confidence ?? null,
    findings: [],
    processed: 0,
    total: input.total,
    startedAt: Date.now(),
    finishedAt: null,
    logs: [{ timestamp: Date.now(), message: input.currentStep ?? 'Initializing Get Intel...' }],
  }
  RUNS.set(input.runId, state)
  return state
}

export function updateArtistIntelRun(
  runId: string,
  patch: Partial<Omit<ArtistIntelRunState, 'runId' | 'logs'>> & {
    log?: string
    appendCompletedAction?: string
    appendUpdatedField?: string
    appendFinding?: Omit<ArtistIntelFinding, 'timestamp'>
  }
): ArtistIntelRunState | null {
  cleanupRuns()
  const existing = RUNS.get(runId)
  if (!existing) return null

  const completedActions = patch.appendCompletedAction
    ? [...existing.completedActions, patch.appendCompletedAction]
    : existing.completedActions
  const updatedFields = patch.appendUpdatedField
    ? [...existing.updatedFields, patch.appendUpdatedField]
    : existing.updatedFields
  const findings = patch.appendFinding
    ? [...existing.findings, { ...patch.appendFinding, timestamp: Date.now() }].slice(-MAX_FINDINGS)
    : (patch.findings ?? existing.findings)

  const next: ArtistIntelRunState = {
    ...existing,
    ...patch,
    completedActions,
    updatedFields,
    findings,
    logs: patch.log
      ? [...existing.logs, { timestamp: Date.now(), message: patch.log }].slice(-MAX_LOGS)
      : existing.logs,
  }

  RUNS.set(runId, next)
  return next
}

export function finishArtistIntelRun(
  runId: string,
  status: RunStatus,
  currentStep: string,
  extra?: Partial<Omit<ArtistIntelRunState, 'runId' | 'logs'>>
): ArtistIntelRunState | null {
  return updateArtistIntelRun(runId, {
    ...extra,
    status,
    currentStep,
    finishedAt: Date.now(),
    log: currentStep,
  })
}

export function getArtistIntelRun(runId: string): ArtistIntelRunState | null {
  cleanupRuns()
  return RUNS.get(runId) ?? null
}
