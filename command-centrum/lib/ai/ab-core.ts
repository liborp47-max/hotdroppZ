/**
 * Provider A/B testing — pure core (UM-AI_CONTROL / SM2).
 *
 * Deterministic, dependency-free logic (type-only imports) so it is unit-testable
 * under `node --experimental-strip-types`. Three responsibilities:
 *   1. assignArm        — stable per-item bucketing into control/variant
 *   2. summarizeArm     — aggregate quality/speed/cost per arm
 *   3. evaluateExperiment — pick the winning arm by objective + confidence gate
 *
 * The integration layer (ab-testing.ts) owns the registry, sample recording and
 * the runtime switch; this module never touches the router, DB or env.
 */
import type { AiStepKey } from './registry.ts'

export type AbArm = 'control' | 'variant'
export type AbObjective = 'cost' | 'latency' | 'quality' | 'balanced'

export interface AbExperiment {
  id: string
  step: AiStepKey
  /** Provider id for the control arm. */
  control: string
  /** Provider id for the variant arm. */
  variant: string
  /** Percentage of items routed to the variant arm (0-100). */
  splitPct: number
  objective: AbObjective
  active: boolean
  /** Minimum samples per arm before a winner is declared. Default 20. */
  minSamples?: number
}

export interface AbSample {
  arm: AbArm
  provider: string
  latencyMs: number
  costUsd: number
  /** Output quality 0-1 (e.g. hallucination/tone score). */
  quality: number
  success: boolean
}

export interface ArmStats {
  arm: AbArm
  provider: string
  samples: number
  successRate: number
  avgLatencyMs: number
  avgCostUsd: number
  avgQuality: number
}

export interface AbReport {
  experimentId: string
  objective: AbObjective
  control: ArmStats
  variant: ArmStats
  /** Winning arm, or null when not yet confident. */
  winner: AbArm | null
  /** True when both arms have >= minSamples. */
  confident: boolean
  reason: string
}

const DEFAULT_MIN_SAMPLES = 20
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** Stable 0-99 bucket from an item id (FNV-1a). Salted by experiment id so the
 * same item can land in different arms across experiments. */
export function bucketOf(experimentId: string, itemId: string): number {
  let h = FNV_OFFSET
  const basis = `${experimentId}:${itemId}`
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return (h >>> 0) % 100
}

/** Deterministic arm assignment. Inactive experiments always return control. */
export function assignArm(exp: AbExperiment, itemId: string): AbArm {
  if (!exp.active) return 'control'
  const split = Math.max(0, Math.min(100, exp.splitPct))
  return bucketOf(exp.id, itemId) < split ? 'variant' : 'control'
}

/** Provider id an item should use under the experiment. */
export function providerForItem(exp: AbExperiment, itemId: string): string {
  return assignArm(exp, itemId) === 'variant' ? exp.variant : exp.control
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function summarizeArm(arm: AbArm, provider: string, samples: AbSample[]): ArmStats {
  const own = samples.filter((s) => s.arm === arm)
  return {
    arm,
    provider,
    samples: own.length,
    successRate: own.length === 0 ? 0 : Number((own.filter((s) => s.success).length / own.length).toFixed(3)),
    avgLatencyMs: Math.round(avg(own.map((s) => s.latencyMs))),
    avgCostUsd: Number(avg(own.map((s) => s.costUsd)).toFixed(6)),
    avgQuality: Number(avg(own.map((s) => s.quality)).toFixed(3)),
  }
}

// Lower is better for cost/latency; higher for quality. Balanced normalises and
// rewards quality + success, penalises cost + latency.
function scoreArm(objective: AbObjective, a: ArmStats): number {
  switch (objective) {
    case 'cost':
      return -a.avgCostUsd
    case 'latency':
      return -a.avgLatencyMs
    case 'quality':
      return a.avgQuality
    case 'balanced':
    default:
      return a.avgQuality * 0.5 + a.successRate * 0.3 - a.avgCostUsd * 0.1 - (a.avgLatencyMs / 10000) * 0.1
  }
}

export function evaluateExperiment(exp: AbExperiment, samples: AbSample[]): AbReport {
  const control = summarizeArm('control', exp.control, samples)
  const variant = summarizeArm('variant', exp.variant, samples)
  const minSamples = exp.minSamples ?? DEFAULT_MIN_SAMPLES
  const confident = control.samples >= minSamples && variant.samples >= minSamples

  if (!confident) {
    return {
      experimentId: exp.id,
      objective: exp.objective,
      control,
      variant,
      winner: null,
      confident: false,
      reason:
        `Nedostatek vzorku pro verdikt — control ${control.samples}, variant ${variant.samples} ` +
        `(potreba >= ${minSamples} na arm).`,
    }
  }

  const cScore = scoreArm(exp.objective, control)
  const vScore = scoreArm(exp.objective, variant)
  // Tie-break by success rate then quality.
  let winner: AbArm
  if (vScore !== cScore) winner = vScore > cScore ? 'variant' : 'control'
  else if (variant.successRate !== control.successRate)
    winner = variant.successRate > control.successRate ? 'variant' : 'control'
  else winner = variant.avgQuality >= control.avgQuality ? 'variant' : 'control'

  const win = winner === 'variant' ? variant : control
  const lose = winner === 'variant' ? control : variant
  return {
    experimentId: exp.id,
    objective: exp.objective,
    control,
    variant,
    winner,
    confident: true,
    reason:
      `Vitez "${winner}" (${win.provider}) dle cile "${exp.objective}": ` +
      `quality ${win.avgQuality} vs ${lose.avgQuality}, ` +
      `latency ${win.avgLatencyMs}ms vs ${lose.avgLatencyMs}ms, ` +
      `cost ${win.avgCostUsd} vs ${lose.avgCostUsd}, success ${win.successRate} vs ${lose.successRate}.`,
  }
}
