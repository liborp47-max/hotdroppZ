'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, X, Loader2, Radio, Layers, Rss, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_EMOJI, type Category,
} from '@/lib/categories'

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchResult = {
  id: string
  section: 'scout' | 'cluster' | 'feed'
  title: string
  excerpt: string
  artist: string | null
  category: Category
  date: string
  href: string
  status?: string
}

type SearchResponse = {
  results: SearchResult[]
  total: number
  query: string
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_CFG = {
  scout:   { label: 'Scout',   icon: Radio,  color: 'text-blue-400' },
  cluster: { label: 'Cluster', icon: Layers, color: 'text-indigo-400' },
  feed:    { label: 'Feed',    icon: Rss,    color: 'text-orange-400' },
} as const

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({ result, onClose }: { result: SearchResult; onClose: () => void }) {
  const sec = SECTION_CFG[result.section]
  const SectionIcon = sec.icon
  const catStyle = CATEGORY_COLORS[result.category]

  return (
    <Link
      href={result.href}
      onClick={onClose}
      className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors group"
    >
      <SectionIcon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', sec.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 border', catStyle)}>
            {CATEGORY_EMOJI[result.category]} {CATEGORY_LABELS[result.category]}
          </span>
          {result.artist && (
            <span className="text-[11px] text-[#A8A8A8]">{result.artist}</span>
          )}
          <span className={cn('text-[10px] font-medium ml-auto', sec.color)}>{sec.label}</span>
        </div>
        <p className="text-[13px] font-medium text-[#E8E8E8] group-hover:text-[#E8E8E8] leading-snug line-clamp-1 transition-colors">
          {result.title}
        </p>
        {result.excerpt && (
          <p className="text-[11px] text-[#6E6E6E] mt-0.5 line-clamp-1">{result.excerpt}</p>
        )}
      </div>
    </Link>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  /** If true, renders as full-width bar (for page headers). Default: compact icon+popover. */
  variant?: 'bar' | 'compact'
  /** Lock search to a specific section */
  section?: 'scout' | 'cluster' | 'feed' | 'all'
  /** Pre-filter category */
  defaultCategory?: Category
  placeholder?: string
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch({
  variant = 'compact',
  section = 'all',
  defaultCategory,
  placeholder = 'Search artists, tracks, stories…',
  className,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | ''>( defaultCategory ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 280)

  // Fetch
  const fetchResults = useCallback(async (q: string, cat: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ q, section, limit: '30' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const data: SearchResponse = await res.json()
      setResults(data.results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search error')
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => {
    fetchResults(debouncedQuery, category)
  }, [debouncedQuery, category, fetchResults])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const clear = () => { setQuery(''); setResults([]); setError(null) }
  const close = () => { setOpen(false); clear() }

  const hasResults = results.length > 0
  const showDropdown = open && (query.length >= 2 || showFilters)

  // Group results by section
  const grouped: Record<string, SearchResult[]> = {}
  for (const r of results) {
    grouped[r.section] = grouped[r.section] ?? []
    grouped[r.section].push(r)
  }

  // ── Compact trigger ────────────────────────────────────────────────────────
  if (variant === 'compact' && !open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 border border-white/10 bg-white/[0.03] backdrop-blur-md',
          'text-[12px] text-[#A8A8A8] hover:text-[#D0D0D0] hover:border-white/15 transition-all duration-150',
          className
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="ml-1 text-[10px] text-[#404040] font-mono border border-white/10 px-1">⌘K</kbd>
      </button>
    )
  }

  // ── Full search bar ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={cn('relative', variant === 'bar' ? 'w-full' : 'w-80', className)}>
      {/* Input */}
      <div className={cn(
        'flex items-center gap-2 border bg-white/[0.03] backdrop-blur-md px-3 py-2 transition-all duration-150',
        open ? 'border-white/15 ring-1 ring-[#00E085]/40' : 'border-white/10',
      )}>
        {loading
          ? <Loader2 className="h-4 w-4 text-[#A8A8A8] animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-[#A8A8A8] shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:outline-none"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'p-1 transition-colors',
              showFilters ? 'text-cyan-400 bg-cyan-500/10' : 'text-[#6E6E6E] hover:text-[#A8A8A8]'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          {query && (
            <button onClick={clear} className="p-1 text-[#6E6E6E] hover:text-[#A8A8A8] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 border border-white/10 bg-black shadow-2xl shadow-black/60 z-50 overflow-hidden">

          {/* Category filters */}
          {showFilters && (
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCategory('')}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-150',
                  category === ''
                    ? 'border-white/20 bg-white/[0.08] text-[#E8E8E8]'
                    : 'border-white/10 text-[#6E6E6E] hover:text-[#D0D0D0] hover:border-white/15'
                )}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat === category ? '' : cat)}
                  className={cn(
                    'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-150',
                    category === cat
                      ? 'border-white/20 bg-white/[0.08] text-[#E8E8E8]'
                      : 'border-white/10 text-[#6E6E6E] hover:text-[#D0D0D0] hover:border-white/15'
                  )}
                >
                  {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {query.length >= 2 && (
            <>
              {error && (
                <p className="px-4 py-3 text-[12px] text-red-400">{error}</p>
              )}
              {!loading && !hasResults && !error && (
                <p className="px-4 py-4 text-center text-[12px] text-[#6E6E6E]">
                  No results for <span className="text-[#A8A8A8]">"{query}"</span>
                </p>
              )}
              {hasResults && (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-white/[0.04]">
                  {(Object.entries(grouped) as [string, SearchResult[]][]).map(([sec, rows]) => (
                    <div key={sec}>
                      <div className="px-4 py-1.5 bg-black/50 backdrop-blur-xl sticky top-0">
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider', SECTION_CFG[sec as keyof typeof SECTION_CFG].color)}>
                          {SECTION_CFG[sec as keyof typeof SECTION_CFG].label}
                          <span className="ml-1.5 text-[#404040] font-normal normal-case tracking-normal">({rows.length})</span>
                        </span>
                      </div>
                      {rows.map(r => (
                        <ResultRow key={r.id} result={r} onClose={close} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Footer shortcut hint */}
          <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3">
            <span className="text-[10px] text-[#404040]">
              <kbd className="font-mono">↑↓</kbd> navigate · <kbd className="font-mono">↵</kbd> open · <kbd className="font-mono">Esc</kbd> close
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
