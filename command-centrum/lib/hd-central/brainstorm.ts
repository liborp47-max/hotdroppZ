// Brainstorming engine — shared logic for /api/hd-central/brainstorm.
// Generates upgrade mission candidates filtered by the active Primary Mission
// and the current plan. AI-first with a deterministic rule-based fallback so
// the cockpit never breaks on model errors.
import { callAI } from '@/lib/pipeline/ai'
import { BRAINSTORM_SYSTEM } from '@/lib/pipeline/prompts'
import { missionLifecycleStatus } from '@/lib/hd-central/lifecycle'
import type { Mission, Phase, Priority } from '@/lib/hd-central/types'

export type Complexity = 'S' | 'M' | 'L' | 'XL'

export interface BrainstormSuggestion {
  id: string
  title: string
  rationale: string
  suggestedPriority: Priority
  suggestedPhase: string
  domains: string[]
  relevanceToActive: string
  estimatedComplexity: Complexity
}

export interface BrainstormResponse {
  generatedAt: string
  primaryMissionId: string | null
  suggestions: BrainstormSuggestion[]
  degraded: boolean
  model: string
}

const VALID_PRIORITY: Priority[] = ['P0', 'P1', 'P2', 'P3']
const VALID_PHASE: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']
const VALID_COMPLEXITY: Complexity[] = ['S', 'M', 'L', 'XL']

const MAX_COUNT = 8
const DEFAULT_COUNT = 5

// ─── Dedup / relevance helpers ────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with',
  'mise', 'audit', 'system', 'add', 'build', 'create', 'engine',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  )
}

/** Jaccard token overlap — 0..1. Mirrors the cluster-stage dedup convention. */
function similarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const tok of ta) if (tb.has(tok)) shared += 1
  return shared / (ta.size + tb.size - shared)
}

/** True when the suggestion is too close to an already-planned mission. */
function isDuplicate(suggestion: { title: string }, missions: Mission[]): boolean {
  return missions.some((m) => {
    const haystack = `${m.name} ${m.purpose ?? ''}`
    return similarity(suggestion.title, haystack) >= 0.5
  })
}

// ─── AI parsing ───────────────────────────────────────────────────────────────

type RawSuggestion = {
  title?: unknown
  rationale?: unknown
  suggestedPriority?: unknown
  suggestedPhase?: unknown
  domains?: unknown
  relevanceToActive?: unknown
  estimatedComplexity?: unknown
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function coercePriority(v: unknown): Priority {
  return VALID_PRIORITY.includes(v as Priority) ? (v as Priority) : 'P2'
}

function coercePhase(v: unknown, fallback: string): string {
  return VALID_PHASE.includes(v as Phase) ? (v as string) : fallback
}

function coerceComplexity(v: unknown): Complexity {
  return VALID_COMPLEXITY.includes(v as Complexity) ? (v as Complexity) : 'M'
}

function coerceDomains(v: unknown): string[] {
  if (!Array.isArray(v)) return ['OPERATIONS']
  const cleaned = v
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    .map((d) => d.trim().toUpperCase())
    .slice(0, 3)
  return cleaned.length > 0 ? cleaned : ['OPERATIONS']
}

function makeId(index: number): string {
  return `brainstorm-${Date.now().toString(36)}-${index}`
}

function parseSuggestions(raw: string, fallbackPhase: string): BrainstormSuggestion[] {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0]) as { suggestions?: RawSuggestion[] }
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return list
      .map((s, i) => {
        const title = asString(s.title, '')
        if (!title) return null
        return {
          id: makeId(i),
          title,
          rationale: asString(s.rationale, 'Doplnit zdůvodnění.'),
          suggestedPriority: coercePriority(s.suggestedPriority),
          suggestedPhase: coercePhase(s.suggestedPhase, fallbackPhase),
          domains: coerceDomains(s.domains),
          relevanceToActive: asString(s.relevanceToActive, 'Vazba na Primary Mission není specifikovaná.'),
          estimatedComplexity: coerceComplexity(s.estimatedComplexity),
        } satisfies BrainstormSuggestion
      })
      .filter((s): s is BrainstormSuggestion => s !== null)
  } catch {
    return []
  }
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────
// Deterministic seed suggestions for the cockpit parent goal. Used when the AI
// call fails or returns nothing. Filtered through the same dedup gate.

const FALLBACK_SEEDS: Omit<BrainstormSuggestion, 'id'>[] = [
  {
    title: 'Real-time progress stream pro Mission Timeline',
    rationale: 'Cockpit zatím ukazuje stav až po refreshi. Server-sent events dodají živý progress bez pollingu.',
    suggestedPriority: 'P1',
    suggestedPhase: 'Build',
    domains: ['FRONTEND', 'OPERATIONS'],
    relevanceToActive: 'Přímo plní parent goal: real-time progress všech misí.',
    estimatedComplexity: 'M',
  },
  {
    title: 'Centrální process trigger panel',
    rationale: 'Spouštění pipeline stages je rozdrobené po vícero stránkách. Jeden panel s audit logem zjednoduší provoz.',
    suggestedPriority: 'P1',
    suggestedPhase: 'Build',
    domains: ['PIPELINE', 'OPERATIONS'],
    relevanceToActive: 'Naplňuje část parent goalu: spouštění procesů z jednoho místa.',
    estimatedComplexity: 'L',
  },
  {
    title: 'Health snapshot agregace pro všechny mise',
    rationale: 'Cockpit potřebuje jeden agregovaný pohled green/amber/red napříč misemi a stages.',
    suggestedPriority: 'P2',
    suggestedPhase: 'Validate',
    domains: ['ANALYTICS', 'OPERATIONS'],
    relevanceToActive: 'Dodá centrální přehled o stavu všech misí.',
    estimatedComplexity: 'M',
  },
  {
    title: 'Audit-finding to mission auto-konverze',
    rationale: 'Audit findings se dnes do backlogu převádějí ručně. Automatický kandidát zrychlí planning loop.',
    suggestedPriority: 'P2',
    suggestedPhase: 'Build',
    domains: ['PIPELINE', 'QUALITY'],
    relevanceToActive: 'Posiluje brainstorming a backlog vrstvu cockpitu.',
    estimatedComplexity: 'M',
  },
  {
    title: 'Cost a token telemetrie pro AI volání cockpitu',
    rationale: 'Brainstorming i ostatní AI features skrytě utrácejí. Telemetrie dá viditelnost a cost ceiling.',
    suggestedPriority: 'P3',
    suggestedPhase: 'Validate',
    domains: ['ANALYTICS', 'OPERATIONS'],
    relevanceToActive: 'Chrání provoz cockpitu před runaway AI náklady.',
    estimatedComplexity: 'S',
  },
]

function ruleBasedSuggestions(count: number, existing: Mission[]): BrainstormSuggestion[] {
  return FALLBACK_SEEDS
    .filter((seed) => !isDuplicate(seed, existing))
    .slice(0, count)
    .map((seed, i) => ({ ...seed, id: makeId(i) }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

function clampCount(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_COUNT
  return Math.min(Math.max(n, 1), MAX_COUNT)
}

/**
 * Generate brainstorm suggestions. AI-first; on any failure returns rule-based
 * seeds with `degraded: true`. Never throws.
 */
export async function generateBrainstorm(
  missions: Mission[],
  countInput?: unknown,
): Promise<BrainstormResponse> {
  const count = clampCount(countInput)
  const active = missions.find((m) => missionLifecycleStatus(m) === 'ACTIVE' && !m.isDeleted) ?? null
  const fallbackPhase = active?.phase ?? 'Build'

  // Build the AI prompt from plan context. Mission text is data, not instruction.
  const planLines = missions
    .filter((m) => !m.isDeleted)
    .slice(0, 60)
    .map((m) => `- [${m.id}] ${m.name}: ${(m.purpose ?? '').slice(0, 160)}`)
    .join('\n')

  const primaryBlock = active
    ? `PRIMARY MISSION:\n[${active.id}] ${active.name}\nPurpose: ${active.purpose ?? ''}\nPhase: ${active.phase ?? '?'} | Domains: ${(active.domains ?? []).join(', ') || '?'}`
    : 'PRIMARY MISSION: none active — propose foundational missions for the cockpit parent goal.'

  const userPrompt = [
    primaryBlock,
    '',
    `CURRENT PLAN (${missions.length} missions, do not duplicate):`,
    planLines || '(empty)',
    '',
    `COUNT: ${count}`,
  ].join('\n')

  let raw = ''
  try {
    raw = await callAI('curator', BRAINSTORM_SYSTEM, userPrompt, {
      maxTokens: 2048,
      temperature: 0.5,
    })
  } catch {
    raw = ''
  }

  const aiSuggestions = raw ? parseSuggestions(raw, fallbackPhase) : []
  const degraded = aiSuggestions.length === 0

  const sourced = degraded
    ? ruleBasedSuggestions(count, missions)
    : aiSuggestions.filter((s) => !isDuplicate(s, missions)).slice(0, count)

  return {
    generatedAt: new Date().toISOString(),
    primaryMissionId: active?.id ?? null,
    suggestions: sourced,
    degraded,
    model: degraded ? 'rule-based-fallback' : 'groq/anthropic-router',
  }
}

/** Runtime guard — validates an inbound suggestion before backlog insertion. */
export function isValidSuggestion(v: unknown): v is BrainstormSuggestion {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.title === 'string' && s.title.trim().length > 0 &&
    typeof s.rationale === 'string' &&
    VALID_PRIORITY.includes(s.suggestedPriority as Priority) &&
    typeof s.suggestedPhase === 'string' &&
    Array.isArray(s.domains) &&
    typeof s.relevanceToActive === 'string' &&
    VALID_COMPLEXITY.includes(s.estimatedComplexity as Complexity)
  )
}
