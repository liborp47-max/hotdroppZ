/**
 * Scout priority parametrization.
 *
 * Maps the Python Scout Operator signals onto the HotDroppZ taxonomy:
 *   virality_score (1-10) + urgency + content_potential  ->  P0 | P1 | P2 | P3
 *   TopicCategory (rap/fashion/drama/lifestyle/viral)     ->  HD content category
 *
 * Source signals: ai/models/schemas.py :: ScoutResult.
 * All thresholds and weights live in SCOUT_PRIORITY_PARAMS so the mapping can
 * be tuned without touching the logic — that is the "parametrization".
 *
 * Consumed by lib/pipeline/scout.ts once the Scout stage ingests Python
 * ScoutResults and persists scout_items (priority + category columns).
 */

export type HdPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type HdCategory =
  | 'droppz_news'
  | 'rap_core'
  | 'deep_scout'
  | 'drama'
  | 'fashion'
  | 'culture'
  | 'global_news'
  | 'science'

// Mirror of the Python enums (ai/models/schemas.py).
export type ScoutUrgency = 'low' | 'medium' | 'high'
export type ScoutContentPotential = 'low' | 'medium' | 'high' | 'explosive'
export type ScoutTopicCategory = 'rap' | 'fashion' | 'drama' | 'lifestyle' | 'viral'

export interface ScoutSignals {
  /** virality_score from the Python scout, 1-10. */
  viralityScore: number
  urgency: ScoutUrgency
  contentPotential: ScoutContentPotential
  topicCategory?: ScoutTopicCategory
}

export interface ScoutPriorityResult {
  priority: HdPriority
  category: HdCategory
  /** Composite score (roughly 1-21) the priority bucket was derived from. */
  score: number
  /** Human-readable derivation for audit / debugging. */
  rationale: string
}

/** Tunable parameters — change weights/thresholds here, not the logic below. */
export const SCOUT_PRIORITY_PARAMS = {
  /** Added to virality by content_potential tier. */
  contentPotentialWeight: { low: 0, medium: 2, high: 4, explosive: 7 } satisfies Record<
    ScoutContentPotential,
    number
  >,
  /** Added to virality by urgency tier. */
  urgencyWeight: { low: 0, medium: 2, high: 4 } satisfies Record<ScoutUrgency, number>,
  /** content_potential 'explosive' = "must publish immediately" -> always P0. */
  explosiveForcesP0: true,
  /** Inclusive lower bound of the composite score per bucket; below P2 -> P3. */
  thresholds: { P0: 14, P1: 10, P2: 6 },
} as const

/** Python TopicCategory -> HD content category. */
const CATEGORY_MAP: Record<ScoutTopicCategory, HdCategory> = {
  rap: 'rap_core',
  fashion: 'fashion',
  drama: 'drama',
  lifestyle: 'culture',
  viral: 'droppz_news',
}

/** Fallback category when the scout did not emit a topic category. */
const DEFAULT_CATEGORY: HdCategory = 'culture'

function clampVirality(v: number): number {
  if (!Number.isFinite(v)) return 5
  return Math.min(10, Math.max(1, Math.round(v)))
}

/**
 * Map a single scout result's signals to an HD priority + category tag.
 * Deterministic and pure — same input always yields the same output.
 */
export function mapScoutPriority(signals: ScoutSignals): ScoutPriorityResult {
  const virality = clampVirality(signals.viralityScore)
  const cpWeight = SCOUT_PRIORITY_PARAMS.contentPotentialWeight[signals.contentPotential] ?? 0
  const urgWeight = SCOUT_PRIORITY_PARAMS.urgencyWeight[signals.urgency] ?? 0
  const score = virality + cpWeight + urgWeight

  const explosiveOverride =
    SCOUT_PRIORITY_PARAMS.explosiveForcesP0 && signals.contentPotential === 'explosive'

  let priority: HdPriority
  if (explosiveOverride || score >= SCOUT_PRIORITY_PARAMS.thresholds.P0) {
    priority = 'P0'
  } else if (score >= SCOUT_PRIORITY_PARAMS.thresholds.P1) {
    priority = 'P1'
  } else if (score >= SCOUT_PRIORITY_PARAMS.thresholds.P2) {
    priority = 'P2'
  } else {
    priority = 'P3'
  }

  const category: HdCategory = signals.topicCategory
    ? (CATEGORY_MAP[signals.topicCategory] ?? DEFAULT_CATEGORY)
    : DEFAULT_CATEGORY

  const rationale =
    `virality=${virality} + cp:${signals.contentPotential}(${cpWeight}) + ` +
    `urgency:${signals.urgency}(${urgWeight}) = ${score} -> ${priority}` +
    (explosiveOverride ? ' (explosive override)' : '')

  return { priority, category, score, rationale }
}
