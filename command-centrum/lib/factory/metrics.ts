/**
 * Factory performance metrics (UM-FACTORY — SM6).
 *
 * Aggregates Factory run records into throughput, latency percentiles and
 * cost-per-post. Pure module — no I/O.
 */

export interface FactoryRunRecord {
  id: string
  status: 'success' | 'partial' | 'error'
  /** Wall-clock processing time of the run. */
  totalProcessingMs: number
  /** Model + API cost of the run, USD. Optional. */
  costUsd?: number
  /** ISO completion timestamp. */
  completedAt: string
}

export interface FactoryMetrics {
  total: number
  success: number
  partial: number
  errors: number
  /** success / total, 0..1. */
  successRate: number
  /** Completed runs per hour across the window. */
  throughputPerHour: number
  latencyP50Ms: number
  latencyP95Ms: number
  /** Total spend across the window, USD. */
  totalCostUsd: number
  /** Average cost of a non-error ("post") run, USD. */
  avgCostPerPostUsd: number
}

/** Percentile (0..100) of a numeric sample using nearest-rank. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1))
  return sorted[idx]
}

/**
 * Aggregates run records into Factory metrics. `windowHours` is the time span
 * the records cover — used to derive throughput per hour.
 */
export function computeFactoryMetrics(
  records: FactoryRunRecord[],
  windowHours = 24,
): FactoryMetrics {
  const total = records.length
  const success = records.filter((r) => r.status === 'success').length
  const partial = records.filter((r) => r.status === 'partial').length
  const errors = records.filter((r) => r.status === 'error').length

  const latencies = records.map((r) => r.totalProcessingMs)
  const totalCostUsd = round2(records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0))
  const posts = records.filter((r) => r.status !== 'error')
  const postsCost = posts.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
  const hours = windowHours > 0 ? windowHours : 1

  return {
    total,
    success,
    partial,
    errors,
    successRate: total > 0 ? round2(success / total) : 0,
    throughputPerHour: round2((success + partial) / hours),
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    totalCostUsd,
    avgCostPerPostUsd: posts.length > 0 ? round4(postsCost / posts.length) : 0,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
