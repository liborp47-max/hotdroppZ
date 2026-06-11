/**
 * Provider auto-recommendation — integration layer (UM-AI_CONTROL / SM1).
 *
 * Cost optimization surface for the AI Control panel: for each pipeline step it
 * recommends the best AVAILABLE provider and flags whether that differs from the
 * currently-selected one. Built ON TOP of the existing router scorer
 * (`getScoresForStep` — quality/speed/cost weights + reliability), so it is NOT a
 * duplicate scoring path — it surfaces the router's verdict for a human.
 *
 * Pure decision logic lives in recommend-core.ts (unit-tested); this module only
 * feeds it live scores.
 */
import { STEP_CONFIGS, type AiStepKey } from './registry'
import { getScoresForStep, type RoutePriority } from './router'
import { pickRecommendation, type RankedProvider, type StepRecommendation } from './recommend-core'

export type { RankedProvider, StepRecommendation } from './recommend-core'

export function recommendForStep(
  step: AiStepKey,
  priority: RoutePriority = 'normal',
): StepRecommendation | null {
  const config = STEP_CONFIGS.find((s) => s.step === step)
  if (!config) return null

  const ranked: RankedProvider[] = getScoresForStep(step, priority).map((s) => ({
    providerId: s.providerId,
    displayName: s.displayName,
    status: s.status,
    score: s.score,
    isFree: s.isFree,
    available: s.status === 'active',
  }))

  return pickRecommendation(step, config.label, config.selected, config.fallback, ranked)
}

export interface RecommendationReport {
  generatedAt: string
  priority: RoutePriority
  steps: StepRecommendation[]
  /** Number of steps where a provider switch is recommended. */
  changeCount: number
}

export function recommendAllSteps(priority: RoutePriority = 'normal'): RecommendationReport {
  const steps = STEP_CONFIGS
    .map((c) => recommendForStep(c.step, priority))
    .filter((r): r is StepRecommendation => r !== null)
  return {
    generatedAt: new Date().toISOString(),
    priority,
    steps,
    changeCount: steps.filter((s) => s.changeSuggested).length,
  }
}
