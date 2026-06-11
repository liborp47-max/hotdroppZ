'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  Flag,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Mission, Plan, PlanTaskSerialized } from '@/lib/hd-central/types'
import type { AuditFileMeta } from '@/app/api/hd-central/audit-files/route'
import type { RnsFeed, RnsItem } from '@/app/api/hd-central/rns/route'
import {
  buildRnsSuggestions,
  classifyDomain,
  createTasksFromAuditFiles,
  dependencySort,
  mergeTasksDedup,
  missionOfficerAnalyze,
  priorityFromUrgency,
  scoreTasks,
  type MissionDomain,
  type MissionPackage,
  type PlanTask,
  type PlanTaskPriority,
  type PlanTaskStatus,
  type ScoredTask,
} from './plans-logic'

// ─── helpers ─────────────────────────────────────────────────────────────────

type Snapshot = { tasks: PlanTask[] }

function emptyPlan(): Plan {
  return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
}

function priorityBadge(priority: PlanTaskPriority): string {
  if (priority === 'P0') return 'border-red-500/35 bg-red-500/12 text-red-300'
  if (priority === 'P1') return 'border-amber-500/35 bg-amber-500/12 text-amber-300'
  if (priority === 'P2') return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

function statusBadge(status: PlanTaskStatus): string {
  if (status === 'done') return 'border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]'
  if (status === 'in_progress') return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
  if (status === 'blocked') return 'border-red-500/35 bg-red-500/12 text-red-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

function domainColor(domain: string): string {
  const map: Record<string, string> = {
    SECURITY: 'text-red-300 border-red-500/30 bg-red-500/10',
    PIPELINE: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
    DISTRIBUTION: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    ANALYTICS: 'text-teal-300 border-teal-500/30 bg-teal-500/10',
    INFRASTRUCTURE: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    DATABASE: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
    FRONTEND: 'text-pink-300 border-pink-500/30 bg-pink-500/10',
    BACKEND: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
    QUALITY: 'text-[#1AEE99] border-lime-500/30 bg-[rgba(0,224,133,0.10)]',
    OPERATIONS: 'text-[#D0D0D0] border-white/20 bg-white/[0.12]',
    UNKNOWN: 'text-[#A8A8A8] border-white/15 bg-white/[0.05]',
  }
  return map[domain] ?? 'text-[#D0D0D0] border-white/15 bg-white/[0.05]'
}

function horizonBadge(h: RnsItem['horizon']): string {
  if (h === 'today') return 'border-red-500/35 bg-red-500/12 text-red-300'
  if (h === 'week') return 'border-amber-500/35 bg-amber-500/12 text-amber-300'
  return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
}

function formatRelative(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'právě teď'
  if (m < 60) return `před ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `před ${h} h`
  const days = Math.floor(h / 24)
  return `před ${days} d`
}

function toSerialized(task: PlanTask): PlanTaskSerialized {
  return {
    id: task.id,
    title: task.title,
    owner: task.owner,
    status: task.status,
    priority: task.priority,
    dependencies: task.dependencies,
    auditIds: task.auditIds,
    actionIds: task.actionIds,
    evidencePath: task.evidencePath,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    archivedAt: task.archivedAt,
    prompt: task.prompt,
    missionCandidate: task.missionCandidate,
  }
}

function fromSerialized(task: PlanTaskSerialized): PlanTask {
  return { ...task }
}

const DOMAINS: MissionDomain[] = [
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

// ─── component ────────────────────────────────────────────────────────────────

export function PlanningRoomClient() {
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [savingMission, setSavingMission] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [loadedPlan, setLoadedPlan] = useState<Plan>(emptyPlan())
  const [lastPlanRun, setLastPlanRun] = useState<string | undefined>(undefined)

  // import
  const [auditFiles, setAuditFiles] = useState<AuditFileMeta[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [lastImportStats, setLastImportStats] = useState<{ added: number; skipped: number } | null>(null)

  // mission proposals (formerly Mission Officer)
  const [proposalsOpen, setProposalsOpen] = useState(false)
  const [proposalPackages, setProposalPackages] = useState<MissionPackage[]>([])
  const [sendingPackageId, setSendingPackageId] = useState<string | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)

  // RNS feed
  const [rnsItems, setRnsItems] = useState<RnsItem[]>([])
  const [rnsLoading, setRnsLoading] = useState(false)
  const [rnsRefreshedAt, setRnsRefreshedAt] = useState<string | undefined>(undefined)

  // listing filters
  const [filterText, setFilterText] = useState('')
  const [filterPriority, setFilterPriority] = useState<'all' | PlanTaskPriority>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | PlanTaskStatus>('all')
  const [filterDomain, setFilterDomain] = useState<'all' | MissionDomain>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortField, setSortField] = useState<'priority' | 'status' | 'title'>('priority')

  // add task
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [newPriority, setNewPriority] = useState<PlanTaskPriority>('P2')

  // ── load plan ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/hd-central/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const plan = data as Plan
        setLoadedPlan(plan)
        setLastPlanRun(plan.lastPlanRun)
        if (Array.isArray(plan.tasks) && plan.tasks.length > 0) {
          setTasks(plan.tasks.map(fromSerialized))
        }
      })
      .catch(() => null)
  }, [])

  const refreshRns = useCallback(async () => {
    setRnsLoading(true)
    try {
      const res = await fetch('/api/hd-central/rns')
      if (!res.ok) return
      const feed = (await res.json()) as RnsFeed
      setRnsItems(feed.items ?? [])
      setRnsRefreshedAt(feed.updatedAt)
    } catch {
      // ignore
    } finally {
      setRnsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshRns()
  }, [refreshRns])

  // ── derived ────────────────────────────────────────────────────────────────
  const scoredTasks = useMemo(() => scoreTasks(tasks, {}), [tasks])
  const dependencySorted = useMemo(() => dependencySort(scoredTasks), [scoredTasks])

  const taskDomains = useMemo(() => {
    const map = new Map<string, MissionDomain>()
    for (const t of dependencySorted) map.set(t.id, classifyDomain(t))
    return map
  }, [dependencySorted])

  const selectedTask: ScoredTask | null = useMemo(
    () => dependencySorted.find((t) => t.id === selectedTaskId) ?? null,
    [dependencySorted, selectedTaskId],
  )

  const filteredTasks = useMemo(() => {
    const prioScore = (p: PlanTaskPriority) => (p === 'P0' ? 4 : p === 'P1' ? 3 : p === 'P2' ? 2 : 1)
    const fromTs = filterDateFrom ? new Date(filterDateFrom).getTime() : null
    const toTs = filterDateTo ? new Date(filterDateTo).getTime() + 86_399_000 : null
    return dependencySorted
      .filter((t) => {
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false
        if (filterStatus !== 'all' && t.status !== filterStatus) return false
        if (filterDomain !== 'all' && taskDomains.get(t.id) !== filterDomain) return false
        if (filterText) {
          const q = filterText.toLowerCase()
          if (
            !t.id.toLowerCase().includes(q) &&
            !t.title.toLowerCase().includes(q) &&
            !t.owner.toLowerCase().includes(q)
          ) {
            return false
          }
        }
        if (fromTs !== null || toTs !== null) {
          const created = new Date(t.createdAt).getTime()
          if (fromTs !== null && created < fromTs) return false
          if (toTs !== null && created > toTs) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortField === 'priority') return prioScore(b.priority) - prioScore(a.priority) || b.urgencyScore - a.urgencyScore
        if (sortField === 'status') return a.status.localeCompare(b.status)
        return a.title.localeCompare(b.title)
      })
  }, [dependencySorted, filterDateFrom, filterDateTo, filterDomain, filterPriority, filterStatus, filterText, sortField, taskDomains])

  const stats = useMemo(() => {
    const p0 = tasks.filter((t) => t.priority === 'P0').length
    const p1 = tasks.filter((t) => t.priority === 'P1').length
    const blocked = tasks.filter((t) => t.status === 'blocked').length
    const done = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length
    const todo = tasks.filter((t) => t.status === 'todo').length
    return {
      total: tasks.length,
      p0,
      p1,
      blocked,
      done,
      inProgress,
      todo,
      active: tasks.length - done,
      missions: loadedPlan.missions.length,
    }
  }, [tasks, loadedPlan.missions.length])

  // ── persistence ────────────────────────────────────────────────────────────
  const savePlanRef = useRef<NodeJS.Timeout | null>(null)
  const persistTasks = useCallback(
    (nextTasks: PlanTask[], nextRun?: string) => {
      if (savePlanRef.current) clearTimeout(savePlanRef.current)
      savePlanRef.current = setTimeout(async () => {
        setSavingPlan(true)
        try {
          const payload: Plan = {
            version: loadedPlan.version || 1,
            updatedAt: new Date().toISOString(),
            missions: loadedPlan.missions,
            tasks: nextTasks.map(toSerialized),
            lastPlanRun: nextRun ?? lastPlanRun,
          }
          const res = await fetch('/api/hd-central/plan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            const persisted = (await res.json()) as Plan
            setLoadedPlan(persisted)
            if (persisted.lastPlanRun) setLastPlanRun(persisted.lastPlanRun)
          }
        } catch {
          // silent
        } finally {
          setSavingPlan(false)
        }
      }, 600)
    },
    [loadedPlan.missions, loadedPlan.version, lastPlanRun],
  )

  useEffect(() => {
    return () => {
      if (savePlanRef.current) clearTimeout(savePlanRef.current)
    }
  }, [])

  // ── handlers ───────────────────────────────────────────────────────────────
  const pushHistory = () => setHistory((prev) => [...prev, { tasks: [...tasks] }])

  const applyTasks = (next: PlanTask[], runStamp?: string) => {
    setTasks(next)
    persistTasks(next, runStamp)
  }

  const importFromAuditFiles = async () => {
    setImportLoading(true)
    setActionInfo(null)
    try {
      const res = await fetch('/api/hd-central/audit-files')
      if (!res.ok) {
        setActionInfo('Import selhal — API error.')
        return
      }
      const files = (await res.json()) as AuditFileMeta[]
      setAuditFiles(files)

      const incoming = createTasksFromAuditFiles(
        files.map((f) => ({
          auditId: f.id,
          auditType: f.type,
          date: f.date,
          title: f.title,
          priority: f.priority,
          findings: f.findings,
          filePath: f.filePath,
          owner: f.ownerAgent,
        })),
      )

      pushHistory()
      const { merged, addedCount, skippedCount } = mergeTasksDedup(tasks, incoming)
      applyTasks(merged)
      setLastImportStats({ added: addedCount, skipped: skippedCount })
      setActionInfo(`Import: ${files.length} auditů → +${addedCount} nových úkolů, ${skippedCount} duplikátů přeskočeno.`)
    } catch {
      setActionInfo('Import selhal — síťová chyba.')
    } finally {
      setImportLoading(false)
    }
  }

  const autoTriage = () => {
    pushHistory()
    const snapshot = scoreTasks(tasks, {})
    const next = tasks.map((task) => {
      const scored = snapshot.find((s) => s.id === task.id)
      if (!scored) return task
      return {
        ...task,
        priority: priorityFromUrgency(scored.urgencyScore),
        status: scored.blockerChain.length > 1 && task.status !== 'done' ? ('blocked' as PlanTaskStatus) : task.status,
        updatedAt: new Date().toISOString(),
      }
    })
    applyTasks(next)
    setActionInfo('Auto-Triage: priority přepočítány.')
  }

  const runPlanManager = async () => {
    const packages = missionOfficerAnalyze(dependencySorted)
    setProposalPackages(packages)
    setProposalsOpen(true)

    const runStamp = new Date().toISOString()
    setLastPlanRun(runStamp)
    persistTasks(tasks, runStamp)

    // Build + push RNS
    const suggestions = buildRnsSuggestions(packages, dependencySorted)
    if (suggestions.length > 0) {
      try {
        await fetch('/api/hd-central/rns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: suggestions, replace: true }),
        })
        await refreshRns()
      } catch {
        // silent
      }
    }

    setActionInfo(`Plan Manager: ${packages.length} misí navrženo z ${stats.active} aktivních úkolů.`)
  }

  const sendPackageToCEO = async (pkg: MissionPackage) => {
    setSendingPackageId(pkg.id)
    setSavingMission(true)
    const newMission: Mission = {
      id: `MO-${loadedPlan.missions.length + 1}-${pkg.domain}`,
      name: pkg.name,
      purpose: pkg.rationale,
      description: pkg.taskIds.join(', '),
      importantInfo: `Domain: ${pkg.domain} | Phase: ${pkg.phase} | Tasks: ${pkg.taskCount} | Avg urgency: ${pkg.urgencyScore}`,
      phase: pkg.phase,
      priority: pkg.priority as Mission['priority'],
      status: 'todo',
      domains: [pkg.domain],
      createdAt: new Date().toISOString(),
      urgencyScore: pkg.urgencyScore,
      // Land in CEO Missions inbox (staging) — CEO promotes to Timeline manually.
      inTimeline: false,
    }
    const nextPlan: Plan = {
      version: loadedPlan.version,
      updatedAt: new Date().toISOString(),
      missions: [...loadedPlan.missions, newMission],
      tasks: tasks.map(toSerialized),
      lastPlanRun,
    }
    try {
      const res = await fetch('/api/hd-central/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPlan),
      })
      if (!res.ok) {
        setActionInfo('Odeslání mise selhalo — API error.')
        return
      }
      const persisted = (await res.json()) as Plan
      setLoadedPlan(persisted)
      setProposalPackages((prev) => prev.filter((p) => p.id !== pkg.id))
      setActionInfo(`Mise "${newMission.id}" odeslána do CEO.`)
    } catch {
      setActionInfo('Odeslání mise selhalo — síťová chyba.')
    } finally {
      setSendingPackageId(null)
      setSavingMission(false)
    }
  }

  const deleteTask = (id: string) => {
    pushHistory()
    const next = tasks.filter((t) => t.id !== id)
    applyTasks(next)
    if (selectedTaskId === id) {
      setSelectedTaskId(null)
      setDrawerOpen(false)
    }
    setActionInfo(`Úkol ${id} smazán.`)
  }

  const updateTaskStatus = (id: string, status: PlanTaskStatus) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t))
    applyTasks(next)
  }

  const addTask = () => {
    if (!newTitle.trim()) return
    pushHistory()
    const id = `MANUAL-${Date.now().toString(36).toUpperCase()}`
    const now = new Date().toISOString()
    const task: PlanTask = {
      id,
      title: newTitle.trim(),
      owner: newOwner.trim() || 'Unassigned',
      status: 'todo',
      priority: newPriority,
      dependencies: [],
      auditIds: [],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
      missionCandidate: false,
    }
    applyTasks([task, ...tasks])
    setNewTitle('')
    setNewOwner('')
    setNewPriority('P2')
    setAddOpen(false)
    setActionInfo(`Úkol ${id} přidán.`)
  }

  const rollback = () => {
    if (history.length === 0) {
      setActionInfo('Nic k vrácení.')
      return
    }
    const last = history[history.length - 1]
    applyTasks(last.tasks)
    setHistory((prev) => prev.slice(0, -1))
    setActionInfo('Vráceno.')
  }

  const resetFilters = () => {
    setFilterText('')
    setFilterPriority('all')
    setFilterStatus('all')
    setFilterDomain('all')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const filtersDirty =
    filterText !== '' ||
    filterPriority !== 'all' ||
    filterStatus !== 'all' ||
    filterDomain !== 'all' ||
    filterDateFrom !== '' ||
    filterDateTo !== ''

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ── Header bar ── */}
      <section className="plastic-card-hi flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#00E085]">PLAN HQ</p>
          <h1 className="text-lg font-light uppercase tracking-[2px] text-[#f0f0f0]">HD Central — Plan Manager</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[#A8A8A8]">{stats.total} tasks</span>
          {stats.p0 > 0 && (
            <Badge className="border-red-500/35 bg-red-500/12 text-red-300 text-[10px]">P0: {stats.p0}</Badge>
          )}
          {stats.blocked > 0 && (
            <Badge className="border-orange-500/35 bg-orange-500/12 text-orange-300 text-[10px]">
              blocked: {stats.blocked}
            </Badge>
          )}
          <Badge className="border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99] text-[10px]">
            done: {stats.done}
          </Badge>
          <span className="text-[10px] text-[#6E6E6E]">
            last run: {lastPlanRun ? formatRelative(lastPlanRun) : '—'}
          </span>
          {savingPlan && <Loader2 className="h-3 w-3 animate-spin text-[#6E6E6E]" />}
          {actionInfo && <span className="text-xs text-[#A8A8A8] max-w-xs truncate">{actionInfo}</span>}
        </div>
      </section>

      {/* ── Toolbar ── */}
      <section className="plastic-card px-3 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={importFromAuditFiles}
            disabled={importLoading}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
          >
            {importLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Import dat
          </Button>
          <Button onClick={autoTriage} size="sm" variant="outline" className="h-8 text-xs">
            Auto-Triage
          </Button>
          <Button
            onClick={rollback}
            disabled={history.length === 0}
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-[#A8A8A8] hover:text-[#D0D0D0] disabled:opacity-30"
          >
            ↩ Rollback
          </Button>

          <span className="mx-1 h-5 w-px bg-white/10" />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6E6E]" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Hledat..."
              className="h-8 w-44 pl-8 text-xs border-white/10 bg-black/50 backdrop-blur-xl"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E6E] hover:text-[#A8A8A8]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as typeof filterPriority)}>
            <SelectTrigger className="h-8 w-24 text-xs border-white/10 bg-black/50 backdrop-blur-xl">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Priority</SelectItem>
              <SelectItem value="P0">P0</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
              <SelectItem value="P3">P3</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="h-8 w-28 text-xs border-white/10 bg-black/50 backdrop-blur-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="todo">todo</SelectItem>
              <SelectItem value="in_progress">in progress</SelectItem>
              <SelectItem value="blocked">blocked</SelectItem>
              <SelectItem value="done">done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDomain} onValueChange={(v) => setFilterDomain(v as typeof filterDomain)}>
            <SelectTrigger className="h-8 w-32 text-xs border-white/10 bg-black/50 backdrop-blur-xl">
              <SelectValue placeholder="Domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Domain</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-8 w-[130px] text-xs border-white/10 bg-black/50 backdrop-blur-xl"
            aria-label="Datum od"
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-8 w-[130px] text-xs border-white/10 bg-black/50 backdrop-blur-xl"
            aria-label="Datum do"
          />

          {filtersDirty && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[#A8A8A8] hover:text-[#D0D0D0]"
            >
              Reset
            </button>
          )}

          <span className="ml-auto" />

          <Button
            onClick={() => setStatsOpen((p) => !p)}
            size="sm"
            variant="outline"
            className="h-8 text-xs"
          >
            Statistiky {statsOpen ? '▴' : '▾'}
          </Button>
        </div>

        {statsOpen && (
          <div className="grid grid-cols-2 gap-1.5 text-center md:grid-cols-7">
            {[
              { k: 'total', v: stats.total, label: 'celkem', color: 'text-[#E8E8E8]' },
              { k: 'p0', v: stats.p0, label: 'P0', color: 'text-red-300' },
              { k: 'p1', v: stats.p1, label: 'P1', color: 'text-amber-300' },
              { k: 'todo', v: stats.todo, label: 'todo', color: 'text-[#D0D0D0]' },
              { k: 'inProgress', v: stats.inProgress, label: 'in prog.', color: 'text-blue-300' },
              { k: 'blocked', v: stats.blocked, label: 'blocked', color: 'text-orange-300' },
              { k: 'done', v: stats.done, label: 'done', color: 'text-[#1AEE99]' },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md py-1.5 text-[10px]"
              >
                <p className={`font-semibold ${s.color}`}>{s.v}</p>
                <p className="text-[#6E6E6E]">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Plan Manager + RNS ── */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Plan Manager — 2/3 */}
        <article className="plastic-card p-4 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] flex items-center gap-1.5">
              <BrainCircuit className="h-3 w-3 text-[#00E085]" /> Plan Manager
            </p>
            <span className="text-[10px] text-[#6E6E6E]">
              flow: Import → Analyze → Propose → CEO
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-2.5">
              <p className="text-[10px] text-[#6E6E6E]">01 · Import</p>
              <p className="mt-1 text-sm text-[#E8E8E8]">{auditFiles.length || tasks.length} src</p>
              {lastImportStats && (
                <p className="mt-0.5 text-[10px] text-[#A8A8A8]">
                  +{lastImportStats.added} / skip {lastImportStats.skipped}
                </p>
              )}
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-2.5">
              <p className="text-[10px] text-[#6E6E6E]">02 · Active</p>
              <p className="mt-1 text-sm text-[#E8E8E8]">{stats.active}</p>
              <p className="mt-0.5 text-[10px] text-orange-300">{stats.blocked} blocked</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-2.5">
              <p className="text-[10px] text-[#6E6E6E]">03 · Proposals</p>
              <p className="mt-1 text-sm text-[#E8E8E8]">{proposalPackages.length}</p>
              <p className="mt-0.5 text-[10px] text-[#A8A8A8]">k odeslání</p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-2.5">
              <p className="text-[10px] text-[#6E6E6E]">04 · CEO Plan</p>
              <p className="mt-1 text-sm text-[#E8E8E8]">{stats.missions}</p>
              <p className="mt-0.5 text-[10px] text-[#A8A8A8]">misí</p>
            </div>
          </div>

          <Button
            onClick={runPlanManager}
            disabled={stats.active === 0}
            size="sm"
            className="w-full h-9 text-xs gap-2 bg-[rgba(0,224,133,0.12)] text-[#00E085] border border-[rgba(0,224,133,0.35)] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-40"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            Spustit Plan Manager — analyzovat, sestavit mise, vygenerovat RNS
          </Button>

          {proposalPackages.length > 0 && (
            <div className="space-y-1.5 rounded border border-white/10 bg-white/[0.02] p-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#A8A8A8]">Návrhy misí ({proposalPackages.length})</p>
                <button
                  type="button"
                  onClick={() => setProposalsOpen(true)}
                  className="text-[10px] text-[#00E085] hover:underline"
                >
                  detail →
                </button>
              </div>
              {proposalPackages.slice(0, 4).map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between border border-white/10 bg-white/[0.03] backdrop-blur-md px-2 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`text-[9px] px-1.5 py-0 ${domainColor(pkg.domain)}`}>{pkg.domain}</Badge>
                    <Badge className={`text-[9px] px-1.5 py-0 ${priorityBadge(pkg.priority)}`}>{pkg.priority}</Badge>
                    <span className="truncate text-[#D0D0D0]">{pkg.taskCount} úkolů · {pkg.phase}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendPackageToCEO(pkg)}
                    disabled={sendingPackageId === pkg.id}
                    className="ml-2 shrink-0 text-[#00E085] hover:underline disabled:opacity-50"
                  >
                    {sendingPackageId === pkg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '→ CEO'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* RNS — 1/3 */}
        <article className="plastic-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] flex items-center gap-1.5">
              <Lightbulb className="h-3 w-3 text-amber-300" /> Recom Next Steps (RNS)
            </p>
            <button
              type="button"
              onClick={() => void refreshRns()}
              disabled={rnsLoading}
              className="text-[#6E6E6E] hover:text-[#D0D0D0] disabled:opacity-30"
              aria-label="Refresh RNS"
            >
              {rnsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </button>
          </div>

          {rnsItems.length === 0 ? (
            <div className="rounded border border-dashed border-white/10 bg-white/[0.02] p-3 text-[11px] text-[#6E6E6E] text-center">
              Žádná doporučení. Spusť Plan Manager nebo počkej na agenta.
            </div>
          ) : (
            <ol className="space-y-1.5">
              {rnsItems.slice(0, 5).map((item, idx) => (
                <li
                  key={item.id}
                  className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-2 text-[11px] space-y-1"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-[#6E6E6E] w-4">{idx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#E8E8E8] leading-snug">{item.title}</p>
                      {item.why && <p className="text-[#A8A8A8] text-[10px] mt-0.5 leading-snug">{item.why}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 pl-6">
                    <Badge className={`text-[9px] px-1 py-0 ${horizonBadge(item.horizon)}`}>{item.horizon}</Badge>
                    <span className="text-[9px] text-[#6E6E6E] font-mono">@{item.agent}</span>
                    {item.missionRef && (
                      <span className="text-[9px] text-[#6E6E6E] font-mono truncate max-w-[120px]">
                        {item.missionRef}
                      </span>
                    )}
                    <span className="text-[9px] text-[#6E6E6E] ml-auto">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <p className="text-[9px] text-[#404040] text-center">
            updated: {rnsRefreshedAt ? formatRelative(rnsRefreshedAt) : '—'}
          </p>
        </article>
      </section>

      {/* ── Listing ── */}
      <section className="plastic-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#E8E8E8]">Listing úkolů</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortField} onValueChange={(v) => setSortField(v as typeof sortField)}>
              <SelectTrigger className="h-8 w-28 text-xs border-white/10 bg-black/50 backdrop-blur-xl">
                <SelectValue placeholder="Seřadit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priorita</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="title">Název</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen((p) => !p)} size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Přidat
            </Button>
          </div>
        </div>

        {addOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.025] px-4 py-2.5">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Název úkolu..."
              className="h-7 flex-1 min-w-[160px] text-xs border-white/15 bg-white/[0.03] backdrop-blur-md"
            />
            <Input
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="Owner"
              className="h-7 w-28 text-xs border-white/15 bg-white/[0.03] backdrop-blur-md"
            />
            <Select value={newPriority} onValueChange={(v) => setNewPriority(v as PlanTaskPriority)}>
              <SelectTrigger className="h-7 w-20 text-xs border-white/15 bg-white/[0.03] backdrop-blur-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P0">P0</SelectItem>
                <SelectItem value="P1">P1</SelectItem>
                <SelectItem value="P2">P2</SelectItem>
                <SelectItem value="P3">P3</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={addTask}
              size="sm"
              className="h-7 px-3 text-xs bg-[rgba(0,224,133,0.12)] text-[#00E085] border border-[rgba(0,224,133,0.35)] hover:bg-[rgba(0,224,133,0.22)]"
            >
              Přidat
            </Button>
            <button type="button" onClick={() => setAddOpen(false)} className="text-[#6E6E6E] hover:text-[#A8A8A8]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          {filteredTasks.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#6E6E6E]">
              {tasks.length === 0
                ? 'Žádné úkoly. Importuj audity nebo přidej manuálně.'
                : 'Žádné výsledky pro aktuální filtry.'}
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                  <th className="px-4 py-2 w-6" />
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Název</th>
                  <th className="px-2 py-2">Domain</th>
                  <th className="px-2 py-2">Owner</th>
                  <th className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setSortField('priority')}
                      className="flex items-center gap-1 hover:text-[#D0D0D0]"
                    >
                      Priorita {sortField === 'priority' ? '↓' : ''}
                    </button>
                  </th>
                  <th className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setSortField('status')}
                      className="flex items-center gap-1 hover:text-[#D0D0D0]"
                    >
                      Status {sortField === 'status' ? '↓' : ''}
                    </button>
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const domain = taskDomains.get(task.id) ?? 'UNKNOWN'
                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-white/[0.06] transition-colors hover:bg-white/[0.025] ${
                        selectedTaskId === task.id ? 'bg-[#0d1f10]' : ''
                      }`}
                    >
                      <td className="pl-4 py-2">
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          onChange={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                          className="accent-[#00E085]"
                          aria-label={`Done: ${task.id}`}
                        />
                      </td>
                      <td className="px-2 py-2 font-mono text-[#A8A8A8] whitespace-nowrap">
                        {task.id.length > 22 ? `${task.id.slice(0, 22)}…` : task.id}
                      </td>
                      <td className="px-2 py-2 max-w-[260px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(task.id)
                            setDrawerOpen(true)
                          }}
                          className={`text-left hover:underline ${
                            task.status === 'done' ? 'line-through text-[#6E6E6E]' : 'text-[#E8E8E8]'
                          }`}
                        >
                          {task.title}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`text-[10px] px-1.5 py-0 ${domainColor(domain)}`}>{domain}</Badge>
                      </td>
                      <td className="px-2 py-2 text-[#A8A8A8] whitespace-nowrap">{task.owner}</td>
                      <td className="px-2 py-2">
                        <Badge className={`text-[10px] px-1.5 py-0 ${priorityBadge(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={task.status}
                          onValueChange={(v) => updateTaskStatus(task.id, v as PlanTaskStatus)}
                        >
                          <SelectTrigger
                            className={`h-6 px-2 text-[10px] border ${statusBadge(task.status)} w-[100px]`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">todo</SelectItem>
                            <SelectItem value="in_progress">in progress</SelectItem>
                            <SelectItem value="blocked">blocked</SelectItem>
                            <SelectItem value="done">done</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="text-[#404040] hover:text-red-400 transition-colors"
                          aria-label={`Smazat ${task.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-[10px] text-[#6E6E6E]">
          <span>
            {filteredTasks.length} z {tasks.length} úkolů
          </span>
          {history.length > 0 && (
            <button type="button" onClick={rollback} className="hover:text-[#A8A8A8]">
              ↩ Rollback
            </button>
          )}
        </div>
      </section>

      {/* ── Mission Proposals drawer ── */}
      <Sheet open={proposalsOpen} onOpenChange={setProposalsOpen}>
        <SheetContent side="right" className="w-[480px] max-w-[95vw] overflow-y-auto border-[#1A1A1A]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[#00E085]" /> Plan Manager — Mission Proposals
            </SheetTitle>
            <SheetDescription>
              Logická chronologická analýza úkolů → mise pro CEO. Každá mise = jeden domain package ve správné fázi.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {proposalPackages.length === 0 ? (
              <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 text-sm text-[#A8A8A8] text-center">
                Žádné mise k odeslání. Spusť Plan Manager.
              </div>
            ) : (
              proposalPackages.map((pkg, i) => (
                <div
                  key={pkg.id}
                  className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6E6E6E]">#{i + 1}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${domainColor(pkg.domain)}`}>{pkg.domain}</Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${priorityBadge(pkg.priority)}`}>
                          {pkg.priority}
                        </Badge>
                        <span className="text-[10px] text-[#A8A8A8]">{pkg.phase}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[#E8E8E8]">{pkg.name}</p>
                    </div>
                    <Button
                      onClick={() => sendPackageToCEO(pkg)}
                      disabled={sendingPackageId === pkg.id}
                      size="sm"
                      className="shrink-0 h-7 px-3 text-xs gap-1 bg-[rgba(0,224,133,0.12)] text-[#00E085] border border-[rgba(0,224,133,0.35)] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-50"
                    >
                      {sendingPackageId === pkg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Flag className="h-3 w-3" />
                      )}
                      CEO
                    </Button>
                  </div>
                  <p className="text-xs text-[#A8A8A8]">{pkg.rationale}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[#6E6E6E]">
                    <span>{pkg.taskCount} úkolů</span>
                    <span>urgency: {pkg.urgencyScore}</span>
                    <span>pořadí: #{pkg.chronologicalOrder + 1}</span>
                  </div>
                  <p className="text-[10px] text-[#404040] truncate">
                    IDs: {pkg.taskIds.slice(0, 4).join(', ')}
                    {pkg.taskIds.length > 4 ? ` +${pkg.taskIds.length - 4}` : ''}
                  </p>
                </div>
              ))
            )}
            {proposalPackages.length > 0 && (
              <Button
                onClick={async () => {
                  for (const pkg of [...proposalPackages]) await sendPackageToCEO(pkg)
                }}
                disabled={savingMission || sendingPackageId !== null}
                className="w-full gap-2 bg-[rgba(0,224,133,0.15)] text-[#00E085] border border-[rgba(0,224,133,0.40)] hover:bg-[rgba(0,224,133,0.25)]"
              >
                {savingMission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                Odeslat vše do CEO ({proposalPackages.length})
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Task detail drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[360px] max-w-[95vw] overflow-y-auto border-white/10">
          <SheetHeader>
            <SheetTitle>Task Detail</SheetTitle>
            <SheetDescription>Audit refs, dependency chain, stav.</SheetDescription>
          </SheetHeader>
          {!selectedTask ? (
            <p className="mt-4 text-sm text-[#A8A8A8]">Vyber úkol ze seznamu.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-[#E8E8E8]">
              <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
                <p className="font-semibold text-xs font-mono text-[#A8A8A8]">{selectedTask.id}</p>
                <p className="mt-1 text-[#E8E8E8]">{selectedTask.title}</p>
              </div>
              <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#A8A8A8]">Priority</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${priorityBadge(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A8A8A8]">Status</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${statusBadge(selectedTask.status)}`}>
                    {selectedTask.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A8A8A8]">Domain</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${domainColor(taskDomains.get(selectedTask.id) ?? 'UNKNOWN')}`}>
                    {taskDomains.get(selectedTask.id) ?? 'UNKNOWN'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A8A8A8]">Owner</span>
                  <span className="text-[#D0D0D0]">{selectedTask.owner}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A8A8A8]">Urgency</span>
                  <span className="text-[#D0D0D0]">{selectedTask.urgencyScore}</span>
                </div>
              </div>
              {selectedTask.evidencePath && (
                <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 text-xs">
                  <p className="text-[#A8A8A8] mb-1">Evidence</p>
                  <p className="text-[#A8A8A8] break-all">{selectedTask.evidencePath}</p>
                </div>
              )}
              {selectedTask.blockerChain.length > 1 && (
                <div className="rounded border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 text-xs">
                  <p className="text-[#A8A8A8] mb-1">Blocker chain</p>
                  <p className="text-[#D0D0D0]">{selectedTask.blockerChain.join(' → ')}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={() =>
                    updateTaskStatus(selectedTask.id, selectedTask.status === 'done' ? 'todo' : 'done')
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {selectedTask.status === 'done' ? 'Reopen' : 'Done'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => deleteTask(selectedTask.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Smazat
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
