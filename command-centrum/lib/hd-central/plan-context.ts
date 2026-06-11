/**
 * Plan -> Pipeline bridge.
 *
 * The active QuarterlyPlan (status='active') is the source of truth for
 * pipeline prioritization: items aligned with the current quarter's objective,
 * milestones and resource focus receive a scoring boost in the curator stage,
 * so pipeline decisions follow the strategic plan, not just raw content signals.
 *
 * Consumers: lib/pipeline/curator.ts (live). Scout/Writer import the same
 * helper once those stages graduate from their notImplemented stubs.
 */
import fs from 'fs'
import path from 'path'
import type { QuarterlyPlan, QuarterlyPlanDoc } from './types'

const FILE = path.join(process.cwd(), '..', 'NOTES', 'quarterly-plans.json')
const CACHE_TTL_MS = 30_000

export type PlanContext = {
  /** The active quarterly plan, or null when none is marked active. */
  active: QuarterlyPlan | null
  /** Keyword tokens derived from the active plan's objective/milestones/areas. */
  focusKeywords: string[]
  /** Pipeline category ids the active plan focuses on. */
  focusCategories: string[]
}

// Short common words excluded from focus-keyword extraction (EN + CZ).
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'plan', 'goal',
  'more', 'less', 'than', 'over', 'about', 'will', 'have', 'must', 'should',
  'pro', 'jako', 'ktery', 'ktera', 'ktere', 'tento', 'tato', 'toto', 'cil',
  'kvartal', 'kvartalu', 'plan', 'aby', 'nebo', 'jeho', 'jejich', 'mit',
])

// Pipeline category ids (mirror of curator CATEGORY_WEIGHTS keys).
const KNOWN_CATEGORIES = [
  'droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap',
  'rnb', 'culture', 'fun', 'news',
]

let cache: { ctx: PlanContext; at: number } | null = null

function readPlans(): QuarterlyPlan[] {
  if (!fs.existsSync(FILE)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as QuarterlyPlanDoc
    return Array.isArray(parsed.plans) ? parsed.plans : []
  } catch {
    return []
  }
}

function tokenize(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9_]+/)) {
    const t = raw.trim()
    if (t.length < 4 || STOPWORDS.has(t)) continue
    seen.add(t)
  }
  return [...seen]
}

/**
 * Resolves the current plan context. File read is cached for CACHE_TTL_MS so a
 * full curator batch reads quarterly-plans.json once, not per item.
 */
export function getActivePlanContext(): PlanContext {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.ctx

  const active = readPlans().find((p) => p.status === 'active') ?? null

  let ctx: PlanContext
  if (!active) {
    ctx = { active: null, focusKeywords: [], focusCategories: [] }
  } else {
    const corpus = [
      active.title,
      active.objective,
      ...active.milestones.map((m) => m.title),
      ...active.resources.map((r) => r.area),
      ...active.risks.map((r) => r.description),
    ].join(' ')
    const lowerCorpus = corpus.toLowerCase()
    const focusKeywords = tokenize(corpus)
    const focusCategories = KNOWN_CATEGORIES.filter(
      (c) => focusKeywords.includes(c) || lowerCorpus.includes(c.replace('_', ' ')),
    )
    ctx = { active, focusKeywords, focusCategories }
  }

  cache = { ctx, at: now }
  return ctx
}

/** Reset the in-memory cache — call after a plan edit or in tests. */
export function invalidatePlanContextCache(): void {
  cache = null
}

/**
 * Non-negative scoring boost reflecting how well an item aligns with the active
 * QuarterlyPlan. Returns 0 when no plan is active, so the pipeline cleanly
 * falls back to pure content scoring.
 *
 * Boost = min(3, keyword hits) + 2 when the item category is a plan focus.
 */
export function planAlignmentBoost(text: string, category: string | null): number {
  const ctx = getActivePlanContext()
  if (!ctx.active) return 0

  const lower = text.toLowerCase()
  let boost = 0

  const hits = ctx.focusKeywords.reduce((n, kw) => (lower.includes(kw) ? n + 1 : n), 0)
  if (hits > 0) boost += Math.min(3, hits)
  if (category && ctx.focusCategories.includes(category)) boost += 2

  return boost
}
