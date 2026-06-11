'use client'

import { useState } from 'react'
import { Tv2, Video, Image as ImageIcon, AlertCircle, Music, Youtube, ExternalLink } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { ModuleHeader } from '@/components/shared/module-header'

type FeedPost = {
  id: string
  type: string | null
  title: string | null
  entity: string | null
  category: string | null
  media_hint: 'video' | 'image' | null
  spotify_url: string | null
  youtube_url: string | null
  image_url: string | null
  created_at: string
  cluster_id: string | null
}

type Stats = { total: number; withVideo: number; withImage: number; noHint: number }
type FilterKey = 'all' | 'video' | 'image' | 'none'

const TYPE_LABELS: Record<string, string> = {
  music_release: 'Release',
  video_release: 'Video',
  album_release:  'Album',
  event:          'Event',
  news:           'News',
  drama:          'Drama',
}

const CATEGORY_COLORS: Record<string, string> = {
  droppz: 'bg-orange-500/20 text-orange-300',
  usa_rap: 'bg-blue-500/20 text-blue-300',
  uk_rap: 'bg-purple-500/20 text-purple-300',
  eu_rap: 'bg-indigo-500/20 text-indigo-300',
  rnb: 'bg-pink-500/20 text-pink-300',
  fashion: 'bg-fuchsia-500/20 text-fuchsia-300',
  culture: 'bg-teal-500/20 text-teal-300',
  fun: 'bg-yellow-500/20 text-yellow-300',
  news: 'bg-white/[0.12] text-[#D0D0D0]',
}

function MediaHintBadge({ hint }: { hint: string | null }) {
  if (hint === 'video') return (
    <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 font-medium">
      <Video className="h-2.5 w-2.5" />video
    </span>
  )
  if (hint === 'image') return (
    <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 font-medium">
      <ImageIcon className="h-2.5 w-2.5" />image
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] text-[#6E6E6E] bg-white/[0.05] border border-white/15 px-1.5 py-0.5 font-medium">
      <AlertCircle className="h-2.5 w-2.5" />no hint
    </span>
  )
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',   label: 'All' },
  { key: 'video', label: 'Video' },
  { key: 'image', label: 'Image' },
  { key: 'none',  label: 'No hint' },
]

interface Props {
  posts: FeedPost[]
  stats: Stats
}

export function FeedClient({ posts, stats }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const filtered = posts.filter(p => {
    const matchFilter =
      filter === 'all'   ? true :
      filter === 'video' ? p.media_hint === 'video' :
      filter === 'image' ? p.media_hint === 'image' :
      !p.media_hint
    const matchSearch = !search || (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.entity ?? '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    all: posts.length,
    video: stats.withVideo,
    image: stats.withImage,
    none: stats.noHint,
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <ModuleHeader
        icon={Tv2}
        iconColor="text-cyan-400"
        iconBg="bg-cyan-500/10"
        title="Feed Engine"
        subtitle="Stage 09 — Post-Graphics"
        description="Validates and classifies feed cards generated from story clusters. Each feed post gets a media_hint (video or image) based on available media links, which determines how the post renders in the public feed."
        config={[
          { label: 'Batch limit', value: 100 },
          { label: 'Hint logic', value: 'video if YouTube + no Spotify; else image' },
          { label: 'Sources', value: 'story_clusters → feed_posts' },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total cards', value: stats.total,     color: 'text-[#E8E8E8]' },
          { label: 'Video',       value: stats.withVideo, color: 'text-rose-400' },
          { label: 'Image',       value: stats.withImage, color: 'text-blue-400' },
          { label: 'No hint',     value: stats.noHint,    color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[11px] text-[#A8A8A8] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                filter === f.key
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] border-white/10 hover:border-white/15 hover:text-[#D0D0D0]'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] tabular-nums px-1.5 rounded-full font-bold',
                filter === f.key ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#6E6E6E]'
              )}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or entity..."
          className="ml-auto text-xs text-[#D0D0D0] bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 w-56 focus:outline-none focus:border-white/15 placeholder:text-[#6E6E6E]"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_80px_80px_60px] px-4 py-2 border-b border-white/10 bg-black/50 backdrop-blur-xl">
          {['Title / Entity', 'Type', 'Category', 'Hint', 'Media', 'Age'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">{h}</span>
          ))}
        </div>
        <div className="divide-y divide-white/[0.06]/60">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#6E6E6E]">No feed posts</div>
          ) : filtered.map(p => (
            <div key={p.id} className="grid grid-cols-[1fr_120px_100px_80px_80px_60px] items-center px-4 py-2.5 hover:bg-white/[0.03] backdrop-blur-md transition-colors">
              <div className="min-w-0">
                <p className="text-xs text-[#E8E8E8] truncate">{p.title ?? '—'}</p>
                {p.entity && <p className="text-[10px] text-[#6E6E6E] mt-0.5">{p.entity}</p>}
              </div>
              <span className="text-[10px] text-[#A8A8A8]">{TYPE_LABELS[p.type ?? ''] ?? p.type ?? '—'}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 font-medium w-fit', CATEGORY_COLORS[p.category ?? ''] ?? 'text-[#6E6E6E]')}>
                {p.category ?? '—'}
              </span>
              <div><MediaHintBadge hint={p.media_hint} /></div>
              <div className="flex items-center gap-1.5">
                {p.spotify_url && <Music className="h-3 w-3 text-[#00E085]" />}
                {p.youtube_url && <Youtube className="h-3 w-3 text-rose-400" />}
              </div>
              <span className="text-[10px] text-[#404040] tabular-nums">{timeAgo(p.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
