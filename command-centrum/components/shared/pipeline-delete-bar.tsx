'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Bomb, ChevronDown, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'
import {
  deleteScoutItems,
  deleteCuratedItems,
  deleteInboxItems,
  deleteClusters,
  deleteWriterPosts,
  deleteEnrichmentClusters,
  deleteFinalEditorPosts,
  deleteFeedPosts,
  deleteMultilangData,
  deleteMonetizerData,
  deleteAllPipelineData,
  type DeleteFilters,
} from '@/lib/actions/pipeline-delete'

const CATEGORIES = [
  'droppz_news', 'rap_core', 'deep_scout', 'drama',
  'fashion', 'culture', 'global_news', 'science',
]

const DATE_PRESETS = [
  { label: 'All time',    value: '' },
  { label: '> 1 hour',   value: () => subHours(1) },
  { label: '> 6 hours',  value: () => subHours(6) },
  { label: '> 1 day',    value: () => subDays(1) },
  { label: '> 3 days',   value: () => subDays(3) },
  { label: '> 7 days',   value: () => subDays(7) },
  { label: '> 30 days',  value: () => subDays(30) },
]

const SCORE_PRESETS = [
  { label: 'Any score',  min: undefined, max: undefined },
  { label: 'Score < 30', min: undefined, max: 30 },
  { label: 'Score < 50', min: undefined, max: 50 },
  { label: 'Score > 50', min: 50,        max: undefined },
  { label: 'Score > 70', min: 70,        max: undefined },
]

function subHours(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString()
}
function subDays(d: number) {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

export type DeleteBarMode =
  | 'scout'
  | 'light-curation'
  | 'curated'
  | 'inbox'
  | 'clusters'
  | 'writer'
  | 'feed'
  | 'multilang'
  | 'monetizer'
  | 'enrichment'
  | 'final-editor'

interface PipelineDeleteBarProps {
  mode: DeleteBarMode
  sources?: string[]
  languages?: string[]
  totalCount?: number
}

export function PipelineDeleteBar({ mode, sources = [], languages = [], totalCount }: PipelineDeleteBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [category, setCategory] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [scorePreset, setScorePreset] = useState(0)
  const [source, setSource] = useState('')
  const [language, setLanguage] = useState('')
  const [enrichStatus, setEnrichStatus] = useState('')

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [nukeOpen, setNukeOpen] = useState(false)
  const [nukeChecked, setNukeChecked] = useState(false)
  const [nukeResult, setNukeResult] = useState<Record<string, number> | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const buildFilters = (): DeleteFilters => {
    const preset = DATE_PRESETS.find(p => p.label === datePreset)
    const before = preset && typeof preset.value === 'function' ? preset.value() : undefined
    const score = SCORE_PRESETS[scorePreset]
    return {
      category: category || undefined,
      before,
      minScore: score.min,
      maxScore: score.max,
      language: language || undefined,
      source: source || undefined,
      enrichment_status: enrichStatus || undefined,
    }
  }

  const actionMap: Record<DeleteBarMode, (f: DeleteFilters) => Promise<{ deleted: number; error: string | null }>> = {
    'scout':           deleteScoutItems,
    'light-curation':  deleteScoutItems,
    'curated':         deleteCuratedItems,
    'inbox':           deleteInboxItems,
    'clusters':        deleteClusters,
    'writer':          deleteWriterPosts,
    'feed':            deleteFeedPosts,
    'multilang':       deleteMultilangData,
    'monetizer':       deleteMonetizerData,
    'enrichment':      deleteEnrichmentClusters,
    'final-editor':    deleteFinalEditorPosts,
  }

  const handleDelete = () => {
    const filters = buildFilters()
    const hasFilter = filters.category || filters.before || filters.minScore !== undefined
      || filters.maxScore !== undefined || filters.language || filters.source || filters.enrichment_status
    if (!hasFilter) {
      setConfirmOpen(true)
      return
    }
    runDelete(filters)
  }

  const runDelete = (filters: DeleteFilters) => {
    startTransition(async () => {
      const action = actionMap[mode]
      const result = await action(filters)
      if (result.error) {
        showToast(`Error: ${result.error}`, 'error')
      } else {
        showToast(`Deleted ${result.deleted} item${result.deleted !== 1 ? 's' : ''}`, 'success')
        router.refresh()
      }
      setConfirmOpen(false)
    })
  }

  const handleNuke = () => {
    startTransition(async () => {
      const result = await deleteAllPipelineData()
      if (result.error) {
        showToast(`Error: ${result.error}`, 'error')
      } else {
        setNukeResult(result.summary)
        router.refresh()
      }
      setNukeOpen(false)
      setNukeChecked(false)
    })
  }

  const showScore = mode === 'curated' || mode === 'writer' || mode === 'final-editor'
  const showLanguage = mode === 'inbox'
  const showSource = mode === 'scout' || mode === 'inbox'
  const showEnrichStatus = mode === 'enrichment'
  const showDate = mode !== 'enrichment'

  return (
    <>
      {/* Bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border border-white/10 bg-white/[0.025]">
        {/* Category */}
        <FilterSelect
          value={category}
          onChange={setCategory}
          placeholder="All categories"
          options={CATEGORIES.map(c => ({ label: c.replace(/_/g, ' '), value: c }))}
        />

        {/* Date */}
        {showDate && (
          <FilterSelect
            value={datePreset}
            onChange={setDatePreset}
            placeholder="All time"
            options={DATE_PRESETS.slice(1).map(p => ({ label: p.label, value: p.label }))}
          />
        )}

        {/* Score */}
        {showScore && (
          <FilterSelect
            value={String(scorePreset)}
            onChange={v => setScorePreset(Number(v))}
            placeholder="Any score"
            options={SCORE_PRESETS.map((p, i) => ({ label: p.label, value: String(i) }))}
          />
        )}

        {/* Language (inbox) */}
        {showLanguage && languages.length > 0 && (
          <FilterSelect
            value={language}
            onChange={setLanguage}
            placeholder="All languages"
            options={languages.map(l => ({ label: l, value: l }))}
          />
        )}

        {/* Source (scout/inbox) */}
        {showSource && sources.length > 0 && (
          <FilterSelect
            value={source}
            onChange={setSource}
            placeholder="All sources"
            options={sources.map(s => ({ label: s, value: s }))}
          />
        )}

        {/* Enrichment status */}
        {showEnrichStatus && (
          <FilterSelect
            value={enrichStatus}
            onChange={setEnrichStatus}
            placeholder="All statuses"
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Done',    value: 'done' },
              { label: 'Error',   value: 'error' },
            ]}
          />
        )}

        <div className="flex-1" />

        {/* Delete matching */}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete matching
          {totalCount !== undefined && <span className="text-red-500/60">({totalCount})</span>}
        </button>

        {/* Nuke pipeline (all data) */}
        <button
          onClick={() => { setNukeOpen(true); setNukeChecked(false); setNukeResult(null) }}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-500/40 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
          title="Nuke pipeline"
        >
          <Bomb className="h-3.5 w-3.5" />
          NUKE
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 border text-sm font-medium shadow-xl',
          toast.type === 'success'
            ? 'bg-white/[0.03] backdrop-blur-md border-[#00E085]/35 text-[#00E085]'
            : 'bg-white/[0.03] backdrop-blur-md border-red-500/30 text-red-400'
        )}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="h-3.5 w-3.5 opacity-60" /></button>
        </div>
      )}

      {/* Confirm delete (no filters) */}
      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#E8E8E8]">Delete all items?</p>
              <p className="text-xs text-[#A8A8A8] mt-1">No filters applied — this will delete every item on this stage.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmOpen(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors">Cancel</button>
            <button
              onClick={() => runDelete(buildFilters())}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete all
            </button>
          </div>
        </Modal>
      )}

      {/* Nuke modal */}
      {nukeOpen && !nukeResult && (
        <Modal onClose={() => setNukeOpen(false)}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-venom-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#E8E8E8]">Delete all pipeline data</p>
              <p className="text-xs text-[#A8A8A8] mt-1">This will permanently delete:</p>
            </div>
          </div>
          <ul className="text-xs text-[#A8A8A8] space-y-1 mb-4 border border-white/10 px-3 py-2.5 bg-black">
            {[
              'All scout_items (every scouted article)',
              'All CURATED scout_items (curation scores)',
              'All story_clusters + cluster sources',
              'All posts: draft, approved, rejected, hold',
              'All feed_posts',
            ].map(item => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-red-500">·</span> {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#6E6E6E] mb-3">Published posts and scout sources are kept.</p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={nukeChecked}
              onChange={e => setNukeChecked(e.target.checked)}
              className="rounded border-white/15 bg-white/[0.05]"
            />
            <span className="text-xs text-[#D0D0D0]">I understand this cannot be undone</span>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setNukeOpen(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors">Cancel</button>
            <button
              onClick={handleNuke}
              disabled={!nukeChecked || isPending}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              Nuke everything
            </button>
          </div>
        </Modal>
      )}

      {/* Nuke result */}
      {nukeResult && (
        <Modal onClose={() => setNukeResult(null)}>
          <p className="text-sm font-semibold text-[#00E085] mb-3">Pipeline data cleared</p>
          <ul className="text-xs text-[#A8A8A8] space-y-1">
            {Object.entries(nukeResult).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-[#A8A8A8]">{k.replace(/_/g, ' ')}</span>
                <span className="tabular-nums font-medium text-[#D0D0D0]">{v} deleted</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end mt-4">
            <button onClick={() => setNukeResult(null)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors">Close</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { label: string; value: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pr-6 pl-2.5 py-1.5 border border-white/15 bg-white/[0.05] text-xs text-[#D0D0D0] focus:outline-none focus:border-white/15 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6E6E6E] pointer-events-none" />
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock. Modal is only mounted
  // while open, so the hook's `open` arg is always true here.
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Dialog"
        tabIndex={-1}
        className="bg-white/[0.03] backdrop-blur-md border border-white/15 rounded-2xl p-5 w-full max-w-sm shadow-2xl outline-none"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
