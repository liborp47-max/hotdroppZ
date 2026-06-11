import fs from 'fs'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { nextCronFire } from '@/lib/hd-central/cron-next'
import { hydrateStageKpi, hydrateWorkerKpi, zeroKpi } from '@/lib/hd-central/kpi-hydrator'
import {
  STAGE_TABLE,
  ALL_STAGE_IDS,
  getStageMeta,
  type StageMeta,
} from '@/lib/hd-central/stage-table'
import type {
  HealthLevel,
  PipelineStageState,
  ScoutWorkerState,
  StageId,
  StageRuntimeStatus,
} from '@/lib/hd-central/types'

export { STAGE_TABLE, ALL_STAGE_IDS, getStageMeta }
export type { StageMeta }

export const STATE_ROOT = path.join(process.cwd(), '..', '..', 'INFO', 'PIPELINE_STATE')

const DEFAULT_TOKEN_BUDGET = 2048
const DEFAULT_COST_CEILING = 0.1
const DEFAULT_MAX_RETRY = 3
const DEFAULT_TIMEOUT_MS = 30_000

const ALLOWED_STATUSES: ReadonlySet<StageRuntimeStatus> = new Set([
  'idle',
  'running',
  'error',
  'degraded',
  'retired',
])
const ALLOWED_HEALTH: ReadonlySet<HealthLevel> = new Set(['green', 'amber', 'red'])

export function safeReadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (e) {
    logger.warn('[pipeline-state] failed to parse state file', {
      filePath,
      error: (e as Error).message,
    })
    return null
  }
}

function coerceStatus(value: unknown, fallback: StageRuntimeStatus): StageRuntimeStatus {
  if (typeof value === 'string' && ALLOWED_STATUSES.has(value as StageRuntimeStatus)) {
    return value as StageRuntimeStatus
  }
  return fallback
}

function coerceHealth(value: unknown, fallback: HealthLevel = 'green'): HealthLevel {
  if (typeof value === 'string' && ALLOWED_HEALTH.has(value as HealthLevel)) {
    return value as HealthLevel
  }
  return fallback
}

function deriveStageHealth(errorsToday: number, itemsToday: number): HealthLevel {
  if (itemsToday <= 0 && errorsToday <= 0) return 'green'
  if (itemsToday <= 0) return 'amber'
  const ratio = errorsToday / itemsToday
  if (ratio > 0.2) return 'red'
  if (ratio > 0.05) return 'amber'
  return 'green'
}

function maskSecretRef(ref: unknown): string | null {
  if (typeof ref !== 'string' || ref.length === 0) return null
  if (!ref.startsWith('env:')) return ref
  const name = ref.slice(4)
  const underscoreIdx = name.indexOf('_')
  const prefix = underscoreIdx > 0 ? name.slice(0, underscoreIdx) : name
  return `env:${prefix}***`
}

interface StageStateFile {
  generatedAt?: string
  data?: {
    stage?: string
    runtime?: PipelineStageState['runtime']
    canonicalFile?: string
    status?: string
    health?: string
    kpi?: Partial<PipelineStageState['kpi']>
    config?: Partial<{
      scheduleCron: string | null
      rateLimitPerSecond: number | null
      tokenBudget: number | null
      costCeiling: number | null
      secretRef: string | null
      gatewayId: string | null
      maxRetry: number | null
      timeoutMs: number | null
    }>
    lastRunAt?: string | null
    nextRunAt?: string | null
    infoRefs?: string[]
  }
}

interface WorkerStateFile {
  generatedAt?: string
  data?: {
    id?: string
    name?: string
    platform?: string
    category?: string
    description?: string
    enabled?: boolean
    status?: string
    health?: string
    config?: {
      scheduleCron?: string | null
      rateLimitPerSecond?: number | null
      secretRef?: string | null
      gatewayId?: string | null
      config?: Record<string, unknown>
    }
    kpi?: Partial<ScoutWorkerState['kpi']>
    sourceCount?: number
    lastRunAt?: string | null
    nextRunAt?: string | null
  }
}

interface IndexStateFile {
  generatedAt?: string
  data?: Record<string, unknown>
}

export function readStageStateFile(stageId: StageId): StageStateFile | null {
  const file = path.join(STATE_ROOT, 'PIPELINE_STAGES', stageId, 'state.json')
  return safeReadJson<StageStateFile>(file)
}

export function readWorkerStateFile(workerId: string): WorkerStateFile | null {
  const file = path.join(STATE_ROOT, 'SCOUT_WORKERS', workerId, 'state.json')
  return safeReadJson<WorkerStateFile>(file)
}

export async function buildStage(
  meta: StageMeta,
  db: SupabaseClient | null
): Promise<PipelineStageState> {
  const raw = readStageStateFile(meta.id)
  const data = raw?.data ?? {}

  // KPI: DB live > state.json snapshot > zero. Errors fall back to file value if DB returns 0.
  let kpi = await hydrateStageKpi(db, meta.id)
  if (kpi.itemsToday === 0 && kpi.itemsWeek === 0 && data.kpi) {
    // No DB data — fall back to snapshot (covers no-supabase dev mode).
    kpi = {
      itemsToday: Number(data.kpi.itemsToday ?? 0),
      itemsWeek: Number(data.kpi.itemsWeek ?? 0),
      errorsToday: Number(data.kpi.errorsToday ?? 0),
      latencyP95Ms: Number(data.kpi.latencyP95Ms ?? 0),
      spark7d:
        Array.isArray(data.kpi.spark7d) && data.kpi.spark7d.length === 7
          ? (data.kpi.spark7d as number[])
          : [0, 0, 0, 0, 0, 0, 0],
    }
  }

  const status = coerceStatus(data.status, meta.statusHint)
  const health: HealthLevel = data.health
    ? coerceHealth(data.health)
    : status === 'retired' || status === 'degraded'
      ? 'amber'
      : deriveStageHealth(kpi.errorsToday, kpi.itemsToday)

  const scheduleCron = data.config?.scheduleCron ?? null
  const nextRunAt = data.nextRunAt ?? nextCronFire(scheduleCron)

  return {
    id: meta.id,
    index: meta.index,
    displayName: meta.displayName,
    description: meta.description,
    runtime: (data.runtime as PipelineStageState['runtime']) ?? 'ts',
    canonicalFile: data.canonicalFile ?? `command-centrum/lib/pipeline/${meta.id}.ts`,
    status,
    health,
    phase: meta.phase,
    inputStatus: meta.inputStatus,
    outputStatus: meta.outputStatus,
    config: {
      scheduleCron,
      rateLimitPerSecond:
        typeof data.config?.rateLimitPerSecond === 'number'
          ? data.config.rateLimitPerSecond
          : null,
      tokenBudget:
        typeof data.config?.tokenBudget === 'number' ? data.config.tokenBudget : DEFAULT_TOKEN_BUDGET,
      costCeiling:
        typeof data.config?.costCeiling === 'number' ? data.config.costCeiling : DEFAULT_COST_CEILING,
      secretRef: maskSecretRef(data.config?.secretRef),
      gatewayId: data.config?.gatewayId ?? null,
      maxRetry: typeof data.config?.maxRetry === 'number' ? data.config.maxRetry : DEFAULT_MAX_RETRY,
      timeoutMs: typeof data.config?.timeoutMs === 'number' ? data.config.timeoutMs : DEFAULT_TIMEOUT_MS,
    },
    kpi,
    lastRunAt: data.lastRunAt ?? null,
    nextRunAt,
    manualTriggerEndpoint: meta.manualTriggerEndpoint,
    infoRefs: Array.isArray(data.infoRefs) ? data.infoRefs : [],
  }
}

export async function buildWorker(
  workerDir: string,
  db: SupabaseClient | null
): Promise<ScoutWorkerState | null> {
  const raw = readWorkerStateFile(workerDir)
  const data = raw?.data
  const id = data?.id
  const platform = data?.platform
  if (!data || !id || !platform) return null

  let kpi = await hydrateWorkerKpi(db, platform)
  if (kpi.itemsToday === 0 && kpi.itemsWeek === 0 && data.kpi) {
    kpi = {
      itemsToday: Number(data.kpi.itemsToday ?? 0),
      itemsWeek: Number(data.kpi.itemsWeek ?? 0),
      errorsToday: Number(data.kpi.errorsToday ?? 0),
      latencyP95Ms: Number(data.kpi.latencyP95Ms ?? 0),
      spark7d:
        Array.isArray(data.kpi.spark7d) && data.kpi.spark7d.length === 7
          ? (data.kpi.spark7d as number[])
          : [0, 0, 0, 0, 0, 0, 0],
    }
  }
  if (kpi.spark7d.length !== 7) kpi.spark7d = zeroKpi().spark7d

  const scheduleCron = data.config?.scheduleCron ?? null
  const nextRunAt = data.nextRunAt ?? nextCronFire(scheduleCron)

  return {
    id,
    parentStage: 'scout',
    name: data.name ?? id,
    platform,
    category: data.category ?? 'unknown',
    description: data.description ?? '',
    enabled: !!data.enabled,
    status: coerceStatus(data.status, 'idle'),
    health: coerceHealth(data.health),
    config: {
      scheduleCron,
      rateLimitPerSecond:
        typeof data.config?.rateLimitPerSecond === 'number' ? data.config.rateLimitPerSecond : null,
      secretRef: maskSecretRef(data.config?.secretRef),
      gatewayId: data.config?.gatewayId ?? null,
      customConfig: (data.config?.config as Record<string, unknown>) ?? {},
    },
    kpi,
    sourceCount: Number(data.sourceCount ?? 0),
    lastRunAt: data.lastRunAt ?? null,
    nextRunAt,
    manualTriggerEndpoint: `/api/scout-hq/workers/${platform}/run`,
  }
}

export function listWorkerDirs(): string[] {
  const root = path.join(STATE_ROOT, 'SCOUT_WORKERS')
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

export function readLastSyncAt(): string | null {
  const indexFile = path.join(STATE_ROOT, 'state.json')
  const raw = safeReadJson<IndexStateFile>(indexFile)
  return raw?.generatedAt ?? null
}
