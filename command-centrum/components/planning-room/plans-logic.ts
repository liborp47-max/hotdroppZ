import type { AuditActionItem, AuditSeverity } from '@/lib/types/audit'

export type PlanTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type PlanTaskPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type PlanTask = {
  id: string
  title: string
  owner: string
  status: PlanTaskStatus
  priority: PlanTaskPriority
  dependencies: string[]
  auditIds: string[]
  actionIds: string[]
  evidencePath?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  prompt?: string
  missionCandidate?: boolean
}

export type DependencyMeta = {
  depth: number
  unresolvedDeps: string[]
  blockedDependents: number
  hasCycle: boolean
}

export type UrgencyBand = 'critical' | 'high' | 'medium' | 'low'

export type ScoredTask = PlanTask & {
  urgencyScore: number
  urgencyBand: UrgencyBand
  dependencyDepth: number
  blockerChain: string[]
}

export type PromotionValidation = {
  ready: boolean
  checks: Array<{ key: string; ok: boolean; reason: string }>
}

const DEPTH_CAP = 6
const BLOCKED_CAP = 8

export function severityToScore(severity: AuditSeverity | 'Unknown'): number {
  switch (severity) {
    case 'Critical':
      return 100
    case 'High':
      return 75
    case 'Medium':
      return 45
    case 'Low':
      return 20
    default:
      return 10
  }
}

function statusBlockerImpact(status: PlanTaskStatus): number {
  if (status === 'blocked') return 95
  if (status === 'todo') return 55
  if (status === 'in_progress') return 40
  return 10
}

function urgencyBand(score: number): UrgencyBand {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

export function priorityFromUrgency(score: number): PlanTaskPriority {
  if (score >= 85) return 'P0'
  if (score >= 70) return 'P1'
  if (score >= 50) return 'P2'
  return 'P3'
}

function parseDateSafe(value: string): number {
  const n = new Date(value).getTime()
  return Number.isNaN(n) ? 0 : n
}

export function computeDependencyMeta(tasks: PlanTask[]): Record<string, DependencyMeta> {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const dependents = new Map<string, string[]>()

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      const current = dependents.get(dep) ?? []
      current.push(task.id)
      dependents.set(dep, current)
    }
  }

  const depthMemo = new Map<string, number>()
  const cycleNodes = new Set<string>()

  const dfsDepth = (id: string, stack: string[]): number => {
    if (depthMemo.has(id)) return depthMemo.get(id) ?? 0
    if (stack.includes(id)) {
      for (const node of stack) cycleNodes.add(node)
      cycleNodes.add(id)
      return DEPTH_CAP
    }

    const task = byId.get(id)
    if (!task) return 0

    const nextStack = [...stack, id]
    let maxDepth = 0
    for (const dep of task.dependencies) {
      const childDepth = dfsDepth(dep, nextStack)
      if (childDepth > maxDepth) maxDepth = childDepth
    }

    const depth = task.dependencies.length === 0 ? 0 : maxDepth + 1
    depthMemo.set(id, depth)
    return depth
  }

  const result: Record<string, DependencyMeta> = {}

  for (const task of tasks) {
    const unresolvedDeps = task.dependencies.filter((dep) => {
      const depTask = byId.get(dep)
      if (!depTask) return true
      return depTask.status !== 'done'
    })

    const blockedDependents = (dependents.get(task.id) ?? []).filter((dependentId) => {
      const dependent = byId.get(dependentId)
      if (!dependent) return false
      return dependent.status !== 'done'
    }).length

    result[task.id] = {
      depth: Math.min(DEPTH_CAP, dfsDepth(task.id, [])),
      unresolvedDeps,
      blockedDependents,
      hasCycle: cycleNodes.has(task.id),
    }
  }

  return result
}

export function computeUrgencyScore(params: {
  severity: AuditSeverity | 'Unknown'
  blockerImpact: number
  dependencyDepth: number
  unresolvedDeps: number
  blockedDependents: number
  hasCycle: boolean
  hasCriticalChain: boolean
}): number {
  const severityScore = severityToScore(params.severity)
  const depthScore = Math.min(100, Math.round((params.dependencyDepth / DEPTH_CAP) * 100))
  const unresolvedScore = Math.min(100, Math.round((params.unresolvedDeps / BLOCKED_CAP) * 100))
  const blockedScore = Math.min(100, Math.round((params.blockedDependents / BLOCKED_CAP) * 100))
  const dependencyWeight = Math.round((unresolvedScore + blockedScore) / 2)

  const raw =
    0.4 * severityScore +
    0.35 * params.blockerImpact +
    0.15 * depthScore +
    0.1 * dependencyWeight

  if (params.hasCycle) return 100
  if (params.hasCriticalChain) return Math.max(90, Math.min(100, Math.round(raw)))
  return Math.min(100, Math.round(raw))
}

export function buildBlockerChain(taskId: string, tasks: PlanTask[], meta: Record<string, DependencyMeta>): string[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const visited = new Set<string>()
  const chain: string[] = []
  let current = byId.get(taskId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    chain.push(current.id)
    const unresolved = meta[current.id]?.unresolvedDeps ?? []
    if (unresolved.length === 0) break
    current = byId.get(unresolved[0])
  }

  return chain
}

export function scoreTasks(
  tasks: PlanTask[],
  actionSeverityIndex: Record<string, AuditSeverity | 'Unknown'>,
): ScoredTask[] {
  const meta = computeDependencyMeta(tasks)

  const scored = tasks.map((task) => {
    const strongestSeverity = task.actionIds
      .map((actionId) => actionSeverityIndex[actionId] ?? 'Unknown')
      .sort((a, b) => severityToScore(b) - severityToScore(a))[0] ?? 'Unknown'

    const blockerImpact = Math.min(
      100,
      statusBlockerImpact(task.status) + (meta[task.id]?.blockedDependents ?? 0) * 8,
    )

    const chain = buildBlockerChain(task.id, tasks, meta)
    const hasCriticalChain = chain.some((id) => {
      const candidate = tasks.find((taskItem) => taskItem.id === id)
      if (!candidate) return false
      return candidate.actionIds.some((actionId) => actionSeverityIndex[actionId] === 'Critical')
    })

    const urgencyScore = computeUrgencyScore({
      severity: strongestSeverity,
      blockerImpact,
      dependencyDepth: meta[task.id]?.depth ?? 0,
      unresolvedDeps: meta[task.id]?.unresolvedDeps.length ?? 0,
      blockedDependents: meta[task.id]?.blockedDependents ?? 0,
      hasCycle: meta[task.id]?.hasCycle ?? false,
      hasCriticalChain,
    })

    return {
      ...task,
      urgencyScore,
      urgencyBand: urgencyBand(urgencyScore),
      dependencyDepth: meta[task.id]?.depth ?? 0,
      blockerChain: chain,
    }
  })

  return scored.sort((a, b) => {
    if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
    if (b.blockerChain.length !== a.blockerChain.length) return b.blockerChain.length - a.blockerChain.length
    const aCreated = parseDateSafe(a.createdAt)
    const bCreated = parseDateSafe(b.createdAt)
    if (aCreated !== bCreated) return aCreated - bCreated
    return a.id.localeCompare(b.id)
  })
}

export function dependencySort(tasks: ScoredTask[]): ScoredTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const inDegree = new Map<string, number>()
  const forward = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, task.dependencies.filter((dep) => byId.has(dep)).length)
    for (const dep of task.dependencies) {
      if (!byId.has(dep)) continue
      const list = forward.get(dep) ?? []
      list.push(task.id)
      forward.set(dep, list)
    }
  }

  const ready: ScoredTask[] = tasks.filter((task) => (inDegree.get(task.id) ?? 0) === 0)
  const ordered: ScoredTask[] = []

  const pickNext = () => {
    ready.sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
      if (b.blockerChain.length !== a.blockerChain.length) return b.blockerChain.length - a.blockerChain.length
      return a.id.localeCompare(b.id)
    })
    return ready.shift() ?? null
  }

  while (ready.length > 0) {
    const next = pickNext()
    if (!next) break
    ordered.push(next)

    for (const dependentId of forward.get(next.id) ?? []) {
      const currentInDegree = inDegree.get(dependentId) ?? 0
      const nextInDegree = Math.max(0, currentInDegree - 1)
      inDegree.set(dependentId, nextInDegree)
      if (nextInDegree === 0) {
        const dependent = byId.get(dependentId)
        if (dependent && !ordered.some((item) => item.id === dependent.id) && !ready.some((item) => item.id === dependent.id)) {
          ready.push(dependent)
        }
      }
    }
  }

  if (ordered.length === tasks.length) return ordered

  const leftover = tasks
    .filter((task) => !ordered.some((item) => item.id === task.id))
    .sort((a, b) => {
      const aCycle = a.blockerChain.includes(a.id) && a.blockerChain.length > 1
      const bCycle = b.blockerChain.includes(b.id) && b.blockerChain.length > 1
      if (aCycle !== bCycle) return aCycle ? -1 : 1
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
      return a.id.localeCompare(b.id)
    })

  return [...ordered, ...leftover]
}

export function validatePromotion(tasks: ScoredTask[]): PromotionValidation {
  const selected = tasks.filter((task) => task.missionCandidate)
  const byId = new Map(tasks.map((task) => [task.id, task]))

  const hasOpenOrMissingDependencies = (task: ScoredTask) => {
    return task.dependencies.some((depId) => {
      const dep = byId.get(depId)
      if (!dep) return true
      return dep.status !== 'done'
    })
  }

  const checks = [
    {
      key: 'candidate_exists',
      ok: selected.length > 0,
      reason: selected.length > 0 ? 'At least one task selected for mission promotion.' : 'Select at least one task.',
    },
    {
      key: 'dependency_closure',
      ok: selected.every((task) => !hasOpenOrMissingDependencies(task)),
      reason: 'Candidate tasks must not have unresolved blocker chain.',
    },
    {
      key: 'status_ready',
      ok: selected.every((task) => task.status === 'done'),
      reason: 'Only resolved tasks can be promoted.',
    },
    {
      key: 'audit_linked',
      ok: selected.every((task) => task.auditIds.length > 0),
      reason: 'Each task must link to at least one audit.',
    },
    {
      key: 'prompt_exists',
      ok: selected.every((task) => !!task.prompt && task.prompt.length > 0),
      reason: 'Each task must have a generated prompt.',
    },
    {
      key: 'evidence_present',
      ok: selected.every((task) => !!task.evidencePath),
      reason: 'Each task must include evidence path.',
    },
  ]

  return {
    ready: checks.every((check) => check.ok),
    checks,
  }
}

export function archiveSorter(tasks: ScoredTask[]): ScoredTask[] {
  return tasks
    .filter((task) => !!task.archivedAt)
    .sort((a, b) => {
      const aArchived = parseDateSafe(a.archivedAt ?? a.updatedAt)
      const bArchived = parseDateSafe(b.archivedAt ?? b.updatedAt)
      if (bArchived !== aArchived) return bArchived - aArchived
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
      if (b.dependencies.length !== a.dependencies.length) return b.dependencies.length - a.dependencies.length
      return a.id.localeCompare(b.id)
    })
}

export function createTasksFromAuditActions(params: {
  actions: AuditActionItem[]
  reportId: string
  reportFilePath: string
}): PlanTask[] {
  const now = new Date().toISOString()

  return params.actions.map((action) => ({
    id: `${params.reportId}-${action.id}`,
    title: action.title,
    owner: action.owner ?? 'Unassigned',
    status:
      action.state === 'Done'
        ? 'done'
        : action.state === 'In Progress'
          ? 'in_progress'
          : action.state === 'Blocked'
            ? 'blocked'
            : 'todo',
    priority: action.priority,
    dependencies: action.dependencies?.map((dep) => `${params.reportId}-${dep}`) ?? [],
    auditIds: [params.reportId],
    actionIds: [action.id],
    evidencePath: params.reportFilePath,
    createdAt: action.createdAt ?? now,
    updatedAt: action.updatedAt ?? now,
    missionCandidate: false,
    prompt: `Task ${action.id}: ${action.title}\nAudit: ${params.reportId}\nEvidence: ${params.reportFilePath}\nDoD: deliver deterministic fix with test coverage.`,
  }))
}

// ─── Deduplication worker ────────────────────────────────────────────────────

/** Stable fingerprint: auditId + normalised title (lowercase, no whitespace) */
export function taskFingerprint(task: Pick<PlanTask, 'auditIds' | 'title'>): string {
  const auditKey = [...task.auditIds].sort().join('|')
  const titleKey = task.title.toLowerCase().replace(/\s+/g, '')
  return `${auditKey}::${titleKey}`
}

/**
 * Merge incoming tasks into existing list without creating duplicates.
 * Returns the merged list and a count of how many were actually added.
 */
export function mergeTasksDedup(
  existing: PlanTask[],
  incoming: PlanTask[],
): { merged: PlanTask[]; addedCount: number; skippedCount: number } {
  const knownIds = new Set(existing.map((t) => t.id))
  const knownFingerprints = new Set(existing.map(taskFingerprint))

  let addedCount = 0
  let skippedCount = 0
  const result = [...existing]

  for (const task of incoming) {
    if (knownIds.has(task.id) || knownFingerprints.has(taskFingerprint(task))) {
      skippedCount++
      continue
    }
    result.push(task)
    knownIds.add(task.id)
    knownFingerprints.add(taskFingerprint(task))
    addedCount++
  }

  return { merged: result, addedCount, skippedCount }
}

// ─── Audit file → tasks ──────────────────────────────────────────────────────

export type AuditFileTask = {
  auditId: string
  auditType: string
  date: string
  title: string
  priority: PlanTaskPriority
  findings: string[]
  filePath: string
  owner?: string
}

function normalizeWorkerOwner(owner?: string): string {
  if (!owner) return 'Unassigned'
  const normalized = owner.trim().toLowerCase().replace(/[_\s]+/g, '-')

  if (normalized.includes('system-auditor') || normalized.includes('auditor')) return 'Auditor'
  if (normalized.includes('security')) return 'Security Engineer'
  if (normalized.includes('backend')) return 'Backend Developer'
  if (normalized.includes('frontend') || normalized.includes('ui-ux')) return 'Frontend / UI'
  if (normalized.includes('devops') || normalized.includes('infra')) return 'DevOps'
  if (normalized.includes('data')) return 'Data Engineer'
  if (normalized.includes('analytics')) return 'Analytics'
  if (normalized.includes('planner') || normalized.includes('project-manager')) return 'Planner'

  return owner
}

export function createTasksFromAuditFiles(files: AuditFileTask[]): PlanTask[] {
  const now = new Date().toISOString()
  return files.map((file) => {
    const id = `${file.auditId}-TASK`
    const findingsSummary = file.findings.slice(0, 3).join(' | ') || 'See audit file.'
    return {
      id,
      title: file.title || file.auditId,
      owner: normalizeWorkerOwner(file.owner),
      status: 'todo' as PlanTaskStatus,
      priority: file.priority,
      dependencies: [],
      auditIds: [file.auditId],
      actionIds: [],
      evidencePath: file.filePath,
      createdAt: file.date ? `${file.date}T00:00:00.000Z` : now,
      updatedAt: now,
      missionCandidate: false,
      prompt: `Audit: ${file.auditId} [${file.auditType}]\nFindings: ${findingsSummary}\nEvidence: ${file.filePath}\nDoD: deliver deterministic fix + test coverage.`,
    }
  })
}

// ─── Mission Officer Agent ───────────────────────────────────────────────────

export type MissionDomain =
  | 'SECURITY'
  | 'PIPELINE'
  | 'DISTRIBUTION'
  | 'ANALYTICS'
  | 'INFRASTRUCTURE'
  | 'DATABASE'
  | 'FRONTEND'
  | 'BACKEND'
  | 'QUALITY'
  | 'OPERATIONS'
  | 'UNKNOWN'

const DOMAIN_KEYWORDS: Record<MissionDomain, string[]> = {
  SECURITY: ['security', 'sec', 'auth', 'cors', 'rate', 'limit', 'owasp', 'key', 'secret', 'token', 'api_key', 'password'],
  PIPELINE: ['pipeline', 'writer', 'scout', 'curator', 'enrichment', 'cluster', 'cron', 'worker', 'queue'],
  DISTRIBUTION: ['social', 'distribution', 'instagram', 'tiktok', 'twitter', 'reach', 'post', 'share'],
  ANALYTICS: ['analytics', 'posthog', 'tracking', 'metric', 'event', 'report', 'kpi'],
  INFRASTRUCTURE: ['devops', 'ci', 'cd', 'docker', 'vercel', 'deploy', 'redis', 'nginx'],
  DATABASE: ['database', 'db', 'supabase', 'postgres', 'schema', 'migration'],
  FRONTEND: ['ui', 'ux', 'uiux', 'frontend', 'react', 'css', 'layout', 'responsive'],
  BACKEND: ['backend', 'api', 'endpoint', 'nestjs', 'fastapi', 'route', 'server'],
  QUALITY: ['qa', 'test', 'lint', 'quality', 'coverage', 'markdown', 'typescript'],
  OPERATIONS: ['ops', 'operations', 'general', 'audit', 'monitoring', 'alert'],
  UNKNOWN: [],
}

const DOMAIN_PHASE_ORDER: MissionDomain[] = [
  'SECURITY',
  'INFRASTRUCTURE',
  'DATABASE',
  'PIPELINE',
  'BACKEND',
  'FRONTEND',
  'QUALITY',
  'DISTRIBUTION',
  'ANALYTICS',
  'OPERATIONS',
  'UNKNOWN',
]

export function classifyDomain(task: PlanTask): MissionDomain {
  const text = `${task.id} ${task.title} ${task.auditIds.join(' ')} ${task.evidencePath ?? ''}`.toLowerCase()
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [MissionDomain, string[]][]) {
    if (domain === 'UNKNOWN') continue
    if (keywords.some((kw) => text.includes(kw))) return domain
  }
  return 'UNKNOWN'
}

const DOMAIN_TO_AGENT: Record<MissionDomain, string> = {
  SECURITY: 'security',
  INFRASTRUCTURE: 'devops',
  DATABASE: 'db-engineer',
  PIPELINE: 'ai-pipeline',
  BACKEND: 'backend-engineer',
  FRONTEND: 'frontend-engineer',
  QUALITY: 'qa',
  DISTRIBUTION: 'api-integration',
  ANALYTICS: 'analytics',
  OPERATIONS: 'system-auditor',
  UNKNOWN: 'product-manager',
}

export function domainToAgent(domain: MissionDomain): string {
  return DOMAIN_TO_AGENT[domain] ?? 'product-manager'
}

export type MissionPackage = {
  id: string
  name: string
  domain: MissionDomain
  phase: 'Foundation' | 'Build' | 'Validate' | 'Launch' | 'Scale'
  priority: PlanTaskPriority
  chronologicalOrder: number
  taskIds: string[]
  taskCount: number
  urgencyScore: number
  rationale: string
}

function domainToPhase(domain: MissionDomain): MissionPackage['phase'] {
  if (['SECURITY', 'INFRASTRUCTURE', 'DATABASE'].includes(domain)) return 'Foundation'
  if (['PIPELINE', 'BACKEND', 'FRONTEND'].includes(domain)) return 'Build'
  if (['QUALITY'].includes(domain)) return 'Validate'
  if (['DISTRIBUTION'].includes(domain)) return 'Launch'
  return 'Scale'
}

function priorityScore(p: PlanTaskPriority): number {
  return p === 'P0' ? 4 : p === 'P1' ? 3 : p === 'P2' ? 2 : 1
}

/**
 * Mission Officer Agent — assembles tasks into logical chronological missions.
 * Returns mission packages ordered by phase precedence + urgency.
 */
export function missionOfficerAnalyze(tasks: ScoredTask[]): MissionPackage[] {
  const activeTasks = tasks.filter((t) => t.status !== 'done' && !t.archivedAt)
  if (activeTasks.length === 0) return []

  // Group by domain
  const groups = new Map<MissionDomain, ScoredTask[]>()
  for (const task of activeTasks) {
    const domain = classifyDomain(task)
    const current = groups.get(domain) ?? []
    current.push(task)
    groups.set(domain, current)
  }

  const packages: MissionPackage[] = []

  for (const domain of DOMAIN_PHASE_ORDER) {
    const group = groups.get(domain)
    if (!group || group.length === 0) continue

    // Sort within group: P0 first, then urgency score desc, then by date asc
    const sorted = [...group].sort((a, b) => {
      const pDiff = priorityScore(b.priority) - priorityScore(a.priority)
      if (pDiff !== 0) return pDiff
      const uDiff = b.urgencyScore - a.urgencyScore
      if (uDiff !== 0) return uDiff
      return a.createdAt.localeCompare(b.createdAt)
    })

    const topPriority = sorted[0].priority
    const avgUrgency = Math.round(sorted.reduce((sum, t) => sum + t.urgencyScore, 0) / sorted.length)
    const phase = domainToPhase(domain)
    const order = DOMAIN_PHASE_ORDER.indexOf(domain)

    packages.push({
      id: `MO-${domain}-${Date.now().toString(36)}`,
      name: `[${domain}] ${phase} Package`,
      domain,
      phase,
      priority: topPriority,
      chronologicalOrder: order,
      taskIds: sorted.map((t) => t.id),
      taskCount: sorted.length,
      urgencyScore: avgUrgency,
      rationale: `${sorted.length} tasks in ${domain} domain. Top priority: ${topPriority}. Avg urgency: ${avgUrgency}. Phase: ${phase}. Must be resolved before dependent phases.`,
    })
  }

  // Final sort: by chronological order (phase precedence), then urgency
  return packages.sort((a, b) => {
    if (a.chronologicalOrder !== b.chronologicalOrder) return a.chronologicalOrder - b.chronologicalOrder
    return b.urgencyScore - a.urgencyScore
  })
}

// ─── RNS builder ─────────────────────────────────────────────────────────────

export type RnsSuggestion = {
  title: string
  why: string
  agent: string
  missionRef?: string
  confidence: number
  horizon: 'today' | 'week' | 'sprint'
}

function urgencyToHorizon(score: number): RnsSuggestion['horizon'] {
  if (score >= 85) return 'today'
  if (score >= 60) return 'week'
  return 'sprint'
}

function confidenceFor(pkg: MissionPackage, scoredTasks: ScoredTask[]): number {
  const cycles = scoredTasks.filter((t) => pkg.taskIds.includes(t.id) && t.blockerChain.length > 1)
  const cyclePenalty = cycles.length > 0 ? 0.15 : 0
  const sizePenalty = pkg.taskCount > 8 ? 0.1 : 0
  const base = pkg.urgencyScore >= 85 ? 0.95 : pkg.urgencyScore >= 60 ? 0.8 : 0.65
  return Math.max(0.3, Math.min(0.99, base - cyclePenalty - sizePenalty))
}

/**
 * Build Recommended Next Steps from packaged missions + scored tasks.
 * Returns 3–5 items, ordered by phase precedence and urgency.
 */
export function buildRnsSuggestions(
  packages: MissionPackage[],
  scoredTasks: ScoredTask[],
): RnsSuggestion[] {
  const suggestions: RnsSuggestion[] = []

  for (const pkg of packages.slice(0, 5)) {
    suggestions.push({
      title: pkg.name,
      why: `${pkg.taskCount} úkolů v doméně ${pkg.domain}, fáze ${pkg.phase}, prio ${pkg.priority}.`,
      agent: domainToAgent(pkg.domain),
      missionRef: pkg.id,
      confidence: confidenceFor(pkg, scoredTasks),
      horizon: urgencyToHorizon(pkg.urgencyScore),
    })
  }

  // Surface single P0 tasks not covered by top packages
  const inTopPackages = new Set(packages.slice(0, 5).flatMap((p) => p.taskIds))
  const orphanP0 = scoredTasks.find(
    (t) => t.priority === 'P0' && t.status !== 'done' && !inTopPackages.has(t.id),
  )
  if (orphanP0 && suggestions.length < 5) {
    suggestions.push({
      title: `Vyřeš ${orphanP0.id}`,
      why: `Samostatný P0 mimo top balíky: ${orphanP0.title}.`,
      agent: domainToAgent(classifyDomain(orphanP0)),
      confidence: 0.9,
      horizon: 'today',
    })
  }

  // If nothing critical, propose a strategic review
  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Strategický review',
      why: 'Žádné aktivní mise — naplánuj další růstovou iniciativu.',
      agent: 'product-manager',
      confidence: 0.5,
      horizon: 'week',
    })
  }

  return suggestions.slice(0, 5)
}
