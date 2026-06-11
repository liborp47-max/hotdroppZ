'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  FilePenLine,
  Grid3X3,
  Layers,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { pipelineSeed } from '@/lib/hd-central/pipeline-seed'
import type { AuditDetail, NoteDetail, PipelineStep } from '@/lib/hd-central/types'
import { useAudits } from './hooks/use-audits'
import { useMainGoal } from './hooks/use-main-goal'
import { useNotes } from './hooks/use-notes'

type ExpandedSections = {
  risks: boolean
  dependencies: boolean
  remediation: boolean
  questions: boolean
}

type SectionTab = 'auditor' | 'mission' | 'elements' | 'tools' | 'notes' | 'detail' | 'pipeline'

type OverviewModule = {
  id: string
  name: string
  purpose: string
  state: 'Stable' | 'In Progress' | 'Risk'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  cta: string
  section: SectionTab
}

type ToolCard = {
  id: string
  name: string
  purpose: string
  owner: string
  state: 'Ready' | 'Live' | 'Watch'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
}

const OVERVIEW_MODULES: OverviewModule[] = [
  { id: 'ceo', name: 'CEO Orchestrator', purpose: 'Finalni rozhodovani, delegace a governance.', state: 'Stable', priority: 'P0', cta: 'Open CEO Console', section: 'detail' },
  { id: 'auditor', name: 'Auditor', purpose: 'Rizika, zavislosti a blocker gate pred strategickymi zmenami.', state: 'Stable', priority: 'P0', cta: 'Open Auditor Queue', section: 'auditor' },
  { id: 'mission', name: 'Primary Mission', purpose: 'Jasna definice cile HDCC a alignment status.', state: 'In Progress', priority: 'P0', cta: 'Open Primary Mission', section: 'mission' },
  { id: 'intel', name: 'Intel Layer', purpose: 'Sber runs/errors/audits/changes/sources s dohledatelnosti.', state: 'In Progress', priority: 'P1', cta: 'Open Intel Feed', section: 'pipeline' },
  { id: 'analytics', name: 'Analytics', purpose: 'Reporty, priority a dopad do planu pro CEO.', state: 'In Progress', priority: 'P1', cta: 'Open Analytics Board', section: 'pipeline' },
]

const TOOL_CARDS: ToolCard[] = [
  { id: 'prompt', name: 'Prompt Agent', purpose: 'Prevod user zadani na quality prompt bez nesmyslu.', owner: 'Global UI', state: 'Live', priority: 'P0' },
  { id: 'brainstorm', name: 'Brainstorming Tool', purpose: 'Generovani variant v kontextu mission + plan.', owner: 'CEO', state: 'Ready', priority: 'P1' },
  { id: 'planning', name: 'Planning Room', purpose: 'Hierarchicky plan s timeline a checkpointy.', owner: 'Planning', state: 'Live', priority: 'P0' },
  { id: 'intel', name: 'Intel Collector', purpose: 'Normalizace a katalog dat napric moduly.', owner: 'Intel', state: 'Watch', priority: 'P1' },
  { id: 'audit', name: 'Audit Gate', purpose: 'GO/HOLD/STOP rozhodovani pred strategickou zmenou.', owner: 'Auditor', state: 'Live', priority: 'P0' },
  { id: 'report', name: 'CEO Report Loop', purpose: 'Analytics -> CEO -> Plan prioritization loop.', owner: 'Analytics', state: 'Ready', priority: 'P1' },
]

function healthStyle(health: PipelineStep['health']): { labelClass: string; dotClass: string } {
  if (health === 'GREEN') {
    return {
      labelClass: 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]',
      dotClass: 'bg-[#1AEE99]',
    }
  }
  if (health === 'AMBER') {
    return {
      labelClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      dotClass: 'bg-amber-300',
    }
  }
  return {
    labelClass: 'border-red-500/30 bg-red-500/10 text-red-300',
    dotClass: 'bg-red-400',
  }
}

function severityBadgeClass(severity: string): string {
  if (severity === 'Critical') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (severity === 'High') return 'border-orange-500/30 bg-orange-500/10 text-orange-300'
  if (severity === 'Medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (severity === 'Low') return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

function statusBadgeClass(status: string): string {
  if (status === 'Resolved') return 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
  if (status === 'Open') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (status === 'In Progress') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (status === 'Blocked') return 'border-orange-500/30 bg-orange-500/10 text-orange-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

function buildPromptFromAudit(audit: AuditDetail | null): string {
  if (!audit) return ''

  const risks = audit.risks.slice(0, 8).map((line) => `- ${line}`).join('\n')
  const remediation = audit.remediation.slice(0, 8).map((line) => `- ${line}`).join('\n')
  const dependencies = audit.dependencies.slice(0, 8).map((line) => `- ${line}`).join('\n')

  return [
    'Jsi SYSTEM AUDITOR execution agent.',
    `Pouzij audit ${audit.id} jako source of truth.`,
    `Nazev: ${audit.title}`,
    `Zavaznost: ${audit.severity}`,
    `Stav: ${audit.status}`,
    '',
    'Rizika:',
    risks || '- N/A',
    '',
    'Zavislosti:',
    dependencies || '- N/A',
    '',
    'Remediation navrhy:',
    remediation || '- N/A',
    '',
    'Vytvor realizacni plan po krocich s prioritou P0->P3, owner role a test-validaci.',
  ].join('\n')
}

function PipelineCard({ step }: { step: PipelineStep }) {
  const [open, setOpen] = useState(false)
  const styles = healthStyle(step.health)

  return (
    <Card className="border-white/10 bg-black/50 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E085] rounded-md"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Toggle pipeline step ${step.name}`}
        >
          <div>
            <CardTitle className="text-[#E8E8E8] text-base">{step.name}</CardTitle>
            <CardDescription className="mt-1 text-[#A8A8A8] text-xs uppercase tracking-wide">
              UCEL KROKU: {step.purpose}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${styles.dotClass}`} aria-hidden="true" />
            <Badge className={styles.labelClass}>{step.health}</Badge>
            {open ? <ChevronDown className="h-4 w-4 text-[#D0D0D0]" /> : <ChevronRight className="h-4 w-4 text-[#D0D0D0]" />}
          </div>
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Princip modulu</p>
              <p className="text-[#E8E8E8] mt-1">{step.principle}</p>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">AI powered</p>
              <p className="text-[#E8E8E8] mt-1">{step.aiPowered ? 'Ano' : 'Ne'}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Input</p>
              <p className="text-[#E8E8E8] mt-1">{step.input}</p>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Output</p>
              <p className="text-[#E8E8E8] mt-1">{step.output}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Pravidla</p>
              <ul className="mt-1 space-y-1 text-[#E8E8E8]">
                {step.rules.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Nastaveni</p>
              <ul className="mt-1 space-y-1 text-[#E8E8E8]">
                {step.settings.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wide">Limity</p>
              <ul className="mt-1 space-y-1 text-[#E8E8E8]">
                {step.limits.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export default function HdCentralClient() {
  const {
    notes,
    loading: notesLoading,
    error: notesError,
    createNote,
    getNote,
    deleteNote,
  } = useNotes()

  const {
    goal,
    loading: goalLoading,
    error: goalError,
    saveGoal,
  } = useMainGoal()

  const {
    filteredAudits,
    selectedAudit,
    loading: auditsLoading,
    detailLoading,
    error: auditsError,
    severityFilter,
    setSeverityFilter,
    dateFilter,
    setDateFilter,
    loadAuditDetail,
  } = useAudits()

  const [titleInput, setTitleInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('SYSTEM AUDITOR')
  const [goalInput, setGoalInput] = useState('')
  const [goalAuthor, setGoalAuthor] = useState('SYSTEM AUDITOR')
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null)
  const [promptOutput, setPromptOutput] = useState('')
  const [activeSection, setActiveSection] = useState<SectionTab>('auditor')
  const [elementsQuery, setElementsQuery] = useState('')
  const [elementsPriority, setElementsPriority] = useState<'all' | 'P0' | 'P1' | 'P2' | 'P3'>('all')
  const [toolQuery, setToolQuery] = useState('')
  const [toolState, setToolState] = useState<'all' | 'Ready' | 'Live' | 'Watch'>('all')
  const [selectedTool, setSelectedTool] = useState<ToolCard | null>(null)
  const [expanded, setExpanded] = useState<ExpandedSections>({
    risks: true,
    dependencies: false,
    remediation: true,
    questions: false,
  })

  useEffect(() => {
    setGoalInput(goal.value)
    setGoalAuthor(goal.author)
  }, [goal.value, goal.author])

  const auditPrompt = useMemo(() => buildPromptFromAudit(selectedAudit), [selectedAudit])
  const overviewCards = useMemo(() => {
    return OVERVIEW_MODULES.filter((item) => {
      const q = elementsQuery.trim().toLowerCase()
      const queryOk = !q || `${item.name} ${item.purpose}`.toLowerCase().includes(q)
      const priorityOk = elementsPriority === 'all' || item.priority === elementsPriority
      return queryOk && priorityOk
    })
  }, [elementsPriority, elementsQuery])

  const toolCards = useMemo(() => {
    const q = toolQuery.trim().toLowerCase()
    return TOOL_CARDS.filter((item) => {
      const queryOk = !q || `${item.name} ${item.purpose} ${item.owner}`.toLowerCase().includes(q)
      const stateOk = toolState === 'all' || item.state === toolState
      return queryOk && stateOk
    })
  }, [toolQuery, toolState])

  const jumpToSection = (section: SectionTab) => {
    setActiveSection(section)
    const target = document.getElementById(`hd-${section}`)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const openNote = async (id: string) => {
    const detail = await getNote(id)
    setActiveNote(detail)
    setNoteDialogOpen(true)
  }

  const handleSaveNote = async () => {
    await createNote({ title: titleInput, content: noteInput, author: noteAuthor })
    setTitleInput('')
    setNoteInput('')
  }

  const handleDeleteFromDialog = async () => {
    if (!activeNote) return
    await deleteNote(activeNote.id)
    setNoteDialogOpen(false)
    setActiveNote(null)
  }

  const handleGeneratePrompt = () => {
    setPromptOutput(auditPrompt)
  }

  const toggleSection = (key: keyof ExpandedSections) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-xl border border-white/15 bg-gradient-to-r from-black/80 via-black/80 to-black p-4 shadow-[0_0_28px_rgba(0,224,133,0.08)] md:p-5">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[#E8E8E8]">HD Central</h1>
        <p className="text-[#A8A8A8] mt-1 text-sm">Centralni ridici panel systemu s auditovatelnosti a pipeline modularitou.</p>
      </div>

      <section
        id="hd-auditor"
        className={`rounded-2xl border border-white/15 bg-gradient-to-br from-black/80 via-black/80 to-black p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_42px_rgba(0,0,0,0.55),0_0_28px_rgba(0,224,133,0.14)] transition-all duration-300 ${activeSection === 'auditor' ? 'ring-1 ring-[#00E085]/45' : ''}`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#1AEE99]/80">Auditor Command Surface</p>
            <h2 className="mt-1 text-lg font-semibold text-[#E8E8E8]">System Integrity Snapshot</h2>
            <p className="mt-1 text-sm text-[#A8A8A8]">Prvni a dominantni sekce: health, integrity, risk a freshness v jednom pohledu.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-green-500/35 bg-green-500/12 text-[#1AEE99]">Health: Stable</Badge>
            <Badge className="border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]">Integrity: 98%</Badge>
            <Badge className="border-amber-500/35 bg-amber-500/12 text-amber-300">Risk: Amber</Badge>
            <Badge className="border-blue-500/35 bg-blue-500/12 text-blue-300">Freshness: 5m</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4" aria-label="Auditor quick status cards">
          {[
            { label: 'Health Matrix', value: '12 checks / 11 pass', action: () => jumpToSection('auditor') },
            { label: 'Integrity Gate', value: 'Schema lock active', action: () => jumpToSection('detail') },
            { label: 'Open Risks', value: `${filteredAudits.filter((a) => a.status !== 'Resolved').length} active`, action: () => jumpToSection('auditor') },
            { label: 'Next Review', value: 'Today 19:30', action: () => jumpToSection('detail') },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.action}
              className="group border border-white/15 bg-white/[0.03] px-3 py-3 text-left transition-all duration-200 hover:border-[#00E085]/50 hover:bg-green-500/[0.05] hover:shadow-[0_0_18px_rgba(0,224,133,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50"
            >
              <p className="text-[11px] uppercase tracking-widest text-[#A8A8A8] group-hover:text-[#E8E8E8]">{chip.label}</p>
              <p className="mt-1 text-sm font-medium text-[#E8E8E8]">{chip.value}</p>
            </button>
          ))}
        </div>
      </section>

      <Tabs value={activeSection} onValueChange={(value) => jumpToSection(value as SectionTab)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 border border-white/15 bg-white/[0.03] backdrop-blur-xl p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(0,224,133,0.12)]">
          <TabsTrigger
            value="auditor"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Auditor
          </TabsTrigger>
          <TabsTrigger
            value="mission"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Primary Mission
          </TabsTrigger>
          <TabsTrigger
            value="elements"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            HD CENTRAL Elements Overview
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Tool Cards
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Notes
          </TabsTrigger>
          <TabsTrigger
            value="detail"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Audit Detail
          </TabsTrigger>
          <TabsTrigger
            value="pipeline"
            className="h-10 border border-transparent px-4 transition-all duration-200 data-[state=active]:border-green-400/40 data-[state=active]:bg-gradient-to-b data-[state=active]:from-black/80 data-[state=active]:to-black data-[state=active]:text-[#E8E8E8] data-[state=active]:shadow-[0_0_18px_rgba(0,224,133,0.28)]"
          >
            Pipeline
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card id="hd-notes" className={`min-h-90 border-white/15 bg-gradient-to-b from-black/80/90 to-black/85 backdrop-blur transition-all duration-200 ${activeSection === 'notes' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-[#E8E8E8] flex items-center gap-2">
              <FilePenLine className="h-4 w-4" /> NOTES
            </CardTitle>
            <CardDescription>Zapisnik s persistenci do hotdroppz/NOTES.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={titleInput}
                onChange={(event) => setTitleInput(event.target.value)}
                placeholder="Titulek poznamky"
                aria-label="Note title"
              />
              <Input
                value={noteAuthor}
                onChange={(event) => setNoteAuthor(event.target.value)}
                placeholder="Autor"
                aria-label="Note author"
              />
            </div>
            <Textarea
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              placeholder="Zapis rozhodnuti, rizika nebo action items..."
              className="min-h-28"
              aria-label="Note content"
            />
            <div className="flex items-center justify-between gap-2">
              <Button onClick={() => void handleSaveNote()} disabled={!noteInput.trim()} aria-label="Save note">
                Save
              </Button>
              {notesLoading ? <span className="text-xs text-[#A8A8A8]">Loading...</span> : null}
              {notesError ? <span className="text-xs text-red-300">{notesError}</span> : null}
            </div>

            <div className="space-y-2 max-h-44 overflow-auto pr-1" aria-label="Notes list">
              {notes.map((note) => (
                <div key={note.id} className="rounded-md border border-white/10 bg-black/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E085] rounded"
                      onClick={() => void openNote(note.id)}
                      aria-label={`Open note ${note.title}`}
                    >
                      <p className="text-sm text-[#E8E8E8] font-medium">{note.title}</p>
                      <p className="text-xs text-[#A8A8A8] mt-0.5">{new Date(note.updatedAt).toLocaleString()}</p>
                      <p className="text-xs text-[#D0D0D0] mt-1">{note.preview}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete note ${note.title}`}
                      onClick={() => void deleteNote(note.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#A8A8A8]" />
                    </Button>
                  </div>
                </div>
              ))}
              {!notesLoading && notes.length === 0 ? (
                <p className="text-sm text-[#A8A8A8]">No notes yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card id="hd-mission" className={`min-h-90 border-white/15 bg-gradient-to-b from-black/80/90 to-black/85 backdrop-blur transition-all duration-200 ${activeSection === 'mission' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-[#E8E8E8] flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> PRIMARY MISSION
            </CardTitle>
            <CardDescription>
              <span className="inline-flex items-center border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-2 py-0.5 text-xs text-[#1AEE99]">
                STRATEGIC SOURCE OF TRUTH
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
              className="min-h-28"
              aria-label="Main goal source of truth"
            />
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-[#A8A8A8]">Mission statement</p>
                <p className="mt-1 text-xs text-[#D0D0D0]">Deliver top-tier content pipeline and command governance with zero strategic drift.</p>
              </div>
              <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-[#A8A8A8]">Success criteria</p>
                <p className="mt-1 text-xs text-[#D0D0D0]">Stable release cadence, blocker decline, and measurable output quality growth.</p>
              </div>
              <div className="rounded-md border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-[#1AEE99]">Alignment status</p>
                <p className="mt-1 text-xs text-green-200">Aligned with plan, watchlist active for schema drift risk.</p>
              </div>
            </div>
            <div className="rounded-md border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-2 text-xs text-green-200">
              Primary Mission urcuje ucel HDCC. Vsechny moduly musi drzet alignment se strategickym smerem.
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={goalAuthor}
                onChange={(event) => setGoalAuthor(event.target.value)}
                placeholder="Author"
                aria-label="Main goal author"
              />
              <div className="rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-[#A8A8A8]">
                Last updated: {new Date(goal.updatedAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button onClick={() => void saveGoal(goalInput, goalAuthor)} disabled={!goalInput.trim()} aria-label="Save main goal">
                Save
              </Button>
              <p className="text-xs text-[#A8A8A8]">Ostatni moduly musi navazovat na tento cil.</p>
            </div>
            {goalLoading ? <p className="text-xs text-[#A8A8A8]">Saving...</p> : null}
            {goalError ? <p className="text-xs text-red-300">{goalError}</p> : null}
          </CardContent>
        </Card>

        <Card id="hd-auditor-list" className={`min-h-105 border-white/15 bg-gradient-to-b from-black/80/90 to-black/85 backdrop-blur transition-all duration-200 ${activeSection === 'auditor' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-[#E8E8E8] flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> SYSTEM AUDITOR
            </CardTitle>
            <CardDescription>Listing auditu s filtrem zavaznosti a data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as typeof severityFilter)}>
                <SelectTrigger aria-label="Filter by severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
                <SelectTrigger aria-label="Filter by date range">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 max-h-72.5 overflow-auto pr-1" aria-label="Audit list">
              {filteredAudits.map((audit) => (
                <button
                  key={audit.id}
                  className="w-full border border-white/10 bg-black/70 p-3 text-left transition-all duration-200 hover:border-[#00E085]/35 hover:bg-black/50 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E085]"
                  onClick={() => void loadAuditDetail(audit.id)}
                  aria-label={`Open audit ${audit.title}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[#E8E8E8] font-medium">{audit.title}</p>
                    <Badge className={severityBadgeClass(audit.severity)}>{audit.severity}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#A8A8A8]">
                    <span>{new Date(audit.date).toLocaleDateString()}</span>
                    <Badge className={statusBadgeClass(audit.status)}>{audit.status}</Badge>
                  </div>
                </button>
              ))}

              {auditsLoading ? <p className="text-sm text-[#A8A8A8]">Loading audits...</p> : null}
              {auditsError ? <p className="text-sm text-red-300">{auditsError}</p> : null}
              {!auditsLoading && filteredAudits.length === 0 ? <p className="text-sm text-[#A8A8A8]">No audits match current filters.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card id="hd-detail" className={`min-h-105 border-white/15 bg-gradient-to-b from-black/80/90 to-black/85 backdrop-blur transition-all duration-200 ${activeSection === 'detail' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
          <CardHeader>
            <CardTitle className="text-[#E8E8E8]">AUDIT DETAIL + GENERATE PROMPT</CardTitle>
            <CardDescription>Expand sekce rizik, zavislosti a remediation navrhu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detailLoading ? <p className="text-sm text-[#A8A8A8]">Loading audit detail...</p> : null}
            {!selectedAudit && !detailLoading ? (
              <p className="text-sm text-[#A8A8A8]">Select an audit from SYSTEM AUDITOR list.</p>
            ) : null}

            {selectedAudit ? (
              <>
                <div className="rounded-md border border-white/10 bg-black/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[#E8E8E8] font-medium">{selectedAudit.title}</h3>
                    <Badge className={severityBadgeClass(selectedAudit.severity)}>{selectedAudit.severity}</Badge>
                  </div>
                  <p className="text-xs text-[#A8A8A8] mt-1">{selectedAudit.id}</p>
                </div>

                {([
                  ['risks', 'Rizika', selectedAudit.risks],
                  ['dependencies', 'Zavislosti', selectedAudit.dependencies],
                  ['remediation', 'Remediation navrhy', selectedAudit.remediation],
                  ['questions', 'Otevrene otazky', selectedAudit.openQuestions],
                ] as const).map(([key, label, lines]) => (
                  <div key={key} className="rounded-md border border-white/10 bg-black/70">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-150 hover:bg-black/50 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E085]"
                      onClick={() => toggleSection(key)}
                      aria-expanded={expanded[key]}
                      aria-label={`Toggle section ${label}`}
                    >
                      <span className="text-sm text-[#E8E8E8]">{label}</span>
                      {expanded[key] ? <ChevronDown className="h-4 w-4 text-[#A8A8A8]" /> : <ChevronRight className="h-4 w-4 text-[#A8A8A8]" />}
                    </button>
                    {expanded[key] ? (
                      <ul className="px-3 pb-3 text-xs text-[#D0D0D0] space-y-1">
                        {lines.length > 0 ? lines.map((line) => <li key={line}>- {line}</li>) : <li>- No data</li>}
                      </ul>
                    ) : null}
                  </div>
                ))}

                <div className="space-y-2">
                  <Button onClick={handleGeneratePrompt} aria-label="Generate prompt from selected audit">
                    GENERATE PROMPT
                  </Button>
                  <Textarea
                    value={promptOutput}
                    onChange={(event) => setPromptOutput(event.target.value)}
                    placeholder="Generated prompt will appear here..."
                    className="min-h-28"
                    aria-label="Generated prompt"
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="hd-elements" className={`rounded-xl border border-white/15 bg-gradient-to-b from-black/80/95 to-black/90 p-4 transition-all duration-200 ${activeSection === 'elements' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#1AEE99]" />
            <h2 className="text-lg font-semibold text-[#E8E8E8]">HD CENTRAL Elements Overview</h2>
          </div>
          <Badge className="border-white/15 bg-white/[0.05] text-[#D0D0D0]">Priority first</Badge>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#A8A8A8]" />
            <Input
              value={elementsQuery}
              onChange={(event) => setElementsQuery(event.target.value)}
              placeholder="Search module name or purpose"
              className="pl-8"
              aria-label="Search HD Central modules"
            />
          </div>
          <Select value={elementsPriority} onValueChange={(value) => setElementsPriority(value as typeof elementsPriority)}>
            <SelectTrigger aria-label="Filter modules by priority">
              <div className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" />Priority</div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="P0">P0</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
              <SelectItem value="P3">P3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpToSection(item.section)}
              className="group border border-white/10 bg-black/70 p-3 text-left transition-all duration-200 hover:border-[#00E085]/50 hover:shadow-[0_0_20px_rgba(0,224,133,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#E8E8E8]">{item.name}</p>
                <Badge className="border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]">{item.priority}</Badge>
              </div>
              <p className="mt-2 text-xs text-[#A8A8A8]">{item.purpose}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#A8A8A8]">State: <span className="text-[#D0D0D0]">{item.state}</span></span>
                <span className="text-[#1AEE99]">{item.cta}</span>
              </div>
            </button>
          ))}
          {overviewCards.length === 0 ? <p className="text-sm text-[#A8A8A8]">No module matches current filters.</p> : null}
        </div>
      </section>

      <section id="hd-tools" className={`rounded-xl border border-white/15 bg-gradient-to-b from-black/80/95 to-black/90 p-4 transition-all duration-200 ${activeSection === 'tools' ? 'ring-1 ring-green-400/35 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-[#1AEE99]" />
          <h2 className="text-lg font-semibold text-[#E8E8E8]">Tool Cards</h2>
        </div>

        <div className="mt-1 text-xs text-[#A8A8A8]" aria-live="polite">
          Breadcrumb: HD CENTRAL / Tool Cards{selectedTool ? ` / ${selectedTool.name}` : ''}
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#A8A8A8]" />
            <Input
              value={toolQuery}
              onChange={(event) => setToolQuery(event.target.value)}
              placeholder="Search tools"
              className="pl-8"
              aria-label="Search tool cards"
            />
          </div>
          <Select value={toolState} onValueChange={(value) => setToolState(value as typeof toolState)}>
            <SelectTrigger aria-label="Filter tools by state">
              <div className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" />State</div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="Ready">Ready</SelectItem>
              <SelectItem value="Live">Live</SelectItem>
              <SelectItem value="Watch">Watch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {toolCards.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTool(item)}
              className="group border border-white/10 bg-black/70 p-3 text-left transition-all duration-200 hover:border-[#00E085]/50 hover:bg-green-500/[0.05] hover:shadow-[0_0_18px_rgba(0,224,133,0.2)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#E8E8E8]">{item.name}</p>
                <Badge className="border-white/15 bg-white/[0.05] text-[#D0D0D0]">{item.priority}</Badge>
              </div>
              <p className="mt-2 text-xs text-[#A8A8A8]">{item.purpose}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#A8A8A8]">Owner: <span className="text-[#D0D0D0]">{item.owner}</span></span>
                <span className="text-[#1AEE99]">Open detail</span>
              </div>
            </button>
          ))}
        </div>

        {selectedTool ? (
          <div className="mt-4 border border-green-500/35 bg-green-500/[0.05] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#1AEE99]" />
                <h3 className="text-sm font-semibold text-[#E8E8E8]">{selectedTool.name} detail</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedTool(null)} aria-label="Back to tool cards">
                <ArrowLeft className="h-4 w-4" /> Back to cards
              </Button>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-[#D0D0D0] md:grid-cols-2">
              <p><span className="text-[#A8A8A8]">Purpose:</span> {selectedTool.purpose}</p>
              <p><span className="text-[#A8A8A8]">State:</span> {selectedTool.state}</p>
              <p><span className="text-[#A8A8A8]">Priority:</span> {selectedTool.priority}</p>
              <p><span className="text-[#A8A8A8]">Owner:</span> {selectedTool.owner}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section id="hd-pipeline" className={`space-y-3 transition-all duration-200 ${activeSection === 'pipeline' ? 'ring-1 ring-green-400/35 p-2 shadow-[0_0_20px_rgba(0,224,133,0.14)]' : ''}`}>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#E8E8E8]">Pipeline Cards</h2>
          <Badge className="border-white/15 bg-white/[0.05] text-[#D0D0D0]">Expandable</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {pipelineSeed.map((step) => (
            <PipelineCard key={step.id} step={step} />
          ))}
        </div>
      </section>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeNote?.title ?? 'Note detail'}</DialogTitle>
            <DialogDescription>
              {activeNote ? `Updated ${new Date(activeNote.updatedAt).toLocaleString()}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={activeNote?.content ?? ''} readOnly className="min-h-64" aria-label="Active note content" />
          <DialogFooter>
            <Button variant="destructive" onClick={() => void handleDeleteFromDialog()} aria-label="Delete note from dialog">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-xs text-[#A8A8A8] flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#1AEE99]" />
        HD Central je navrzene jako desktop-first ovladaci panel a zustava plne responzivni pro mobil.
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-xs text-[#A8A8A8] flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-300" />
        R4C aktivni: governance gate matrix nebyla zavedena, riziko je vedome akceptovane.
      </div>
    </div>
  )
}
