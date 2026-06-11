'use client'

import { useState, useMemo } from 'react'
import {
  PenLine, Loader2, Save, X, Wand2, Languages, CheckCircle2,
  Search, ImageIcon, FileText, AlignLeft, Globe2, Hash,
  ExternalLink, Layers, Rocket, Clock, Sparkles,
} from 'lucide-react'
import { approvePost, updatePostFields } from '@/lib/actions/posts'
import { ScoreMeter } from '@/components/shared/score-meter'
import { CategoryTag } from '@/components/shared/category-tag'
import { CategoryFilter } from '@/components/shared/category-filter'
import { Pagination } from '@/components/shared/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { timeAgo, cn } from '@/lib/utils'
import type { Post } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WriterClientProps {
  initialPosts: Post[]
  activeCategory?: string
  page: number
  totalPages: number
  totalCount: number
  searchParams: Record<string, string>
}

interface EditState {
  title: string
  shortText: string
  body: string
}

const LANG_TABS = [
  { id: 'cs', label: 'CS', flag: '🇨🇿', name: 'Czech' },
  { id: 'de', label: 'DE', flag: '🇩🇪', name: 'German' },
  { id: 'fr', label: 'FR', flag: '🇫🇷', name: 'French' },
  { id: 'es', label: 'ES', flag: '🇪🇸', name: 'Spanish' },
  { id: 'pl', label: 'PL', flag: '🇵🇱', name: 'Polish' },
  { id: 'it', label: 'IT', flag: '🇮🇹', name: 'Italian' },
  { id: 'nl', label: 'NL', flag: '🇳🇱', name: 'Dutch' },
  { id: 'ru', label: 'RU', flag: '🇷🇺', name: 'Russian' },
] as const

type LangCode = (typeof LANG_TABS)[number]['id']
type ActiveTab = 'overview' | 'article' | 'translations' | 'structure'

type LocalizedEntry = { title?: string; summary?: string; short_text?: string; body?: string }

const CATEGORY_COLORS: Record<string, string> = {
  droppz:     'bg-orange-500',
  usa_rap:    'bg-blue-500',
  uk_rap:     'bg-purple-500',
  eu_rap:     'bg-indigo-500',
  ru_rap:     'bg-red-500',
  balkan_rap: 'bg-amber-500',
  rnb:        'bg-pink-500',
  fashion:    'bg-fuchsia-500',
  culture:    'bg-teal-500',
  fun:        'bg-yellow-500',
  news:       'bg-white/[0.12]',
}

function getLocalized(post: Post, lang: string): LocalizedEntry | null {
  const lv = post.localized_versions as Record<string, unknown> | null
  if (!lv) return null
  const entry = lv[lang]
  if (!entry) return null
  if (typeof entry === 'string') return { body: entry }
  return entry as LocalizedEntry
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ─── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'approved'     ? 'bg-[#1AEE99]' :
    status === 'needs_review' ? 'bg-amber-400' :
    status === 'published'    ? 'bg-blue-400' : 'bg-white/[0.10]'
  return <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
}

// ─── Post list card ──────────────────────────────────────────────────────────

function PostCard({
  post,
  selected,
  onClick,
}: {
  post: Post
  selected: boolean
  onClick: () => void
}) {
  const catColor = CATEGORY_COLORS[post.category ?? ''] ?? 'bg-white/[0.08]'
  const hasGraphic = !!(post as any).graphic_url
  const langCount = Object.keys(post.localized_versions ?? {}).length

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex gap-0 border-b border-white/[0.06] transition-all relative group',
        selected
          ? 'bg-white/[0.05]'
          : 'hover:bg-white/[0.03] backdrop-blur-md'
      )}
    >
      {/* Category color strip */}
      <div className={cn('w-0.5 shrink-0 self-stretch transition-all', selected ? catColor : 'bg-transparent group-hover:bg-white/[0.08]')} />

      {/* Thumbnail */}
      <div className="w-10 h-10 m-3 bg-white/[0.05] overflow-hidden shrink-0 self-start mt-3.5">
        {post.image_url ? (
          <img src={post.image_url} alt="" className="w-full h-full object-cover" />
        ) : hasGraphic ? (
          <img src={(post as any).graphic_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-3.5 w-3.5 text-[#6E6E6E]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3 pr-3">
        <p className={cn('text-xs font-medium line-clamp-2 leading-snug mb-1.5', selected ? 'text-[#E8E8E8]' : 'text-[#E8E8E8]')}>
          {post.title}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusDot status={post.status} />
          {post.category && (
            <span className={cn('text-[10px] px-1.5 py-0.5 font-medium', catColor + '/20', 'text-[#D0D0D0]')}>
              {post.category}
            </span>
          )}
          {post.ai_score !== null && (
            <span className="text-[10px] text-[#6E6E6E] tabular-nums font-mono">{post.ai_score}</span>
          )}
          {langCount > 0 && (
            <span className="text-[10px] text-teal-600">{langCount}🌐</span>
          )}
          {hasGraphic && (
            <span className="text-[10px] text-rose-600">🖼</span>
          )}
          <span className="text-[10px] text-[#404040] ml-auto tabular-nums">{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
        active
          ? 'border-venom-500 text-[#E8E8E8]'
          : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0] hover:border-white/15'
      )}
    >
      {children}
    </button>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ post }: { post: Post }) {
  const structured = post.content_structured as {
    sections?: { heading: string; content: string }[]
    key_points?: string[]
  } | null
  const langCount = Object.keys(post.localized_versions ?? {}).length
  const hasGraphic = !!(post as any).graphic_url

  return (
    <div className="space-y-5 py-1">

      {/* Graphic preview */}
      {hasGraphic && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Thumbnail Graphic</p>
          <div className="aspect-40/21 max-w-sm overflow-hidden border border-white/15">
            <img src={(post as any).graphic_url} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Feed hook */}
      {post.short_text && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Feed Hook</p>
          <div className="px-4 py-3 bg-venom-500/8 border border-venom-500/20 border-l-2 border-l-venom-500">
            <p className="text-sm text-[#E8E8E8] leading-relaxed">{post.short_text}</p>
            <p className="text-[10px] text-[#6E6E6E] mt-2">{wordCount(post.short_text)} words</p>
          </div>
        </div>
      )}

      {/* Key points */}
      {structured?.key_points && structured.key_points.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Key Points</p>
          <ul className="space-y-1.5">
            {structured.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-venom-500/15 text-venom-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-[#D0D0D0] leading-relaxed">{pt}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {(post.tags?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {(post.tags ?? []).map(tag => (
              <span key={tag} className="flex items-center gap-1 text-[10px] bg-white/[0.05] border border-white/15 text-[#A8A8A8] px-2.5 py-1 rounded-full">
                <Hash className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Localization status */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Localization</p>
        <div className="flex gap-2 flex-wrap">
          {LANG_TABS.map(lang => {
            const has = !!getLocalized(post, lang.id)
            return (
              <span key={lang.id} className={cn(
                'flex items-center gap-1 text-[11px] px-2 py-1 border font-medium',
                has ? 'bg-teal-500/10 border-teal-500/30 text-teal-300' : 'bg-white/[0.05] border-white/15 text-[#6E6E6E]'
              )}>
                {lang.flag} {lang.label}
              </span>
            )
          })}
        </div>
      </div>

      {!post.short_text && !structured?.key_points?.length && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Sparkles className="h-7 w-7 text-[#404040] mb-2" />
          <p className="text-xs text-[#6E6E6E]">No overview data — run the writer pipeline</p>
        </div>
      )}
    </div>
  )
}

// ─── Article tab ──────────────────────────────────────────────────────────────

function ArticleTab({
  post,
  isEditing,
  editState,
  onChange,
}: {
  post: Post
  isEditing: boolean
  editState: EditState
  onChange: (patch: Partial<EditState>) => void
}) {
  const structured = post.content_structured as {
    sections?: { heading: string; content: string }[]
  } | null

  if (isEditing) return (
    <div className="space-y-4 py-1">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Feed Hook (short_text)</p>
          <span className="text-[10px] text-[#404040] tabular-nums">{wordCount(editState.shortText)} words</span>
        </div>
        <Textarea
          value={editState.shortText}
          onChange={e => onChange({ shortText: e.target.value })}
          placeholder="Short punchy hook for the feed..."
          rows={3}
          className="text-sm bg-white/[0.03] backdrop-blur-md border-white/15 resize-none focus:border-white/20"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Full Article Body</p>
          <span className="text-[10px] text-[#404040] tabular-nums">{wordCount(editState.body)} words · {editState.body.length} chars</span>
        </div>
        <Textarea
          value={editState.body}
          onChange={e => onChange({ body: e.target.value })}
          placeholder="Full article body..."
          rows={18}
          className="text-xs bg-white/[0.03] backdrop-blur-md border-white/15 resize-none focus:border-white/20 font-mono leading-relaxed"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-5 py-1">
      {post.short_text && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Feed Hook</p>
          <p className="text-sm text-[#D0D0D0] leading-relaxed border-l-2 border-venom-500/50 pl-3 py-1">
            {post.short_text}
          </p>
        </div>
      )}

      {structured?.sections && structured.sections.length > 0 ? (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Article Sections</p>
          {structured.sections.map((sec, i) => (
            <div key={i} className="space-y-1.5">
              {sec.heading && (
                <h3 className="text-sm font-semibold text-[#E8E8E8]">{sec.heading}</h3>
              )}
              <p className="text-sm text-[#A8A8A8] leading-relaxed">{sec.content}</p>
            </div>
          ))}
        </div>
      ) : post.body ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Body</p>
            <span className="text-[10px] text-[#404040]">{wordCount(post.body)} words</span>
          </div>
          <p className="text-sm text-[#A8A8A8] leading-relaxed whitespace-pre-wrap">{post.body}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlignLeft className="h-7 w-7 text-[#404040] mb-2" />
          <p className="text-xs text-[#6E6E6E]">No article body yet</p>
        </div>
      )}
    </div>
  )
}

// ─── Translations tab ─────────────────────────────────────────────────────────

function TranslationsTab({ post }: { post: Post }) {
  const [activeLang, setActiveLang] = useState<string | null>(null)

  return (
    <div className="space-y-4 py-1">
      {/* Lang coverage grid */}
      <div className="grid grid-cols-4 gap-2">
        {LANG_TABS.map(lang => {
          const loc = getLocalized(post, lang.id)
          const has = !!loc
          return (
            <button
              key={lang.id}
              onClick={() => setActiveLang(activeLang === lang.id ? null : lang.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 border transition-all text-center',
                has && activeLang === lang.id ? 'bg-teal-500/15 border-teal-500/40' :
                has ? 'bg-white/[0.05] border-white/15 hover:border-teal-500/30' :
                'bg-white/[0.025] border-white/10 opacity-50 cursor-default'
              )}
              disabled={!has}
            >
              <span className="text-base">{lang.flag}</span>
              <span className={cn('text-[10px] font-bold', has ? 'text-[#E8E8E8]' : 'text-[#6E6E6E]')}>{lang.label}</span>
              {has && <span className="w-1 h-1 rounded-full bg-teal-400" />}
            </button>
          )
        })}
      </div>

      {/* Active lang detail */}
      {activeLang && (() => {
        const lang = LANG_TABS.find(l => l.id === activeLang)
        const loc = getLocalized(post, activeLang)
        if (!loc) return null
        return (
          <div className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
            <p className="text-[10px] font-semibold text-[#A8A8A8] uppercase tracking-wider">
              {lang?.flag} {lang?.name}
            </p>
            {loc.title && (
              <div>
                <p className="text-[10px] text-[#6E6E6E] mb-1">Title</p>
                <p className="text-sm font-medium text-[#E8E8E8]">{loc.title}</p>
              </div>
            )}
            {(loc.summary ?? loc.short_text) && (
              <div>
                <p className="text-[10px] text-[#6E6E6E] mb-1">Short</p>
                <p className="text-sm text-[#D0D0D0] leading-relaxed">{loc.summary ?? loc.short_text}</p>
              </div>
            )}
            {loc.body && (
              <div>
                <p className="text-[10px] text-[#6E6E6E] mb-1">Body</p>
                <p className="text-sm text-[#A8A8A8] leading-relaxed whitespace-pre-wrap line-clamp-6">{loc.body}</p>
              </div>
            )}
          </div>
        )
      })()}

      {Object.keys(post.localized_versions ?? {}).length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Languages className="h-7 w-7 text-[#404040] mb-2" />
          <p className="text-xs text-[#6E6E6E]">No translations yet — run MultiLang pipeline</p>
        </div>
      )}
    </div>
  )
}

// ─── Structure tab ────────────────────────────────────────────────────────────

function StructureTab({ post }: { post: Post }) {
  const structured = post.content_structured as {
    sections?: { heading: string; content: string }[]
    key_points?: string[]
  } | null

  return (
    <div className="space-y-5 py-1">
      {structured?.key_points && structured.key_points.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Key Points ({structured.key_points.length})</p>
          <ul className="space-y-2">
            {structured.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5 py-2 px-3 bg-white/[0.04] border border-white/15">
                <span className="text-[10px] font-bold text-venom-400 mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-xs text-[#D0D0D0] leading-relaxed">{pt}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {structured?.sections && structured.sections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Sections ({structured.sections.length})</p>
          <div className="space-y-1">
            {structured.sections.map((sec, i) => (
              <div key={i} className="rounded-lg border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.04]">
                  <span className="text-[10px] font-mono text-[#6E6E6E]">§{i + 1}</span>
                  <p className="text-xs font-semibold text-[#D0D0D0]">{sec.heading || 'Untitled section'}</p>
                  <span className="ml-auto text-[10px] text-[#404040]">{wordCount(sec.content)}w</span>
                </div>
                <p className="px-3 py-2.5 text-xs text-[#A8A8A8] leading-relaxed line-clamp-3">{sec.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!structured?.key_points?.length && !structured?.sections?.length && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Layers className="h-7 w-7 text-[#404040] mb-2" />
          <p className="text-xs text-[#6E6E6E]">No structured content</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WriterClient({
  initialPosts,
  activeCategory,
  page,
  totalPages,
  totalCount,
  searchParams,
}: WriterClientProps) {
  const [posts, setPosts]       = useState<Post[]>(initialPosts)
  const [selectedId, setSelectedId]   = useState<string | null>(initialPosts[0]?.id ?? null)
  const [activeTab, setActiveTab]     = useState<ActiveTab>('overview')
  const [isEditing, setIsEditing]     = useState(false)
  const [editState, setEditState]     = useState<EditState>({ title: '', shortText: '', body: '' })
  const [actionIds, setActionIds]     = useState<Set<string>>(new Set())
  const [isWriting, setIsWriting]     = useState(false)
  const [writeResult, setWriteResult] = useState<{ created: number } | null>(null)
  const [search, setSearch]           = useState('')

  const selectedPost = posts.find(p => p.id === selectedId) ?? null
  const isLoading = selectedPost ? actionIds.has(selectedPost.id) : false

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts
    const q = search.toLowerCase()
    return posts.filter(p => p.title.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q))
  }, [posts, search])

  async function handleRunWriter() {
    setIsWriting(true)
    setWriteResult(null)
    try {
      const res = await fetch('/api/writer/run', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setWriteResult({ created: data.created })
        window.location.reload()
      }
    } finally {
      setIsWriting(false)
    }
  }

  function selectPost(id: string) {
    setSelectedId(id)
    setActiveTab('overview')
    setIsEditing(false)
  }

  function startEdit() {
    if (!selectedPost) return
    setEditState({
      title: selectedPost.title,
      shortText: selectedPost.short_text ?? selectedPost.summary ?? '',
      body: selectedPost.body ?? '',
    })
    setIsEditing(true)
  }

  function cancelEdit() { setIsEditing(false) }

  async function saveEdit() {
    if (!selectedPost) return
    const id = selectedPost.id
    setActionIds(prev => new Set(prev).add(id))
    const result = await updatePostFields(id, {
      title: editState.title,
      short_text: editState.shortText,
      summary: editState.shortText,
      body: editState.body,
    })
    if (!result.error) {
      setPosts(prev => prev.map(p => p.id === id
        ? { ...p, title: editState.title, short_text: editState.shortText, summary: editState.shortText, body: editState.body }
        : p
      ))
      setIsEditing(false)
    }
    setActionIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  async function handleSendToCms(id: string) {
    setActionIds(prev => new Set(prev).add(id))
    const result = await approvePost(id)
    if (!result.error) {
      const idx = posts.findIndex(p => p.id === id)
      const next = posts[idx + 1] ?? posts[idx - 1] ?? null
      setPosts(prev => prev.filter(p => p.id !== id))
      setSelectedId(next?.id ?? null)
    }
    setActionIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  return (
    <div className="flex h-full overflow-hidden bg-black">

      {/* ── Left panel ── */}
      <div className="w-[40%] flex flex-col border-r border-white/10 shrink-0 overflow-hidden">

        {/* Panel header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-venom-500/20 flex items-center justify-center">
                  <Wand2 className="h-3.5 w-3.5 text-venom-400" />
                </div>
                <h1 className="text-sm font-semibold text-[#E8E8E8]">Writer</h1>
                <span className="text-[10px] text-[#6E6E6E] font-mono bg-white/[0.05] px-1.5 py-0.5 rounded">Stage 07</span>
              </div>
              <p className="text-[11px] text-[#A8A8A8] mt-1 ml-8">
                {totalCount > 0 ? `${totalCount} draft${totalCount !== 1 ? 's' : ''}` : 'No drafts'}
                {writeResult && <span className="text-[#00E085] ml-2">+{writeResult.created} new</span>}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleRunWriter}
              disabled={isWriting}
              className="text-xs h-8 px-3 bg-venom-500 hover:bg-venom-600 text-white border-0 shadow-lg shadow-venom-500/20"
            >
              {isWriting
                ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Writing...</>
                : <><Wand2 className="h-3 w-3 mr-1.5" />Run Writer</>
              }
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6E6E6E] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drafts..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.03] backdrop-blur-md border border-white/10 text-xs text-[#D0D0D0] placeholder:text-[#6E6E6E] focus:outline-none focus:border-white/15 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="overflow-x-auto">
            <CategoryFilter activeCategory={activeCategory} basePath="/writer" searchParams={searchParams} />
          </div>
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto">
          {filteredPosts.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <PenLine className="h-6 w-6 text-[#404040] mx-auto mb-2" />
              <p className="text-xs text-[#6E6E6E]">{search ? 'No matching drafts' : 'No drafts yet'}</p>
            </div>
          ) : filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              selected={selectedId === post.id}
              onClick={() => selectPost(post.id)}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-white/10 px-3 py-2">
            <Pagination page={page} totalPages={totalPages} basePath="/writer" searchParams={searchParams} />
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <div className="w-[60%] flex flex-col min-w-0 overflow-hidden">
        {selectedPost ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
              {isEditing ? (
                <Input
                  value={editState.title}
                  onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
                  className="text-base font-semibold mb-3 bg-white/[0.03] backdrop-blur-md border-white/15 h-auto py-1.5"
                  placeholder="Article title"
                />
              ) : (
                <h2 className="text-base font-semibold text-[#E8E8E8] leading-snug mb-3">
                  {selectedPost.title}
                </h2>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 flex-wrap">
                {selectedPost.category && <CategoryTag category={selectedPost.category} />}
                {selectedPost.ai_score !== null && (
                  <div className="w-24">
                    <ScoreMeter score={selectedPost.ai_score} compact showLabel={false} />
                  </div>
                )}
                {(selectedPost.status as string) === 'needs_review' && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2 py-0.5 font-semibold">
                    needs review
                  </span>
                )}
                {selectedPost.status === 'approved' && (
                  <span className="text-[10px] bg-green-500/15 text-[#00E085] border border-green-500/25 rounded-full px-2 py-0.5 font-semibold">
                    approved
                  </span>
                )}
                {!!(selectedPost as any).graphic_url && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1">
                    <ImageIcon className="h-2.5 w-2.5" />graphic ready
                  </span>
                )}
                {selectedPost.source_name && (
                  <span className="text-[10px] text-[#6E6E6E]">{selectedPost.source_name}</span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-[#404040]">
                  <Clock className="h-2.5 w-2.5" />{timeAgo(selectedPost.created_at)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-white/10 px-6 shrink-0 overflow-x-auto bg-black/30">
              <TabBtn active={activeTab === 'overview'}      onClick={() => setActiveTab('overview')}>
                <Sparkles className="h-3 w-3" />Overview
              </TabBtn>
              <TabBtn active={activeTab === 'article'}      onClick={() => setActiveTab('article')}>
                <AlignLeft className="h-3 w-3" />Article
              </TabBtn>
              <TabBtn active={activeTab === 'translations'} onClick={() => setActiveTab('translations')}>
                <Globe2 className="h-3 w-3" />Translations
                {Object.keys(selectedPost.localized_versions ?? {}).length > 0 && (
                  <span className="text-[9px] bg-teal-500/20 text-teal-400 px-1 font-bold">
                    {Object.keys(selectedPost.localized_versions ?? {}).length}
                  </span>
                )}
              </TabBtn>
              <TabBtn active={activeTab === 'structure'}    onClick={() => setActiveTab('structure')}>
                <Layers className="h-3 w-3" />Structure
              </TabBtn>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'overview'      && <OverviewTab post={selectedPost} />}
              {activeTab === 'article'       && (
                <ArticleTab
                  post={selectedPost}
                  isEditing={isEditing}
                  editState={editState}
                  onChange={patch => setEditState(s => ({ ...s, ...patch }))}
                />
              )}
              {activeTab === 'translations'  && <TranslationsTab post={selectedPost} />}
              {activeTab === 'structure'     && <StructureTab post={selectedPost} />}
            </div>

            {/* Action bar */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center gap-2.5 shrink-0">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    disabled={isLoading}
                    className="bg-white/[0.08] hover:bg-white/[0.10] text-[#E8E8E8] border-0"
                  >
                    {isLoading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving</>
                      : <><Save className="h-3.5 w-3.5 mr-1.5" />Save changes</>
                    }
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-[#A8A8A8] hover:text-[#D0D0D0]">
                    <X className="h-3.5 w-3.5 mr-1.5" />Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEdit}
                    disabled={isLoading}
                    className="border-white/15 text-[#D0D0D0] hover:text-[#E8E8E8] hover:border-white/15"
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1.5" />Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSendToCms(selectedPost.id)}
                    disabled={isLoading}
                    className="bg-venom-500 hover:bg-venom-600 text-white border-0 shadow-md shadow-venom-500/20"
                  >
                    {isLoading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
                      : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve → CMS</>
                    }
                  </Button>
                  {selectedPost.source_url && (
                    <a
                      href={selectedPost.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1.5 text-xs text-[#6E6E6E] hover:text-[#A8A8A8] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />Source
                    </a>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 flex items-center justify-center">
              <PenLine className="h-6 w-6 text-[#404040]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#A8A8A8]">Select a draft</p>
              <p className="text-xs text-[#404040] mt-0.5">Pick an article from the list to review and edit it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
