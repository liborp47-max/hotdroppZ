/**
 * Audit drift detection — pure core (UM-AUDITOR / SM3).
 *
 * Detects DISTRIBUTION drift: how the *share/mix* of a dimension shifted between
 * a baseline window and the current window — pipeline-stage distribution, model
 * usage, and content quality. Distinct from analytics `getAnomalies` (which
 * measures absolute stage-run health: throughput drop / error / cost / latency).
 * This measures composition drift in percentage points and alerts past a
 * threshold.
 *
 * Deterministic, dependency-free (unit-testable). The API route supplies the
 * counted distributions; the UI panel renders the alerts.
 */

export type DriftDimension = 'pipeline_distribution' | 'model_usage' | 'content_quality'
export type DriftSeverity = 'warn' | 'critical'

export interface DriftAlert {
  dimension: DriftDimension
  key: string
  baselineShare: number // 0-1
  currentShare: number // 0-1
  /** currentShare - baselineShare, in percentage points (e.g. +18.5). */
  deltaPoints: number
  severity: DriftSeverity
  detail: string
}

export interface DriftThresholds {
  warnPoints?: number // default 15
  criticalPoints?: number // default 30
  /** Skip a dimension whose current or baseline total is below this. */
  minTotal?: number // default 10
}

const DEFAULT_WARN = 15
const DEFAULT_CRIT = 30
const DEFAULT_MIN_TOTAL = 10

function toShares(counts: Record<string, number>): { shares: Record<string, number>; total: number } {
  const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0)
  const shares: Record<string, number> = {}
  if (total > 0) for (const k of Object.keys(counts)) shares[k] = (counts[k] || 0) / total
  return { shares, total }
}

/** Per-key share drift for one dimension. Returns [] when volume is too low. */
export function detectDistributionDrift(
  dimension: DriftDimension,
  current: Record<string, number>,
  baseline: Record<string, number>,
  thresholds: DriftThresholds = {},
): DriftAlert[] {
  const warn = thresholds.warnPoints ?? DEFAULT_WARN
  const crit = thresholds.criticalPoints ?? DEFAULT_CRIT
  const minTotal = thresholds.minTotal ?? DEFAULT_MIN_TOTAL

  const cur = toShares(current)
  const base = toShares(baseline)
  if (cur.total < minTotal || base.total < minTotal) return []

  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)])
  const out: DriftAlert[] = []
  for (const key of keys) {
    const cs = cur.shares[key] ?? 0
    const bs = base.shares[key] ?? 0
    const deltaPoints = Number(((cs - bs) * 100).toFixed(1))
    if (Math.abs(deltaPoints) < warn) continue
    const severity: DriftSeverity = Math.abs(deltaPoints) >= crit ? 'critical' : 'warn'
    out.push({
      dimension,
      key,
      baselineShare: Number(bs.toFixed(3)),
      currentShare: Number(cs.toFixed(3)),
      deltaPoints,
      severity,
      detail:
        `Podíl "${key}" v ${dimension} se posunul o ${deltaPoints > 0 ? '+' : ''}${deltaPoints} b. ` +
        `(${Math.round(bs * 100)} % -> ${Math.round(cs * 100)} %).`,
    })
  }
  return out.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))
}

export interface DriftWindowPair {
  current: Record<string, number>
  baseline: Record<string, number>
}

export interface DriftInput {
  pipelineDistribution?: DriftWindowPair
  modelUsage?: DriftWindowPair
  contentQuality?: DriftWindowPair
}

export interface DriftReport {
  generatedAt: string
  alerts: DriftAlert[]
  dimensions: DriftDimension[]
  counts: { critical: number; warn: number }
}

const SEV_RANK: Record<DriftSeverity, number> = { critical: 0, warn: 1 }

export function buildDriftReport(
  input: DriftInput,
  thresholds: DriftThresholds = {},
  nowIso: string = new Date().toISOString(),
): DriftReport {
  const dims: Array<[DriftDimension, DriftWindowPair | undefined]> = [
    ['pipeline_distribution', input.pipelineDistribution],
    ['model_usage', input.modelUsage],
    ['content_quality', input.contentQuality],
  ]
  const dimensions: DriftDimension[] = []
  let alerts: DriftAlert[] = []
  for (const [dim, pair] of dims) {
    if (!pair) continue
    dimensions.push(dim)
    alerts = alerts.concat(detectDistributionDrift(dim, pair.current, pair.baseline, thresholds))
  }
  alerts.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))
  return {
    generatedAt: nowIso,
    alerts,
    dimensions,
    counts: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warn: alerts.filter((a) => a.severity === 'warn').length,
    },
  }
}
