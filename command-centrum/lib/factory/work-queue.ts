/**
 * Factory work queue (UM-FACTORY — SM2).
 *
 * Priority queue for content-assembly jobs: P0 jobs jump the queue, SLA
 * deadlines are tracked per job, and backpressure caps queue depth and
 * concurrent dispatch. Pure module — no I/O.
 */

export type JobPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface FactoryJob {
  id: string
  clusterId: string
  priority: JobPriority
  /** ISO timestamp the job entered the queue. */
  enqueuedAt: string
  /** Optional ISO SLA deadline. */
  slaDeadline?: string
}

const PRIORITY_RANK: Record<JobPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

export interface QueueConfig {
  /** Backpressure: enqueue is rejected once the queue holds this many jobs. */
  maxDepth: number
  /** Backpressure: at most this many jobs may be dispatched / running at once. */
  maxConcurrent: number
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = { maxDepth: 100, maxConcurrent: 4 }

export type EnqueueResult =
  | { ok: true; queue: FactoryJob[] }
  | { ok: false; reason: 'backpressure' | 'duplicate'; queue: FactoryJob[] }

/** Adds a job to the queue unless backpressure (maxDepth) or a duplicate id blocks it. */
export function enqueueJob(
  queue: FactoryJob[],
  job: FactoryJob,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
): EnqueueResult {
  if (queue.some((j) => j.id === job.id)) {
    return { ok: false, reason: 'duplicate', queue }
  }
  if (queue.length >= config.maxDepth) {
    return { ok: false, reason: 'backpressure', queue }
  }
  return { ok: true, queue: [...queue, job] }
}

/**
 * Orders the queue: by priority (P0 first — jumps the queue), then FIFO by
 * enqueuedAt within a priority. Returns a new array; does not mutate.
 */
export function orderQueue(queue: FactoryJob[]): FactoryJob[] {
  return [...queue].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (rankDiff !== 0) return rankDiff
    const timeDiff = Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt)
    if (timeDiff !== 0) return timeDiff
    return a.id.localeCompare(b.id)
  })
}

export interface DequeueResult {
  dispatched: FactoryJob[]
  remaining: FactoryJob[]
}

/**
 * Takes the highest-priority jobs the concurrency budget allows.
 * `runningCount` is how many jobs are already in flight.
 */
export function dequeueBatch(
  queue: FactoryJob[],
  runningCount: number,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
): DequeueResult {
  const slots = Math.max(0, config.maxConcurrent - runningCount)
  const ordered = orderQueue(queue)
  return {
    dispatched: ordered.slice(0, slots),
    remaining: ordered.slice(slots),
  }
}

export type SlaStatus = 'none' | 'ok' | 'at_risk' | 'breached'

/** Hours before the SLA deadline at which a job is flagged at_risk. */
export const SLA_AT_RISK_WINDOW_HOURS = 2

/** SLA status of a single queued job. */
export function jobSlaStatus(job: FactoryJob, now: Date = new Date()): SlaStatus {
  if (!job.slaDeadline) return 'none'
  const deadline = Date.parse(job.slaDeadline)
  if (Number.isNaN(deadline)) return 'none'
  const msLeft = deadline - now.getTime()
  if (msLeft < 0) return 'breached'
  if (msLeft <= SLA_AT_RISK_WINDOW_HOURS * 3_600_000) return 'at_risk'
  return 'ok'
}

/** Jobs that have missed their SLA deadline, most overdue first. */
export function slaBreaches(queue: FactoryJob[], now: Date = new Date()): FactoryJob[] {
  return queue
    .filter((job) => jobSlaStatus(job, now) === 'breached')
    .sort((a, b) => Date.parse(a.slaDeadline as string) - Date.parse(b.slaDeadline as string))
}

export interface BackpressureStatus {
  state: 'ok' | 'warn' | 'full'
  depth: number
  /** Queue depth as a fraction of maxDepth, 0..1. */
  depthUtilization: number
  /** Free concurrency slots. */
  freeSlots: number
}

/** Backpressure snapshot — drives whether upstream stages should throttle. */
export function backpressureStatus(
  queue: FactoryJob[],
  runningCount: number,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
): BackpressureStatus {
  const depth = queue.length
  const utilization = config.maxDepth > 0 ? depth / config.maxDepth : 0
  const state: BackpressureStatus['state'] =
    depth >= config.maxDepth ? 'full' : utilization >= 0.8 ? 'warn' : 'ok'
  return {
    state,
    depth,
    depthUtilization: Math.round(utilization * 100) / 100,
    freeSlots: Math.max(0, config.maxConcurrent - runningCount),
  }
}
