'use client'

import { createContext, useContext, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { DateRange } from '@/lib/utils/filter'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { DateRange } from '@/lib/utils/filter'
export type Priority   = 'P0' | 'P1' | 'P2' | 'P3' | 'all'

export const CATEGORIES = [
  'droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap',
  'fashion', 'culture', 'fun', 'news',
] as const

export type Category = typeof CATEGORIES[number]

export type GlobalFilters = {
  dateRange:  DateRange
  category:   string    // '' = all
  style:      string    // '' = all, 'streetrap'|'rap'|'rnb'|'other'
  priority:   Priority
  search:     string
  source:     string
}

type FilterContextValue = {
  filters:    GlobalFilters
  activeCount: number
  set:        (key: keyof GlobalFilters, value: string) => void
  reset:      () => void
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: GlobalFilters = {
  dateRange: 'all',
  category:  '',
  style:     '',
  priority:  'all',
  search:    '',
  source:    '',
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  // Read current filters from URL
  const filters: GlobalFilters = useMemo(() => ({
    dateRange: (searchParams.get('dr')  as DateRange) || 'all',
    category:   searchParams.get('cat') ?? '',
    style:      searchParams.get('sty') ?? '',
    priority:  (searchParams.get('pri') as Priority)  || 'all',
    search:     searchParams.get('q')   ?? '',
    source:     searchParams.get('src') ?? '',
  }), [searchParams])

  const activeCount = useMemo(() => (
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.category  !== ''   ? 1 : 0) +
    (filters.style     !== ''   ? 1 : 0) +
    (filters.priority  !== 'all'? 1 : 0) +
    (filters.search    !== ''   ? 1 : 0) +
    (filters.source    !== ''   ? 1 : 0)
  ), [filters])

  const PARAM_KEYS: Record<keyof GlobalFilters, string> = {
    dateRange: 'dr',
    category:  'cat',
    style:     'sty',
    priority:  'pri',
    search:    'q',
    source:    'src',
  }

  const set = useCallback((key: keyof GlobalFilters, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const paramKey = PARAM_KEYS[key]
    const defaultVal = DEFAULTS[key]

    if (!value || value === defaultVal) {
      params.delete(paramKey)
    } else {
      params.set(paramKey, value)
    }
    params.delete('page') // reset pagination on filter change
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }, [searchParams, pathname, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    router.push(pathname)
  }, [pathname, router])

  return (
    <FilterContext.Provider value={{ filters, activeCount, set, reset }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useGlobalFilter(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useGlobalFilter must be used inside FilterProvider')
  return ctx
}

export { dateRangeToISO } from '@/lib/utils/filter'
