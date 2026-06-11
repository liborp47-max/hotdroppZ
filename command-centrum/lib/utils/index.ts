import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PostStatus } from '@/lib/types'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

export function scoreToColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-[#A8A8A8]'
  if (score >= 80) return 'text-[#00E085]'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-poison-400'
  return 'text-red-400'
}

export function scoreToBarColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-white/[0.10]'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export function statusColor(status: PostStatus): string {
  switch (status) {
    case 'published':
      return 'bg-green-500/15 text-[#00E085] border-[#00E085]/35'
    case 'approved':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'hold':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'rejected':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'draft':
      return 'bg-white/[0.12] text-[#A8A8A8] border-white/20'
    case 'archived':
      return 'bg-white/[0.08] text-[#A8A8A8] border-white/15'
    default:
      return 'bg-white/[0.12] text-[#A8A8A8] border-white/20'
  }
}

const CATEGORY_DISPLAY: Record<string, string> = {
  // ── Current v2 categories ──────────────────────────────────────────────
  droppz:          'DROPPZ',
  usa_rap:         'USA RAP',
  uk_rap:          'UK RAP',
  eu_rap:          'EU RAP',
  ru_rap:          'RU RAP',
  balkan_rap:      'BALKAN RAP',
  rnb:             'R&B',
  fashion:         'Fashion',
  culture:         'Culture',
  fun:             'Fun',
  news:            'News',
  // ── Legacy (kept for backward compat with old posts) ───────────────────
  droppz_news:     'Droppz',
  droppz_releases: 'Droppz',
  rap_core:        'Rap',
  deep_scout:      'Deep Scout',
  drama:           'Fun',
  global_news:     'News',
  science:         'News',
  rap:             'Rap',
}

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return ''
  return CATEGORY_DISPLAY[category.toLowerCase()] ?? category
}

export function categoryColor(category: string | null | undefined): string {
  if (!category) return 'bg-white/[0.05] text-[#A8A8A8]'
  const map: Record<string, string> = {
    // ── v2 categories ──────────────────────────────────────────────────────
    droppz:          'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    usa_rap:         'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    uk_rap:          'bg-red-500/15 text-red-400 border border-red-500/25',
    eu_rap:          'bg-[#00E085]/15 text-[#00E085] border border-emerald-500/25',
    ru_rap:          'bg-purple-500/15 text-purple-400 border border-purple-500/25',
    balkan_rap:      'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    rnb:             'bg-pink-500/15 text-pink-400 border border-pink-500/25',
    fashion:         'bg-violet-500/15 text-violet-300 border border-violet-500/25',
    culture:         'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    fun:             'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
    news:            'bg-white/[0.06] text-[#D0D0D0] border border-white/15',
    // ── Legacy (backward compat) ───────────────────────────────────────────
    droppz_news:     'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    droppz_releases: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    rap_core:        'bg-blue-500/15 text-blue-400',
    deep_scout:      'bg-indigo-500/15 text-indigo-400',
    drama:           'bg-yellow-500/15 text-yellow-400',
    global_news:     'bg-white/[0.06] text-[#D0D0D0]',
    science:         'bg-cyan-500/15 text-cyan-400',
    rap:             'bg-blue-500/15 text-blue-400',
  }
  return map[category.toLowerCase()] ?? 'bg-white/[0.05] text-[#A8A8A8]'
}

export function timeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const now = new Date()
  const then = new Date(dateString)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
