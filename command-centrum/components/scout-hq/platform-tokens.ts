import type { WorkerCategory, WorkerPlatform } from '@/lib/scout/types'

export type PlatformTokens = {
  label: string
  primary: string
  text: string
  border: string
  bg: string
  slug: string
  category: WorkerCategory
}

export type CategoryTokens = {
  label: string
  primary: string
  text: string
  border: string
  bg: string
  description: string
}

export const CATEGORY_TOKENS: Record<WorkerCategory, CategoryTokens> = {
  music: {
    label: 'Music',
    primary: '#1DB954',
    text: 'text-[#1DB954]',
    border: 'border-[#1DB954]/35',
    bg: 'bg-[#1DB954]/12',
    description: 'Streaming platformy — release detection, playlist tracking, artist profily',
  },
  social: {
    label: 'Social',
    primary: '#E1306C',
    text: 'text-[#E1306C]',
    border: 'border-[#E1306C]/35',
    bg: 'bg-[#E1306C]/12',
    description: 'Social signály — drops, viral posts, trending creators',
  },
  media: {
    label: 'Media',
    primary: '#FFB84D',
    text: 'text-[#FFB84D]',
    border: 'border-[#FFB84D]/35',
    bg: 'bg-[#FFB84D]/12',
    description: 'Editorial obsah — RSS, blogy, magaziny, reviews, drama',
  },
  signals: {
    label: 'Signals',
    primary: '#A78BFA',
    text: 'text-[#A78BFA]',
    border: 'border-[#A78BFA]/35',
    bg: 'bg-[#A78BFA]/12',
    description: 'Aggregátory + trendy — charts shifts, search trends, attention waves',
  },
}

export const PLATFORM_TOKENS: Record<WorkerPlatform, PlatformTokens> = {
  // ── music
  spotify_playlists: {
    label: 'Spotify Playlists',
    primary: '#1DB954',
    text: 'text-[#1DB954]',
    border: 'border-[#1DB954]/35',
    bg: 'bg-[#1DB954]/12',
    slug: 'spotify-playlists',
    category: 'music',
  },
  spotify_artists: {
    label: 'Spotify Artists',
    primary: '#1ED760',
    text: 'text-[#1ED760]',
    border: 'border-[#1ED760]/35',
    bg: 'bg-[#1ED760]/12',
    slug: 'spotify-artists',
    category: 'music',
  },
  apple_music: {
    label: 'Apple Music',
    primary: '#FA2D48',
    text: 'text-[#FA2D48]',
    border: 'border-[#FA2D48]/35',
    bg: 'bg-[#FA2D48]/12',
    slug: 'apple-music',
    category: 'music',
  },
  deezer: {
    label: 'Deezer',
    primary: '#A238FF',
    text: 'text-[#A238FF]',
    border: 'border-[#A238FF]/35',
    bg: 'bg-[#A238FF]/12',
    slug: 'deezer',
    category: 'music',
  },
  // ── social
  instagram: {
    label: 'Instagram',
    primary: '#E1306C',
    text: 'text-[#E1306C]',
    border: 'border-[#E1306C]/35',
    bg: 'bg-[#E1306C]/12',
    slug: 'instagram',
    category: 'social',
  },
  tiktok: {
    label: 'TikTok',
    primary: '#00F2EA',
    text: 'text-[#00F2EA]',
    border: 'border-[#00F2EA]/35',
    bg: 'bg-[#00F2EA]/12',
    slug: 'tiktok',
    category: 'social',
  },
  youtube: {
    label: 'YouTube',
    primary: '#FF0033',
    text: 'text-[#FF0033]',
    border: 'border-[#FF0033]/35',
    bg: 'bg-[#FF0033]/12',
    slug: 'youtube',
    category: 'social',
  },
  // ── media
  rss: {
    label: 'RSS',
    primary: '#FFB84D',
    text: 'text-[#FFB84D]',
    border: 'border-[#FFB84D]/35',
    bg: 'bg-[#FFB84D]/12',
    slug: 'rss',
    category: 'media',
  },
  blogs: {
    label: 'Blogs',
    primary: '#FF9F40',
    text: 'text-[#FF9F40]',
    border: 'border-[#FF9F40]/35',
    bg: 'bg-[#FF9F40]/12',
    slug: 'blogs',
    category: 'media',
  },
  magazines: {
    label: 'Magazines',
    primary: '#FFD166',
    text: 'text-[#FFD166]',
    border: 'border-[#FFD166]/35',
    bg: 'bg-[#FFD166]/12',
    slug: 'magazines',
    category: 'media',
  },
  // ── signals
  charts: {
    label: 'Charts',
    primary: '#A78BFA',
    text: 'text-[#A78BFA]',
    border: 'border-[#A78BFA]/35',
    bg: 'bg-[#A78BFA]/12',
    slug: 'charts',
    category: 'signals',
  },
  trends: {
    label: 'Trends',
    primary: '#7DD3FC',
    text: 'text-[#7DD3FC]',
    border: 'border-[#7DD3FC]/35',
    bg: 'bg-[#7DD3FC]/12',
    slug: 'trends',
    category: 'signals',
  },
}

export function tokensFor(platform: WorkerPlatform): PlatformTokens {
  return PLATFORM_TOKENS[platform]
}

export function platformFromSlug(slug: string): WorkerPlatform | null {
  const entry = Object.entries(PLATFORM_TOKENS).find(([, t]) => t.slug === slug)
  return entry ? (entry[0] as WorkerPlatform) : null
}

export function categoryTokens(category: WorkerCategory): CategoryTokens {
  return CATEGORY_TOKENS[category]
}

export const CATEGORY_ORDER: WorkerCategory[] = ['music', 'social', 'media', 'signals']

export const PLATFORM_ORDER: WorkerPlatform[] = [
  // music
  'spotify_playlists',
  'spotify_artists',
  'apple_music',
  'deezer',
  // social
  'instagram',
  'tiktok',
  'youtube',
  // media
  'rss',
  'blogs',
  'magazines',
  // signals
  'charts',
  'trends',
]

export function platformsInCategory(category: WorkerCategory): WorkerPlatform[] {
  return PLATFORM_ORDER.filter((p) => PLATFORM_TOKENS[p].category === category)
}
