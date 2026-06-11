'use client'

import {
  BarChart3,
  BookOpen,
  BookText,
  Disc3,
  Instagram,
  ListMusic,
  Music2,
  Music3,
  Radio,
  TrendingUp,
  UserCircle2,
  Video,
  Youtube,
} from 'lucide-react'
import type { WorkerPlatform } from '@/lib/scout/types'
import { tokensFor } from './platform-tokens'

const ICONS: Record<WorkerPlatform, React.ElementType> = {
  spotify_playlists: ListMusic,
  spotify_artists: UserCircle2,
  apple_music: Music2,
  deezer: Disc3,
  instagram: Instagram,
  tiktok: Video,
  youtube: Youtube,
  rss: Radio,
  blogs: BookText,
  magazines: BookOpen,
  charts: BarChart3,
  trends: TrendingUp,
}

export function PlatformIcon({
  platform,
  className = 'h-4 w-4',
}: {
  platform: WorkerPlatform
  className?: string
}) {
  const Icon = ICONS[platform] ?? Music3
  const tokens = tokensFor(platform)
  return <Icon className={`${className} ${tokens.text}`} aria-hidden />
}
