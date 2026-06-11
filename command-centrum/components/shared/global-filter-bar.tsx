'use client'

import { useCallback, useRef, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useGlobalFilter, CATEGORIES } from '@/components/layout/filter-context'
import type { DateRange, Priority } from '@/components/layout/filter-context'
import { cn } from '@/lib/utils'

// ─── Pages where the filter bar is shown ──────────────────────────────────────

const FILTER_PAGES = [
  '/writer', '/published',
]

// ─── Category labels ──────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  droppz:     'DROPPZ',
  usa_rap:    'USA',
  uk_rap:     'UK',
  eu_rap:     'EU',
  ru_rap:     'RU',
  balkan_rap: 'BALKAN',
  fashion:    'Fashion',
  culture:    'Culture',
  fun:        'Fun',
  news:       'News',
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'text-orange-400 border-orange-500/40',
  P1: 'text-yellow-400 border-yellow-500/40',
  P2: 'text-blue-400  border-blue-500/40',
  P3: 'text-[#A8A8A8]  border-white/15',
}

// ─── Style sub-genre filter ───────────────────────────────────────────────────

const STYLES = ['streetrap', 'rap', 'rnb', 'other'] as const

const STYLE_LABELS: Record<string, string> = {
  streetrap: 'Street',
  rap:       'Rap',
  rnb:       'R&B',
  other:     'Other',
}

const STYLE_COLORS: Record<string, string> = {
  streetrap: 'text-red-400 border-red-500/40',
  rap:       'text-yellow-400 border-yellow-500/40',
  rnb:       'text-purple-400 border-purple-500/40',
  other:     'text-[#A8A8A8] border-white/15',
}

// ─── Pill button ──────────────────────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active?:   boolean
  onClick:   () => void
  children:  React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-0.5 text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
          : 'border-white/15 text-[#A8A8A8] hover:border-white/20 hover:text-[#E8E8E8]',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ─── Main bar ─────────────────────────────────────────────────────────────────

export function GlobalFilterBar() {
  const pathname       = usePathname()
  const { filters, activeCount, set, reset } = useGlobalFilter()
  const [, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback((value: string) => {
    startTransition(() => { set('search', value) })
  }, [set])

  const handleDateRange = useCallback((dr: DateRange) => {
    set('dateRange', filters.dateRange === dr ? 'all' : dr)
  }, [set, filters.dateRange])

  const handlePriority = useCallback((p: Priority) => {
    set('priority', filters.priority === p ? 'all' : p)
  }, [set, filters.priority])

  const handleCategory = useCallback((cat: string) => {
    set('category', filters.category === cat ? '' : cat)
  }, [set, filters.category])

  const handleStyle = useCallback((s: string) => {
    set('style', filters.style === s ? '' : s)
  }, [set, filters.style])

  // Only render on content list pages
  const shouldShow = FILTER_PAGES.some((p) => pathname.startsWith(p))
  if (!shouldShow) return null

  return (
    <div className="border-b border-white/[0.06] bg-black/50 backdrop-blur-2xl backdrop-saturate-150 px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap min-h-7">

        {/* Icon */}
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#6E6E6E] shrink-0" />

        {/* Date range */}
        <div className="flex items-center gap-1">
          {(['24h', '7d', '30d'] as DateRange[]).map((dr) => (
            <Pill
              key={dr}
              active={filters.dateRange === dr}
              onClick={() => handleDateRange(dr)}
            >
              {dr}
            </Pill>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.05] shrink-0" />

        {/* Category pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <Pill
              key={cat}
              active={filters.category === cat}
              onClick={() => handleCategory(cat)}
            >
              {CAT_LABELS[cat] ?? cat}
            </Pill>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.05] shrink-0" />

        {/* Style pills */}
        <div className="flex items-center gap-1">
          {STYLES.map((s) => (
            <Pill
              key={s}
              active={filters.style === s}
              onClick={() => handleStyle(s)}
              className={filters.style === s ? undefined : STYLE_COLORS[s]}
            >
              {STYLE_LABELS[s]}
            </Pill>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.05] shrink-0" />

        {/* Priority */}
        <div className="flex items-center gap-1">
          {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
            <Pill
              key={p}
              active={filters.priority === p}
              onClick={() => handlePriority(p)}
              className={filters.priority === p ? undefined : PRIORITY_COLORS[p]}
            >
              {p}
            </Pill>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.05] shrink-0" />

        {/* Search */}
        <div className="flex items-center gap-1.5 relative">
          <Search className="h-3 w-3 text-[#A8A8A8] absolute left-2 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search title…"
            defaultValue={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-6 pr-2 py-0.5 bg-white/[0.03] backdrop-blur-md border border-white/15 text-xs text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:outline-none focus:border-white/20 w-36"
          />
        </div>

        {/* Reset */}
        {activeCount > 0 && (
          <>
            <div className="w-px h-4 bg-white/[0.05] shrink-0" />
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] border border-white/15 hover:border-white/20 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
              <span className="ml-0.5 bg-orange-500/20 text-orange-300 text-[10px] px-1 rounded-full font-medium">
                {activeCount}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
