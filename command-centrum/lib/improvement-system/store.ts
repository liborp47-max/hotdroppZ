import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type {
  BrainstormingAnalysis,
  BrainstormingCategory,
  BrainstormingPoint,
  BrainstormingPointCategory,
  BrainstormingPrompt,
  BrainstormingSelection,
  ImprovementDashboardPayload,
  ImprovementPriority,
  ImprovementProposal,
  ImprovementStatus,
} from './types'

const INTEL_DIR = path.join(process.cwd(), 'INTEL', 'brainstorming')
const PROMPTS_DIR = path.join(INTEL_DIR, 'prompts')
const AGENTS_DIR = path.join(process.cwd(), '..', 'agents', 'agents')

const AGENTS = [
  {
    id: 'improovment-manager',
    name: 'IMPROOVMENT MANAGER',
    scope: 'Global section, tool, agent, workflow and system improvement agent',
    path: path.join('agents', 'agents', 'improovment-manager', 'agent.md'),
  },
  {
    id: 'brainstorming-agent',
    name: 'BRAINSTORMING AGENT',
    scope: 'Global idea decomposition and top tier prompt manager',
    path: path.join('agents', 'agents', 'brainstorming-agent', 'agent.md'),
  },
]

type CreateImprovementInput = {
  title?: string
  sourceSection?: string
  route?: string
  snapshot?: string
  createdFrom?: 'section-trigger' | 'manual'
}

type SystemSignals = {
  dashboardSections: number
  agentCount: number
  auditCount: number
  planMissions: number
  planTasks: number
  latestPlanUpdate?: string
  latestAuditFiles: string[]
}

const categoryTitles: Record<BrainstormingPointCategory, string> = {
  goals: 'Cile',
  features: 'Funkce',
  data: 'Data',
  ux: 'UI / UX',
  risks: 'Rizika',
  implementation: 'Implementace',
}

function ensureStore() {
  fs.mkdirSync(INTEL_DIR, { recursive: true })
  fs.mkdirSync(PROMPTS_DIR, { recursive: true })
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJsonFile(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
}

function listJson<T>(dir: string, prefix: string): T[] {
  ensureStore()
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
    .map((file) => readJsonFile<T>(path.join(dir, file)))
    .filter((item): item is T => Boolean(item))
}

function safeListFiles(dir: string, predicate?: (filePath: string) => boolean, limit = 200): string[] {
  const output: string[] = []

  function walk(current: string) {
    if (output.length >= limit || !fs.existsSync(current)) return

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (output.length >= limit) return
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
        walk(fullPath)
      } else if (!predicate || predicate(fullPath)) {
        output.push(fullPath)
      }
    }
  }

  try {
    walk(dir)
  } catch {
    return output
  }

  return output
}

function collectSystemSignals(): SystemSignals {
  const dashboardDir = path.join(process.cwd(), 'app', '(dashboard)')
  const infoDir = path.join(process.cwd(), '..', 'SYSTEM', 'INFO')
  const planFile = path.join(process.cwd(), '..', 'NOTES', 'plan.json')
  const plan = readJsonFile<{ updatedAt?: string; missions?: unknown[]; tasks?: unknown[] }>(planFile)
  const latestAuditFiles = safeListFiles(
    path.join(infoDir, 'AUDITS'),
    (file) => file.endsWith('.md'),
    12,
  ).map((file) => path.relative(process.cwd(), file))

  return {
    dashboardSections: safeListFiles(dashboardDir, (file) => file.endsWith('page.tsx'), 300).length,
    agentCount: fs.existsSync(AGENTS_DIR)
      ? fs.readdirSync(AGENTS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
      : 0,
    auditCount: latestAuditFiles.length,
    planMissions: Array.isArray(plan?.missions) ? plan.missions.length : 0,
    planTasks: Array.isArray(plan?.tasks) ? plan.tasks.length : 0,
    latestPlanUpdate: plan?.updatedAt,
    latestAuditFiles,
  }
}

function routeToSection(route?: string, fallback?: string) {
  if (fallback?.trim()) return fallback.trim()
  if (!route || route === '/') return 'Dashboard'

  return route
    .split('/')
    .filter(Boolean)
    .map((part) => part.replaceAll('-', ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

function normalizeText(value?: string, fallback = '') {
  return value?.replace(/\s+/g, ' ').trim() || fallback
}

function shortId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

function inferPriority(sourceSection: string, route?: string): ImprovementPriority {
  const target = `${sourceSection} ${route ?? ''}`.toLowerCase()
  if (target.includes('ceo') || target.includes('hd-central')) return 'P0'
  if (target.includes('factory') || target.includes('feed') || target.includes('scout')) return 'P1'
  if (target.includes('analytics') || target.includes('intel')) return 'P1'
  return 'P2'
}

function buildCurrentState(input: CreateImprovementInput, signals: SystemSignals): string[] {
  const section = routeToSection(input.route, input.sourceSection)
  const snapshot = normalizeText(input.snapshot)

  return [
    `${section} is reachable as a dashboard section and can now trigger a global improvement run.`,
    `System context has ${signals.dashboardSections} dashboard page routes, ${signals.agentCount} registered agent folders and ${signals.planMissions} plan missions.`,
    signals.latestPlanUpdate ? `Latest plan update detected at ${signals.latestPlanUpdate}.` : 'No persisted plan timestamp was detected.',
    snapshot ? `Captured UI snapshot: ${snapshot.slice(0, 240)}${snapshot.length > 240 ? '...' : ''}` : 'No live UI snapshot was provided, so the agent used route and system metadata.',
  ]
}

function buildDetectedProblems(input: CreateImprovementInput, signals: SystemSignals): string[] {
  const section = routeToSection(input.route, input.sourceSection)
  const problems = [
    `${section} does not yet expose explicit success metrics, owner map and next-action checkpoints in one compact control surface.`,
    'Ideas can be created faster than they can be converted into validated implementation prompts.',
    'Improvement decisions need a stable link between the source section, selected brainstorming points and final prompt artifact.',
  ]

  if (signals.auditCount > 0) {
    problems.push(`Audit context exists (${signals.auditCount} recent files sampled), but section-level actions need clearer traceability back to CEO / Brainstorming.`)
  }

  if (signals.planTasks === 0) {
    problems.push('The persisted plan has no serialized task queue, so improvements need implementation steps that are easy to promote into Plan HQ.')
  }

  return problems
}

function buildImprovementIdeas(section: string): string[] {
  return [
    `Add a compact ${section} improvement brief with current state, weak points, dependencies and measurable expected impact.`,
    'Convert every good idea into selectable brainstorming points before implementation so the CEO keeps control over scope.',
    'Generate a ready-to-run prompt from selected points and attach it directly to the source idea.',
    'Track status from open to selected, in progress, done or archived so the improvement backlog stays operational.',
    'Keep all artifacts in INTEL / brainstorming so agents, CEO and future tools share one source of truth.',
  ]
}

function buildPromptText(
  item: ImprovementProposal,
  selectedPoints: BrainstormingPoint[],
  targetMode: string,
) {
  const grouped = selectedPoints.reduce<Record<string, BrainstormingPoint[]>>((acc, point) => {
    acc[categoryTitles[point.category]] ??= []
    acc[categoryTitles[point.category]].push(point)
    return acc
  }, {})

  const pointBlocks = Object.entries(grouped)
    .map(([title, points]) => {
      const body = points
        .map((point) => `- ${point.label}: ${point.description}`)
        .join('\n')
      return `${title}:\n${body}`
    })
    .join('\n\n')

  return `Vytvor nebo uprav cast systemu podle nasledujiciho zadani.

KONTEXT:
- Zdrojova polozka: ${item.title}
- Zdrojova sekce: ${item.sourceSection}
- Rezim prace: ${targetMode}
- Priorita: ${item.priority}

AKTUALNI STAV:
${item.currentState.map((line) => `- ${line}`).join('\n')}

PROBLEMY K VYRESENI:
${item.detectedProblems.map((line) => `- ${line}`).join('\n')}

VYBRANE BODY Z BRAINSTORMINGU:
${pointBlocks || '- Nebyly vybrany zadne body. Zastav a vyzadej upresneni.'}

POZADOVANY VYSTUP:
- nejdriv analyzuj existujici architekturu
- pouzij stavajici UI styl, komponenty, datove struktury a uloziste
- implementuj funkcni reseni end-to-end
- udrz zmenu malou, citelnou a napojenou na zdrojovou sekci
- pridej nebo uprav testy podle rizika zmeny
- po implementaci over build, lint nebo relevantni testy
- v zaveru popis zmenene soubory, ulozena data, zpusob overeni a zbyvajici rizika

ACCEPTANCE CRITERIA:
${item.implementationSteps.map((line) => `- ${line}`).join('\n')}
`
}

function makePoint(
  item: ImprovementProposal,
  category: BrainstormingPointCategory,
  label: string,
  description: string,
  impact: ImprovementPriority,
  recommended = false,
): BrainstormingPoint {
  return {
    id: `${item.id}-${category}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    category,
    label,
    description,
    impact,
    recommended,
  }
}

function buildAnalysisCategories(item: ImprovementProposal): BrainstormingCategory[] {
  const points: BrainstormingPoint[] = [
    makePoint(item, 'goals', 'Mission alignment', 'Keep the change tied to CEO goals, current plan and measurable system impact.', 'P0', true),
    makePoint(item, 'goals', 'Section objective', `Define exactly what ${item.sourceSection} should do better after the upgrade.`, item.priority, true),
    makePoint(item, 'features', 'Improvement trigger', 'Preserve the arrow-up trigger and make the generated proposal visible in the brainstorming backlog.', 'P0', true),
    makePoint(item, 'features', 'Prompt linkage', 'Attach the generated prompt to the original brainstorming item with a visible P action.', 'P0', true),
    makePoint(item, 'features', 'Status workflow', 'Support open, selected, in progress, done and archived states for improvement ideas.', 'P1'),
    makePoint(item, 'data', 'Structured artifact', 'Save title, source section, current state, problems, ideas, impact, tools, agents, steps, priority and status.', 'P0', true),
    makePoint(item, 'data', 'Intel storage', 'Persist analysis selections in INTEL / brainstorming and final prompts in INTEL / brainstorming / prompts.', 'P0', true),
    makePoint(item, 'data', 'Traceability', 'Keep stable IDs between source idea, analysis, selected points and generated prompt.', 'P1'),
    makePoint(item, 'ux', 'Popup tabs', 'Use a compact tabbed popup with checkbox groups for goals, features, data, UX, risks and implementation.', 'P1', true),
    makePoint(item, 'ux', 'Copy action', 'Expose a copy button next to the final prompt so it can be reused instantly.', 'P1', true),
    makePoint(item, 'risks', 'Scope control', 'Avoid broad redesign and keep the change inside existing architecture and UI patterns.', 'P0', true),
    makePoint(item, 'risks', 'Missing data fallback', 'If live data is incomplete, mark assumptions and still produce a safe interim prompt.', 'P1'),
    makePoint(item, 'implementation', 'API routes', 'Add server endpoints for listing proposals, creating analyses, saving selections and generating prompts.', 'P1', true),
    makePoint(item, 'implementation', 'Client refresh', 'Refresh the listing after every analysis, prompt creation or status update.', 'P2'),
    makePoint(item, 'implementation', 'Verification', 'Run lint or build after implementation and document any blocker.', 'P1', true),
  ]

  return (Object.keys(categoryTitles) as BrainstormingPointCategory[]).map((category) => ({
    id: category,
    title: categoryTitles[category],
    points: points.filter((point) => point.category === category),
  }))
}

export function listImprovementProposals(): ImprovementProposal[] {
  return listJson<ImprovementProposal>(INTEL_DIR, 'improvement-')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listAnalyses(): BrainstormingAnalysis[] {
  return listJson<BrainstormingAnalysis>(INTEL_DIR, 'analysis-')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listSelections(): BrainstormingSelection[] {
  return listJson<BrainstormingSelection>(INTEL_DIR, 'selection-')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listPrompts(): BrainstormingPrompt[] {
  return listJson<BrainstormingPrompt>(PROMPTS_DIR, 'prompt-')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getImprovementDashboard(): ImprovementDashboardPayload {
  ensureStore()

  return {
    items: listImprovementProposals(),
    analyses: listAnalyses(),
    selections: listSelections(),
    prompts: listPrompts(),
    agents: AGENTS,
  }
}

export function createImprovementProposal(input: CreateImprovementInput): ImprovementProposal {
  ensureStore()

  const now = new Date().toISOString()
  const signals = collectSystemSignals()
  const sourceSection = routeToSection(input.route, input.sourceSection)
  const title = normalizeText(
    input.title,
    input.createdFrom === 'manual'
      ? `Manual improvement idea for ${sourceSection}`
      : `Improve ${sourceSection}`,
  )
  const priority = inferPriority(sourceSection, input.route)

  const proposal: ImprovementProposal = {
    id: shortId('improvement'),
    title,
    sourceSection,
    route: input.route,
    currentState: buildCurrentState(input, signals),
    detectedProblems: buildDetectedProblems(input, signals),
    improvementIdeas: buildImprovementIdeas(sourceSection),
    expectedImpact: [
      'Faster conversion from vague idea to executable prompt.',
      'Clearer CEO control over what gets selected, built and archived.',
      'Better traceability between UI section, data artifact, agent output and final implementation prompt.',
    ],
    requiredTools: [
      'Next.js dashboard UI',
      'INTEL file storage',
      'CEO / Brainstorming listing',
      'Global agent registry',
      'Existing Plan, Audit and Agent context',
    ],
    suggestedAgents: [
      'IMPROOVMENT MANAGER',
      'BRAINSTORMING AGENT',
      'CEO',
      'System Architect',
      'Prompt Engineer',
      'QA / Testing',
    ],
    implementationSteps: [
      'Create or update the source section without redesigning unrelated pages.',
      'Persist a structured improvement proposal in INTEL / brainstorming.',
      'Run Brainstorming Agent analysis and let the user select concrete points.',
      'Generate a final prompt connected to the original item.',
      'Expose prompt open and copy actions in the brainstorming listing.',
    ],
    priority,
    createdAt: now,
    updatedAt: now,
    status: 'open',
  }

  writeJsonFile(path.join(INTEL_DIR, `improvement-${proposal.id}.json`), proposal)
  return proposal
}

export function updateImprovementStatus(id: string, status: ImprovementStatus): ImprovementProposal | null {
  const existing = listImprovementProposals().find((item) => item.id === id)
  if (!existing) return null

  const next: ImprovementProposal = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  }

  writeJsonFile(path.join(INTEL_DIR, `improvement-${next.id}.json`), next)
  return next
}

export function analyzeBrainstormingItem(itemId: string): BrainstormingAnalysis | null {
  const item = listImprovementProposals().find((proposal) => proposal.id === itemId)
  if (!item) return null

  const now = new Date().toISOString()
  const existing = listAnalyses().find((analysis) => analysis.brainstormingItemId === itemId)
  const analysis: BrainstormingAnalysis = {
    id: existing?.id ?? shortId('analysis'),
    brainstormingItemId: item.id,
    sourceIdea: item.title,
    categories: buildAnalysisCategories(item),
    createdByAgent: 'BRAINSTORMING AGENT',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: existing?.status === 'prompt_created' ? 'prompt_created' : 'ready',
  }

  writeJsonFile(path.join(INTEL_DIR, `analysis-${analysis.id}.json`), analysis)
  return analysis
}

export function createBrainstormingPrompt(
  itemId: string,
  selectedPointIds: string[],
  targetMode = 'create or improve existing system feature',
): BrainstormingPrompt | null {
  const item = listImprovementProposals().find((proposal) => proposal.id === itemId)
  const analysis = listAnalyses().find((entry) => entry.brainstormingItemId === itemId) ?? analyzeBrainstormingItem(itemId)
  if (!item || !analysis) return null

  const points = analysis.categories.flatMap((category) => category.points)
  const selectedPoints = points.filter((point) => selectedPointIds.includes(point.id))
  const now = new Date().toISOString()
  const existingPrompt = listPrompts().find((prompt) => prompt.brainstormingItemId === itemId)

  const selection: BrainstormingSelection = {
    id: shortId('selection'),
    brainstormingItemId: item.id,
    analysisId: analysis.id,
    selectedPoints,
    createdByAgent: 'BRAINSTORMING AGENT',
    createdAt: now,
    updatedAt: now,
  }

  const prompt: BrainstormingPrompt = {
    id: existingPrompt?.id ?? shortId('prompt'),
    brainstormingItemId: item.id,
    sourceIdea: item.title,
    selectedPoints,
    generatedPrompt: buildPromptText(item, selectedPoints, targetMode),
    createdByAgent: 'BRAINSTORMING AGENT',
    createdAt: existingPrompt?.createdAt ?? now,
    updatedAt: now,
    status: 'ready',
  }

  writeJsonFile(path.join(INTEL_DIR, `selection-${selection.id}.json`), selection)
  writeJsonFile(path.join(PROMPTS_DIR, `prompt-${prompt.id}.json`), prompt)
  writeJsonFile(path.join(INTEL_DIR, `analysis-${analysis.id}.json`), {
    ...analysis,
    status: 'prompt_created',
    updatedAt: now,
  } satisfies BrainstormingAnalysis)

  return prompt
}
