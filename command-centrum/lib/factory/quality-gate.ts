/**
 * Factory quality gate (UM-FACTORY — SM5).
 *
 * Scores an assembled story and gates it: above threshold passes; below it is
 * routed either to manual review (a near miss) or back to the Writer for a
 * re-run (a clear fail). Pure module — no I/O.
 */

export interface StoryQualitySignals {
  /** Body word count. */
  wordCount: number
  /** A non-empty headline is present. */
  hasHeadline: boolean
  /** Number of distinct sources behind the story. */
  sourceCount: number
  /** Number of enrichment links bound (Spotify/YouTube/Genius/Apple). */
  enrichmentLinks: number
  /** Writer hallucination-grounding confidence, 0..1. Optional. */
  hallucinationConfidence?: number
  /** Template completeness, 0..1, from template validation. */
  completeness: number
}

/** Default pass threshold — a story must score strictly above this. */
export const QUALITY_THRESHOLD = 0.7

/** Score margin below the threshold within which a fail still goes to manual review. */
export const MANUAL_REVIEW_MARGIN = 0.2

export type QualityVerdict = 'pass' | 'manual_review' | 'rerun_writer'

export interface QualityGateResult {
  score: number
  threshold: number
  verdict: QualityVerdict
  reasons: string[]
}

/**
 * Weighted 0..1 quality score. Weights: completeness 0.30, body length 0.25,
 * grounding 0.20, sources 0.15, enrichment 0.10.
 */
export function computeQualityScore(signals: StoryQualitySignals): number {
  const lengthScore = clamp01(signals.wordCount / 500)
  const sourceScore = clamp01(signals.sourceCount / 3)
  const enrichmentScore = clamp01(signals.enrichmentLinks / 2)
  const grounding = signals.hallucinationConfidence ?? 0.8
  const headlinePenalty = signals.hasHeadline ? 1 : 0.5

  const score =
    signals.completeness * 0.3 +
    lengthScore * 0.25 +
    grounding * 0.2 +
    sourceScore * 0.15 +
    enrichmentScore * 0.1

  return round2(clamp01(score * headlinePenalty))
}

/**
 * Evaluates the quality gate.
 * - score > threshold              => pass
 * - threshold - margin <= score    => manual_review (near miss)
 * - score < threshold - margin     => rerun_writer (clear fail)
 */
export function evaluateQualityGate(
  signals: StoryQualitySignals,
  threshold: number = QUALITY_THRESHOLD,
): QualityGateResult {
  const score = computeQualityScore(signals)
  const reasons: string[] = []

  if (!signals.hasHeadline) reasons.push('missing headline')
  if (signals.wordCount < 250) reasons.push(`thin body (${signals.wordCount} words)`)
  if (signals.sourceCount < 2) reasons.push(`weak sourcing (${signals.sourceCount} source)`)
  if (signals.completeness < 0.8) reasons.push(`template ${Math.round(signals.completeness * 100)}% complete`)
  if ((signals.hallucinationConfidence ?? 1) < 0.7) reasons.push('low grounding confidence')

  let verdict: QualityVerdict
  if (score > threshold) {
    verdict = 'pass'
    if (reasons.length === 0) reasons.push('all quality signals nominal')
  } else if (score >= threshold - MANUAL_REVIEW_MARGIN) {
    verdict = 'manual_review'
  } else {
    verdict = 'rerun_writer'
  }

  return { score, threshold, verdict, reasons }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
