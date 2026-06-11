'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUp,
  Brain,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type {
  BrainstormingAnalysis,
  BrainstormingPoint,
  BrainstormingPrompt,
  ImprovementDashboardPayload,
  ImprovementProposal,
  ImprovementStatus,
} from '@/lib/improvement-system/types'

const statusLabels: Record<ImprovementStatus, string> = {
  open: 'Open',
  selected: 'Selected',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
}

const targetModes = [
  'create a new feature',
  'modify an existing feature',
  'solve a concrete problem',
  'improve current system behavior',
  'create a new global agent',
  'create a new tool',
]

function statusClass(status: ImprovementStatus) {
  switch (status) {
    case 'selected':
      return 'border-[#00E085]/45 bg-[rgba(0,224,133,0.10)] text-[#00E085]'
    case 'in_progress':
      return 'border-[#FFB84D]/35 bg-[rgba(255,184,77,0.08)] text-[#FFB84D]'
    case 'done':
      return 'border-[#00E085]/50 bg-[rgba(0,224,133,0.14)] text-[#1AEE99]'
    case 'archived':
      return 'border-white/8 bg-white/[0.02] text-[#404040]'
    case 'open':
    default:
      return 'border-white/10 bg-white/[0.04] text-[#A8A8A8]'
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function DataList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-white/[0.06] bg-white/[0.02] p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#00E085]">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-xs leading-relaxed text-[#A8A8A8]">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function findLinkedPrompt(prompts: BrainstormingPrompt[], itemId: string) {
  return prompts.find((prompt) => prompt.brainstormingItemId === itemId) ?? null
}

function selectedPointCount(points: Set<string>) {
  return Array.from(points).length
}

export function BrainstormingWorkbench() {
  const [dashboard, setDashboard] = useState<ImprovementDashboardPayload | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeAnalysis, setActiveAnalysis] = useState<BrainstormingAnalysis | null>(null)
  const [activePrompt, setActivePrompt] = useState<BrainstormingPrompt | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [targetMode, setTargetMode] = useState(targetModes[0])
  const [newIdea, setNewIdea] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/improvement-system/improvements', { cache: 'no-store' })
      if (!response.ok) throw new Error(await response.text())
      const payload = (await response.json()) as ImprovementDashboardPayload
      setDashboard(payload)
      setSelectedId((prev) => prev ?? payload.items[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brainstorming')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const selectedItem = useMemo(() => {
    if (!dashboard) return null
    return dashboard.items.find((item) => item.id === selectedId) ?? dashboard.items[0] ?? null
  }, [dashboard, selectedId])

  const promptMap = useMemo(() => {
    const map = new Map<string, BrainstormingPrompt>()
    for (const prompt of dashboard?.prompts ?? []) {
      map.set(prompt.brainstormingItemId, prompt)
    }
    return map
  }, [dashboard?.prompts])

  async function createManualIdea() {
    if (!newIdea.trim()) return
    setBusyId('manual')
    setError(null)

    try {
      const response = await fetch('/api/improvement-system/improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIdea.trim(),
          sourceSection: 'CEO / Brainstorming',
          route: '/hd-central/ceo/brainstorming',
          snapshot: 'Manual CEO brainstorming idea',
          createdFrom: 'manual',
        }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as { proposal: ImprovementProposal; dashboard: ImprovementDashboardPayload }
      setDashboard(data.dashboard)
      setSelectedId(data.proposal.id)
      setNewIdea('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create idea')
    } finally {
      setBusyId(null)
    }
  }

  async function updateStatus(itemId: string, status: ImprovementStatus) {
    setBusyId(itemId)
    setError(null)

    try {
      const response = await fetch('/api/improvement-system/improvements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as { dashboard: ImprovementDashboardPayload }
      setDashboard(data.dashboard)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  async function runBrainstormingAgent(itemId: string) {
    setBusyId(itemId)
    setError(null)

    try {
      const response = await fetch('/api/improvement-system/brainstorming/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as {
        analysis: BrainstormingAnalysis
        dashboard: ImprovementDashboardPayload
      }
      const recommended = data.analysis.categories
        .flatMap((category) => category.points)
        .filter((point) => point.recommended)
        .map((point) => point.id)

      setDashboard(data.dashboard)
      setSelectedId(itemId)
      setActiveAnalysis(data.analysis)
      setCheckedIds(new Set(recommended))
      setAnalysisOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze idea')
    } finally {
      setBusyId(null)
    }
  }

  async function createPrompt() {
    if (!activeAnalysis) return
    const selectedPointIds = Array.from(checkedIds)
    if (selectedPointIds.length === 0) {
      setError('Select at least one brainstorming point')
      return
    }

    setBusyId(activeAnalysis.brainstormingItemId)
    setError(null)

    try {
      const response = await fetch('/api/improvement-system/brainstorming/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: activeAnalysis.brainstormingItemId,
          selectedPointIds,
          targetMode,
        }),
      })

      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as {
        prompt: BrainstormingPrompt
        dashboard: ImprovementDashboardPayload
      }

      setDashboard(data.dashboard)
      setActivePrompt(data.prompt)
      setAnalysisOpen(false)
      setPromptOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prompt')
    } finally {
      setBusyId(null)
    }
  }

  async function copyPrompt(prompt: BrainstormingPrompt | null) {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt.generatedPrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function togglePoint(point: BrainstormingPoint, checked: boolean | 'indeterminate') {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked === true) next.add(point.id)
      else next.delete(point.id)
      return next
    })
  }

  const items = dashboard?.items ?? []
  const prompts = dashboard?.prompts ?? []
  const linkedPrompt = selectedItem ? findLinkedPrompt(prompts, selectedItem.id) : null

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[#1A1A1A] px-6 py-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#5C9A72]">
          <Sparkles className="h-3 w-3" />
          <span>CEO / Brainstorming</span>
        </div>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#E8E8E8]">IMPROOVMENT SYSTEM</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#A8A8A8]">
              Globalni zlepsovani sekci, agentu a procesu. Sipka vytvari navrh, mozek ho rozlozi na body a P otevre finalni prompt.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className="border-[#00E085]/35 bg-[rgba(0,224,133,0.08)] text-[#00E085]">
              {items.length} ideas
            </Badge>
            <Badge className="border-white/10 bg-white/[0.04] text-[#A8A8A8]">
              {prompts.length} prompts
            </Badge>
            <Button variant="outline" size="sm" onClick={loadDashboard} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,0.85fr)_minmax(420px,1.15fr)] gap-4 p-4">
        <section className="flex min-h-0 flex-col border border-white/[0.06] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] p-3">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-[#00E085]" />
              <h2 className="text-sm font-bold text-[#E8E8E8]">Improvement listing</h2>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                INTEL / brainstorming
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Textarea
                value={newIdea}
                onChange={(event) => setNewIdea(event.target.value)}
                placeholder="Pridej vlastni napad nebo problem pro Brainstorming Agenta..."
                className="min-h-16"
              />
              <Button
                size="icon"
                onClick={createManualIdea}
                disabled={busyId === 'manual' || !newIdea.trim()}
                aria-label="Create brainstorming idea"
              >
                {busyId === 'manual' ? <Loader2 className="animate-spin" /> : <Plus />}
              </Button>
            </div>
          </div>

          {error && (
            <div className="border-b border-[#FF5A5A]/20 bg-[rgba(255,90,90,0.05)] px-3 py-2 text-xs text-[#FF8C8C]">
              {error}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-xs text-[#6E6E6E]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#00E085]" />
                Loading improvement memory...
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center border border-dashed border-white/[0.08] p-6 text-center">
                <Brain className="h-7 w-7 text-[#00E085]" />
                <h3 className="mt-3 text-sm font-semibold text-[#E8E8E8]">No ideas yet</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#A8A8A8]">
                  Klikni na sipku v leve horni casti libovolne sekce, nebo pridej manualni napad tady.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const prompt = promptMap.get(item.id)
                  const active = selectedItem?.id === item.id
                  return (
                    <article
                      key={item.id}
                      className={[
                        'cursor-pointer border p-3 transition',
                        active
                          ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.06)]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
                      ].join(' ')}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={statusClass(item.status)}>{statusLabels[item.status]}</Badge>
                            <span className="font-mono text-[10px] text-[#6E6E6E]">{item.priority}</span>
                            <span className="font-mono text-[10px] text-[#404040]">{formatDate(item.createdAt)}</span>
                          </div>
                          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[#E8E8E8]">
                            {item.title}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-xs text-[#6E6E6E]">{item.sourceSection}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void runBrainstormingAgent(item.id)
                            }}
                            className="flex h-8 w-8 items-center justify-center border border-white/[0.10] bg-black/30 text-[#A8A8A8] hover:border-[#00E085]/45 hover:text-[#00E085]"
                            title="Run BRAINSTORMING AGENT"
                            aria-label="Run BRAINSTORMING AGENT"
                          >
                            {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                          </button>
                          {prompt && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setActivePrompt(prompt)
                                setPromptOpen(true)
                              }}
                              className="flex h-8 w-8 items-center justify-center border border-[#00E085]/35 bg-[rgba(0,224,133,0.08)] font-mono text-xs font-bold text-[#00E085] hover:border-[#00E085]/70"
                              title="Open linked prompt"
                              aria-label="Open linked prompt"
                            >
                              P
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto border border-white/[0.06] bg-white/[0.02]">
          {selectedItem ? (
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-3 border-b border-white/[0.06] pb-4">
                <div className="flex h-10 w-10 items-center justify-center border border-[#00E085]/35 bg-[rgba(0,224,133,0.08)]">
                  <Sparkles className="h-5 w-5 text-[#00E085]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={statusClass(selectedItem.status)}>{statusLabels[selectedItem.status]}</Badge>
                    <span className="font-mono text-[10px] text-[#6E6E6E]">{selectedItem.id}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-bold leading-tight text-[#E8E8E8]">{selectedItem.title}</h2>
                  <p className="mt-1 text-sm text-[#A8A8A8]">{selectedItem.sourceSection}</p>
                </div>
                <div className="w-44">
                  <Select
                    value={selectedItem.status}
                    onValueChange={(value) => void updateStatus(selectedItem.id, value as ImprovementStatus)}
                    disabled={busyId === selectedItem.id}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void runBrainstormingAgent(selectedItem.id)} disabled={busyId === selectedItem.id}>
                  {busyId === selectedItem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Analyze
                </Button>
                {linkedPrompt && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActivePrompt(linkedPrompt)
                        setPromptOpen(true)
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Open prompt
                    </Button>
                    <Button variant="ghost" onClick={() => void copyPrompt(linkedPrompt)}>
                      <Copy className="h-4 w-4" />
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DataList title="Current state" items={selectedItem.currentState} />
                <DataList title="Detected problems" items={selectedItem.detectedProblems} />
                <DataList title="Improvement ideas" items={selectedItem.improvementIdeas} />
                <DataList title="Expected impact" items={selectedItem.expectedImpact} />
                <DataList title="Required tools" items={selectedItem.requiredTools} />
                <DataList title="Suggested agents" items={selectedItem.suggestedAgents} />
              </div>

              <DataList title="Implementation steps" items={selectedItem.implementationSteps} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <Clipboard className="mx-auto h-8 w-8 text-[#00E085]" />
                <h2 className="mt-3 text-sm font-bold text-[#E8E8E8]">Select an idea</h2>
                <p className="mt-1 text-xs text-[#A8A8A8]">Detail, status and prompt actions will appear here.</p>
              </div>
            </div>
          )}
        </section>
      </main>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              BRAINSTORMING AGENT
            </DialogTitle>
            <DialogDescription>
              Vyber body, ktere maji prejit do finalniho promptu. Vyber se ulozi do INTEL / brainstorming.
            </DialogDescription>
          </DialogHeader>

          {activeAnalysis && (
            <div className="min-h-0 overflow-hidden">
              <div className="mb-3 border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E6E]">
                  Source idea
                </div>
                <div className="mt-1 text-sm font-semibold text-[#E8E8E8]">{activeAnalysis.sourceIdea}</div>
              </div>

              <div className="mb-3 grid grid-cols-[1fr_240px] gap-3">
                <Select value={targetMode} onValueChange={setTargetMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-center border border-white/[0.06] bg-white/[0.02] text-xs text-[#A8A8A8]">
                  {selectedPointCount(checkedIds)} selected
                </div>
              </div>

              <Tabs defaultValue={activeAnalysis.categories[0]?.id ?? 'goals'} className="min-h-0">
                <TabsList className="w-full justify-start">
                  {activeAnalysis.categories.map((category) => (
                    <TabsTrigger key={category.id} value={category.id}>
                      {category.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="max-h-[42vh] overflow-y-auto border border-white/[0.06] border-t-0 bg-white/[0.015] p-3">
                  {activeAnalysis.categories.map((category) => (
                    <TabsContent key={category.id} value={category.id} className="mt-0">
                      <div className="grid gap-2">
                        {category.points.map((point) => (
                          <label
                            key={point.id}
                            className="flex cursor-pointer items-start gap-3 border border-white/[0.06] bg-black/25 p-3 hover:border-[#00E085]/35"
                          >
                            <Checkbox
                              checked={checkedIds.has(point.id)}
                              onCheckedChange={(checked) => togglePoint(point, checked)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#E8E8E8]">{point.label}</span>
                                <span className="font-mono text-[10px] text-[#00E085]">{point.impact}</span>
                                {point.recommended && (
                                  <span className="border border-[#00E085]/25 bg-[rgba(0,224,133,0.06)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[#00E085]">
                                    recommended
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block text-xs leading-relaxed text-[#A8A8A8]">{point.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisOpen(false)}>
              Close
            </Button>
            <Button onClick={createPrompt} disabled={!activeAnalysis || busyId === activeAnalysis.brainstormingItemId}>
              {activeAnalysis && busyId === activeAnalysis.brainstormingItemId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Generate prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Linked prompt
            </DialogTitle>
            <DialogDescription>
              Prompt je ulozeny v INTEL / brainstorming / prompts a je propojeny s puvodni polozkou.
            </DialogDescription>
          </DialogHeader>

          {activePrompt && (
            <div className="min-h-0 overflow-hidden">
              <div className="mb-3 flex items-center gap-2 border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E6E]">
                    {activePrompt.id}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#E8E8E8]">{activePrompt.sourceIdea}</div>
                </div>
                <Button variant="outline" onClick={() => void copyPrompt(activePrompt)}>
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="max-h-[52vh] overflow-y-auto whitespace-pre-wrap border border-white/[0.06] bg-black/40 p-4 text-xs leading-relaxed text-[#D0D0D0]">
                {activePrompt.generatedPrompt}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
