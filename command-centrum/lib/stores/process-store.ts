// Module-level singleton — persists pipeline state across client-side navigation.
// No React import: pure JS module, works inside any client component via subscribe().

export type StepStatus = 'idle' | 'running' | 'done' | 'error'

export type StepInfo = {
  status: StepStatus
  detail: string
  count: number
  startedAt: number | null
  durationMs: number | null
}

export type RunResult = {
  itemsFound: number
  filteredKept: number
  filteredDiscarded: number
  translatedItems: number
  curatedItems: number
  clusteredStories: number
  enrichedClusters: number
  writtenPosts: number
  generatedGraphics: number
  localizedPosts: number
  finalCheckPassed: number
  durationMs: number
  sourceErrors: number
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    calls: number
    estimatedCostUsd: number
  }
}

export type LogEntry = {
  id: number
  ts: number
  level: 'info' | 'success' | 'error' | 'source'
  message: string
}

export type ProcessState = {
  isRunning: boolean
  steps: Record<string, StepInfo>
  logs: LogEntry[]
  result: RunResult | null
  error: string | null
  runId: string | null
  startedAt: number | null
}

export const STEP_KEYS = [
  'scout',
  'filter',
  'curator',
  'cluster',
  'enrichment',
]

const makeSteps = (): Record<string, StepInfo> =>
  Object.fromEntries(
    STEP_KEYS.map((k) => [k, { status: 'idle', detail: '', count: 0, startedAt: null, durationMs: null }])
  )

const INIT: ProcessState = {
  isRunning: false,
  steps: makeSteps(),
  logs: [],
  result: null,
  error: null,
  runId: null,
  startedAt: null,
}

let _state: ProcessState = { ...INIT, steps: makeSteps() }
let _logId = 0
let _abort: AbortController | null = null
const _listeners = new Set<() => void>()

function notify() {
  _listeners.forEach((l) => l())
}

function patch(p: Partial<ProcessState>) {
  _state = { ..._state, ...p }
  notify()
}

function patchStep(key: string, updates: Partial<StepInfo>) {
  _state = { ..._state, steps: { ..._state.steps, [key]: { ..._state.steps[key], ...updates } } }
  notify()
}

function pushLog(level: LogEntry['level'], message: string) {
  const entry: LogEntry = { id: _logId++, ts: Date.now(), level, message }
  _state = { ..._state, logs: [..._state.logs, entry] }
  notify()
}

function markSingleStepRunAsDone(detail: string, itemsFound: number) {
  const now = Date.now()
  const nextSteps = { ..._state.steps }
  const scoutStartedAt = nextSteps.scout?.startedAt ?? now

  nextSteps.scout = {
    ...nextSteps.scout,
    status: 'done',
    detail,
    count: itemsFound,
    startedAt: scoutStartedAt,
    durationMs: Math.max(0, now - scoutStartedAt),
  }

  _state = {
    ..._state,
    steps: nextSteps,
    isRunning: false,
    result: {
      itemsFound,
      filteredKept: 0,
      filteredDiscarded: 0,
      translatedItems: 0,
      curatedItems: 0,
      clusteredStories: 0,
      enrichedClusters: 0,
      writtenPosts: 0,
      generatedGraphics: 0,
      localizedPosts: 0,
      finalCheckPassed: 0,
      durationMs: _state.startedAt ? now - _state.startedAt : 0,
      sourceErrors: 0,
    },
  }
  notify()
  pushLog('success', detail)
  void persistRun('completed')
}

function handleRunJsonResponse(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false

  const response = payload as {
    success?: boolean
    error?: string | null
    data?: {
      correlation_id?: string
      result?: {
        itemsProcessed?: number
        itemsFound?: number
      }
      stage?: string
      stage_status?: string
      reason?: string
    }
  }

  if (response.success) {
    const runId = typeof response.data?.correlation_id === 'string' ? response.data.correlation_id : null
    if (runId) patch({ runId })

    const itemsFound =
      typeof response.data?.result?.itemsProcessed === 'number'
        ? response.data.result.itemsProcessed
        : typeof response.data?.result?.itemsFound === 'number'
          ? response.data.result.itemsFound
          : 0

    markSingleStepRunAsDone(`[scout] Completed via JSON API (${itemsFound} items)`, itemsFound)
    return true
  }

  const degraded = response.data?.stage_status === 'degraded'
  const reason = response.error || response.data?.reason || 'Pipeline failed'

  patchStep('scout', { status: 'error', detail: String(reason) })
  patch({ isRunning: false, error: String(reason) })
  pushLog('error', degraded ? `[scout] degraded: ${reason}` : String(reason))
  void persistRun('error', String(reason))
  return true
}

async function persistRun(status: 'completed' | 'error' | 'stopped', errorMessage?: string): Promise<void> {
  try {
    const scoutRes = await fetch('/api/pipeline/step-data?step=scout&limit=200')
    const scoutJson = (await scoutRes.json().catch(() => ({ items: [] }))) as {
      items?: Array<{
        id: string
        title: string
        source: string
        category?: string
        url?: string
        attention_score?: number | null
        created_at?: string
      }>
    }

    const scoutItems = (scoutJson.items ?? [])
      .filter((item) => Boolean(item.title && item.source))
      .map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        category: item.category ?? 'unknown',
        url: item.url ?? '#',
        momentum: Math.max(0, Math.min(100, Math.round((item.attention_score ?? 5) * 10))),
        entities: 0,
        links: 0,
        relevance: 0,
        viralScore: Math.max(0, Math.min(100, Math.round((item.attention_score ?? 5) * 10))),
        status: 'fresh' as const,
        timestamp: item.created_at ?? new Date().toISOString(),
      }))

    const avgMomentum =
      scoutItems.length > 0
        ? Math.round(scoutItems.reduce((sum, item) => sum + item.momentum, 0) / scoutItems.length)
        : 0

    const avgViralScore =
      scoutItems.length > 0
        ? Math.round(scoutItems.reduce((sum, item) => sum + item.viralScore, 0) / scoutItems.length)
        : 0

    await fetch('/api/pipeline/runs/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: _state.runId,
        status,
        startedAt: _state.startedAt,
        completedAt: Date.now(),
        durationMs: _state.startedAt ? Date.now() - _state.startedAt : null,
        logs: _state.logs,
        errorMessage: errorMessage ?? _state.error,
        summary: {
          scoutItemsCount: scoutItems.length,
          filterItemsCount: _state.result?.filteredKept ?? 0,
          curatedItemsCount: _state.result?.curatedItems ?? 0,
          clusteredItemsCount: _state.result?.clusteredStories ?? 0,
          enrichedItemsCount: _state.result?.enrichedClusters ?? 0,
          avgMomentum,
          avgViralScore,
          uniqueSources: new Set(scoutItems.map((item) => item.source)).size,
        },
        scoutItems,
      }),
    })
  } catch {
    // Persistence is best-effort and must never break pipeline UX.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getState(): ProcessState {
  return _state
}

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export async function startRun(settings?: unknown, options: { testMode?: boolean } = {}): Promise<void> {
  if (_state.isRunning) return

  _abort = new AbortController()
  _state = { ...INIT, steps: makeSteps(), isRunning: true, startedAt: Date.now() }
  notify()
  if (options.testMode) pushLog('info', '[test-mode] TEST MODE ACTIVE - reduced source and token limits')

  try {
    const res = await fetch('/api/scout/run', {
      method: 'POST',
      signal: _abort.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-hotdroppz-test-mode': String(Boolean(options.testMode)),
      },
      body: settings ? JSON.stringify({ settings }) : undefined,
    })

    if (res.status === 401) { patch({ isRunning: false, error: 'Unauthorized' }); return }
    const contentType = res.headers.get('content-type') || ''
    const isEventStream = contentType.includes('text/event-stream')

    if (!isEventStream) {
      const jsonPayload = await res.json().catch(() => null)
      if (handleRunJsonResponse(jsonPayload)) return
      patch({ isRunning: false, error: 'Invalid JSON response from pipeline endpoint' })
      pushLog('error', 'Invalid JSON response from pipeline endpoint')
      return
    }

    if (!res.body)          { patch({ isRunning: false, error: 'No response stream' }); return }

    const reader = res.body.getReader()
    const dec    = new TextDecoder()
    let buf      = ''

     
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const chunk of parts) {
        if (!chunk.trim()) continue
        let ev = '', ds = ''
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event: ')) ev = line.slice(7).trim()
          else if (line.startsWith('data: ')) ds = line.slice(6)
        }
        if (!ev || !ds) continue
        try { _handle(ev, JSON.parse(ds) as Record<string, unknown>) } catch { /* ignore */ }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    const msg = err instanceof Error ? err.message : 'Pipeline failed'
    patch({ isRunning: false, error: msg })
    pushLog('error', msg)
  } finally {
    if (_state.isRunning) patch({ isRunning: false })
    _abort = null
  }
}

function _handle(ev: string, data: Record<string, unknown>) {
  if (ev === 'progress') {
    const step   = data.step   as string
    const status = data.status as string
    const detail = (data.detail as string) ?? ''
    if (data.runId) patch({ runId: data.runId as string })

    if (status === 'running') {
      patchStep(step, { status: 'running', detail, startedAt: Date.now() })
      if (detail) pushLog('info', `[${step}] ${detail}`)
    } else if (status === 'done') {
      const prev = _state.steps[step]
      patchStep(step, { status: 'done', detail, durationMs: prev?.startedAt ? Date.now() - prev.startedAt : null })
      if (detail) pushLog('success', `[${step}] ${detail}`)
    } else if (status === 'error') {
      patchStep(step, { status: 'error', detail })
      pushLog('error', `[${step}] ${detail}`)
    }
  } else if (ev === 'source_found') {
    pushLog('source', `+ ${data.name as string} (${data.items as number} new)`)
  } else if (ev === 'test_mode') {
    pushLog('info', `[test-mode] ${data.detail as string}`)
  } else if (ev === 'source_error') {
    pushLog('error', `✗ ${data.name as string}: ${data.message as string}`)
  } else if (ev === 'done') {
    const r: RunResult = {
      itemsFound:        (data.itemsFound        as number) ?? 0,
      filteredKept:      (data.filteredKept      as number) ?? 0,
      filteredDiscarded: (data.filteredDiscarded as number) ?? 0,
      translatedItems:   (data.translatedItems   as number) ?? 0,
      curatedItems:      (data.curatedItems      as number) ?? 0,
      clusteredStories:  (data.clusteredStories  as number) ?? 0,
      enrichedClusters:  (data.enrichedClusters  as number) ?? 0,
      writtenPosts:      (data.writtenPosts      as number) ?? 0,
      generatedGraphics: (data.generatedGraphics as number) ?? 0,
      localizedPosts:    (data.localizedPosts    as number) ?? 0,
      finalCheckPassed:  (data.finalCheckPassed  as number) ?? 0,
      durationMs:        (data.durationMs        as number) ?? 0,
      sourceErrors:      (data.sourceErrors      as number) ?? 0,
      tokenUsage:        data.tokenUsage as RunResult['tokenUsage'],
    }
    const steps = { ..._state.steps }
    for (const k of STEP_KEYS) {
      if (steps[k]?.status === 'running') steps[k] = { ...steps[k], status: 'done' }
    }
    _state = { ..._state, steps, result: r, isRunning: false }
    notify()
    pushLog('success', `Process complete in ${(r.durationMs / 1000).toFixed(1)}s`)
    void persistRun('completed')
  } else if (ev === 'error') {
    const msg = (data.message as string) ?? 'Pipeline failed'
    patch({ isRunning: false, error: msg })
    pushLog('error', msg)
    void persistRun('error', msg)
  }
}

export function stopRun(): void {
  _abort?.abort()
  patch({ isRunning: false })
  pushLog('error', 'Process stopped by user')
  void persistRun('stopped', 'Process stopped by user')
}

export function resetProcess(): void {
  _abort?.abort()
  _state = { ...INIT, steps: makeSteps() }
  notify()
}
