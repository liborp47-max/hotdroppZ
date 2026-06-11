'use client'

import { useState } from 'react'
import {
  Sparkles, ChevronDown, ChevronRight, ExternalLink,
  Music2, Youtube, BookOpen, Apple, Image as ImageIcon,
  User, CheckCircle2, XCircle, AlertCircle, Layers, Loader2, Play,
} from 'lucide-react'
import { categoryColor, categoryLabel, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'

export type EnrichmentCluster = {
  id: string
  main_entity: string
  title: string | null
  category: string | null
  enrichment_status: string | null
  enriched_at: string | null
  artist_name: string | null
  artist_id: string | null
  spotify_url: string | null
  youtube_url: string | null
  genius_url: string | null
  apple_music_url: string | null
  image_url: string | null
  selected_image_url: string | null
  image_source: string | null
  image_score: number | null
  image_author: string | null
  image_license: string | null
  source_count: number | null
  confidence: number | null
  created_at: string
}

type StatusFilter = 'all' | 'pending' | 'done' | 'error'

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  done:    { label: 'Enriched', dot: 'bg-[#1AEE99]',  text: 'text-[#00E085]',  bg: 'bg-[rgba(0,224,133,0.10)] border-green-500/25' },
  pending: { label: 'Pending',  dot: 'bg-amber-400',  text: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25' },
  error:   { label: 'Error',    dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
}

const IMAGE_SOURCE_BADGE: Record<string, string> = {
  spotify:   'bg-green-500/15 text-[#00E085]',
  youtube:   'bg-red-500/15 text-red-400',
  wikimedia: 'bg-blue-500/15 text-blue-400',
  unsplash:  'bg-purple-500/15 text-purple-400',
  pexels:    'bg-teal-500/15 text-teal-400',
  pixabay:   'bg-orange-500/15 text-orange-400',
}

function StatusPill({ status }: { status: string | null }) {
  const s = status ?? 'pending'
  const cfg = STATUS_CFG[s] ?? STATUS_CFG.pending
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score }: { score: number | null }) {
  if (!score) return <span className="text-[10px] text-[#6E6E6E]">—</span>
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[#A8A8A8] tabular-nums">{pct}%</span>
    </div>
  )
}

function LinkRow({ icon, label, url, color }: { icon: React.ReactNode; label: string; url: string | null; color: string }) {
  if (!url) return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[11px] text-[#6E6E6E]">{label}</span>
      <span className="text-[11px] text-[#404040]">—</span>
    </div>
  )
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 group"
    >
      {icon}
      <span className={cn('text-[11px] font-medium', color)}>{label}</span>
      <span className="text-[10px] text-[#6E6E6E] truncate max-w-[200px] group-hover:text-[#A8A8A8] transition-colors">{url}</span>
      <ExternalLink className="h-2.5 w-2.5 text-[#404040] group-hover:text-[#A8A8A8] shrink-0" />
    </a>
  )
}

function ClusterRow({ cluster }: { cluster: EnrichmentCluster }) {
  const [open, setOpen] = useState(false)
  const status = cluster.enrichment_status ?? 'pending'
  const hasAnyMedia = !!(cluster.spotify_url || cluster.youtube_url || cluster.genius_url || cluster.apple_music_url)
  const hasImage = !!(cluster.selected_image_url || cluster.image_url)
  const hasArtist = !!(cluster.artist_id || cluster.artist_name)

  return (
    <div className="border-b border-white/[0.06] last:border-0">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.05] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="shrink-0 text-[#404040]">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-[#A8A8A8]" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </div>

        {/* Entity name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#E8E8E8] truncate">{cluster.main_entity}</span>
            {hasArtist && (
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 shrink-0">artist linked</span>
            )}
          </div>
          {cluster.title && (
            <p className="text-[11px] text-[#6E6E6E] truncate mt-0.5">{cluster.title}</p>
          )}
        </div>

        {/* Category */}
        <div className="shrink-0 w-28 hidden sm:block">
          {cluster.category
            ? <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', categoryColor(cluster.category))}>{categoryLabel(cluster.category)}</span>
            : <span className="text-[10px] text-[#404040]">—</span>
          }
        </div>

        {/* Status */}
        <div className="shrink-0 w-24">
          <StatusPill status={status} />
        </div>

        {/* Media pills */}
        <div className="shrink-0 flex items-center gap-1">
          {cluster.spotify_url    && <span className="text-[9px] px-1.5 py-0.5 bg-[rgba(0,224,133,0.10)] text-[#00E085] font-medium">SPT</span>}
          {cluster.youtube_url    && <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 font-medium">YT</span>}
          {cluster.genius_url     && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 font-medium">GNS</span>}
          {cluster.apple_music_url && <span className="text-[9px] px-1.5 py-0.5 bg-pink-500/10 text-pink-400 font-medium">APL</span>}
          {hasImage               && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 font-medium">IMG</span>}
          {!hasAnyMedia && !hasImage && status !== 'pending' && (
            <span className="text-[9px] text-[#404040]">none</span>
          )}
        </div>

        {/* Time */}
        <div className="shrink-0 w-20 text-right">
          <span className="text-[10px] text-[#404040] tabular-nums">
            {cluster.enriched_at ? timeAgo(cluster.enriched_at) : timeAgo(cluster.created_at)}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-black/40 border-t border-white/10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            {/* Left: media links */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-[#A8A8A8] uppercase tracking-wider">Media Links</p>
              <div className="space-y-2">
                <LinkRow
                  icon={<Music2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  label="Spotify"
                  url={cluster.spotify_url}
                  color="text-[#00E085]"
                />
                <LinkRow
                  icon={<Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  label="YouTube"
                  url={cluster.youtube_url}
                  color="text-red-400"
                />
                <LinkRow
                  icon={<BookOpen className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                  label="Genius"
                  url={cluster.genius_url}
                  color="text-yellow-400"
                />
                <LinkRow
                  icon={<Apple className="h-3.5 w-3.5 text-pink-500 shrink-0" />}
                  label="Apple Music"
                  url={cluster.apple_music_url}
                  color="text-pink-400"
                />
              </div>

              {/* Artist record */}
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] font-semibold text-[#A8A8A8] uppercase tracking-wider mb-2">Artist Record</p>
                {cluster.artist_name ? (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-[12px] font-medium text-[#D0D0D0]">{cluster.artist_name}</span>
                    {cluster.artist_id && (
                      <span className="text-[10px] font-mono text-[#6E6E6E]">{cluster.artist_id.slice(0, 8)}…</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-[#404040]">No artist record linked</span>
                )}
              </div>

              {/* Cluster meta */}
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] font-semibold text-[#A8A8A8] uppercase tracking-wider mb-2">Cluster Meta</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#6E6E6E]">Sources </span>
                    <span className="text-[#A8A8A8]">{cluster.source_count ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#6E6E6E]">Confidence </span>
                    <span className="text-[#A8A8A8]">{cluster.confidence != null ? `${Math.round(cluster.confidence * 100)}%` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#6E6E6E]">Enriched </span>
                    <span className="text-[#A8A8A8]">{cluster.enriched_at ? timeAgo(cluster.enriched_at) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#6E6E6E]">Created </span>
                    <span className="text-[#A8A8A8]">{timeAgo(cluster.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: image */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-[#A8A8A8] uppercase tracking-wider">AI Image Selection</p>
              {hasImage ? (
                <div className="space-y-2">
                  <a href={cluster.selected_image_url ?? cluster.image_url ?? ''} target="_blank" rel="noopener noreferrer"
                    className="block w-full aspect-video overflow-hidden border border-white/10 hover:border-white/15 transition-colors relative group"
                  >
                    <img
                      src={cluster.selected_image_url ?? cluster.image_url ?? ''}
                      alt={cluster.main_entity}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#6E6E6E] mb-0.5">Source</p>
                      {cluster.image_source
                        ? <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', IMAGE_SOURCE_BADGE[cluster.image_source] ?? 'bg-white/[0.05] text-[#A8A8A8]')}>
                            {cluster.image_source}
                          </span>
                        : <span className="text-[10px] text-[#404040]">—</span>
                      }
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6E6E6E] mb-1">AI Score</p>
                      <ScoreBar score={cluster.image_score} />
                    </div>
                    {cluster.image_author && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-[#6E6E6E] mb-0.5">Author</p>
                        <span className="text-[11px] text-[#A8A8A8]">{cluster.image_author}</span>
                      </div>
                    )}
                    {cluster.image_license && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-[#6E6E6E] mb-0.5">License</p>
                        <span className="text-[11px] text-[#A8A8A8]">{cluster.image_license}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center aspect-video border border-white/10 border-dashed text-[#404040]">
                  <ImageIcon className="h-6 w-6 mb-1" />
                  <span className="text-[11px]">No image found</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  clusters: EnrichmentCluster[]
  stats: { pending: number; done: number; error: number }
  config: {
    batchSize: number
    maxClusters: number
    musicCategories: string[]
    videoCategories: string[]
  }
}

export function EnrichmentClient({ clusters, stats, config }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isRunning, setIsRunning] = useState(false)
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const filtered = statusFilter === 'all'
    ? clusters
    : clusters.filter((c) => (c.enrichment_status ?? 'pending') === statusFilter)

  const total = stats.pending + stats.done + stats.error
  const successRate = total > 0 ? Math.round((stats.done / total) * 100) : 0

  async function runEnrichmentNow() {
    setIsRunning(true)
    setRunError(null)
    setRunMessage(null)

    try {
      const response = await fetch('/api/enrichment/run', { method: 'POST' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Enrichment run failed')
      }

      const processed = typeof payload?.processed === 'number' ? payload.processed : 0
      const enriched = typeof payload?.enriched === 'number' ? payload.enriched : 0
      const skipped = typeof payload?.skipped === 'number' ? payload.skipped : 0
      setRunMessage(`Run finished: ${processed} processed, ${enriched} enriched, ${skipped} skipped.`)

      // Reload to refresh server-side snapshot and counters.
      window.location.reload()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Enrichment run failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="p-5 space-y-5">

      {/* ── Module Header ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-venom-500/10 border border-venom-500/20 shrink-0">
              <Sparkles className="h-4 w-4 text-venom-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#E8E8E8]">Enrichment Engine</h2>
              <p className="text-xs text-[#A8A8A8] mt-0.5 leading-relaxed max-w-xl">
                Takes each story cluster and searches external APIs (Spotify, YouTube, Genius, Apple Music) to attach media links.
                Then runs AI image selection to pick the best thumbnail. Finally, finds or creates an artist record in the database
                and optionally logs a release entry.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold text-[#E8E8E8] tabular-nums">{successRate}%</p>
            <p className="text-[10px] text-[#6E6E6E]">success rate</p>
            <button
              onClick={() => void runEnrichmentNow()}
              disabled={isRunning}
              className={cn(
                'mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold border transition-colors',
                isRunning
                  ? 'bg-white/[0.05] text-[#A8A8A8] border-white/15 cursor-not-allowed'
                  : 'bg-green-500/15 text-[#1AEE99] border-[#00E085]/35 hover:bg-green-500/25'
              )}
            >
              {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {isRunning ? 'RUNNING...' : 'RUN ENRICHMENT'}
            </button>
          </div>
        </div>

        {runMessage && (
          <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 text-[11px] text-[#1AEE99]">
            {runMessage}
          </div>
        )}
        {runError && (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
            {runError}
          </div>
        )}

        {/* Config grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Batch size</p>
            <p className="text-sm font-semibold text-[#D0D0D0]">{config.batchSize} clusters</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Max per run</p>
            <p className="text-sm font-semibold text-[#D0D0D0]">{config.maxClusters} clusters</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Music APIs</p>
            <p className="text-xs text-[#A8A8A8] font-mono">{config.musicCategories.join(' · ')}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Video APIs</p>
            <p className="text-xs text-[#A8A8A8] font-mono">{config.videoCategories.join(' · ')}</p>
          </div>
        </div>

        {/* What each API does */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06]">
          {[
            { icon: <Music2 className="h-3 w-3 text-[#00E085]" />, name: 'Spotify', what: 'Track URL · artist URL · album art' },
            { icon: <Youtube className="h-3 w-3 text-red-400" />, name: 'YouTube', what: 'Official music video · thumbnail' },
            { icon: <BookOpen className="h-3 w-3 text-yellow-400" />, name: 'Genius', what: 'Lyrics page · song info' },
            { icon: <Apple className="h-3 w-3 text-pink-400" />, name: 'Apple Music', what: 'Song URL · hi-res artwork' },
          ].map(({ icon, name, what }) => (
            <div key={name} className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div>
                <p className="text-[11px] font-semibold text-[#D0D0D0]">{name}</p>
                <p className="text-[10px] text-[#6E6E6E]">{what}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Image AI note */}
        <div className="flex items-start gap-2 pt-2 border-t border-white/[0.06]">
          <ImageIcon className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#A8A8A8]">
            <span className="text-[#D0D0D0] font-medium">Image AI:</span>{' '}
            Scores images from Spotify/Apple Music/YouTube/Wikimedia/Unsplash by relevance to the entity.
            Priority: Spotify art {'>'} Apple Music art {'>'} YouTube thumbnail.
            Stores best pick + alternatives in <code className="text-[#A8A8A8] text-[10px]">article_images</code>.
          </p>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',  value: stats.pending, icon: AlertCircle,  cfg: STATUS_CFG.pending },
          { label: 'Enriched', value: stats.done,    icon: CheckCircle2, cfg: STATUS_CFG.done },
          { label: 'Failed',   value: stats.error,   icon: XCircle,      cfg: STATUS_CFG.error },
        ].map(({ label, value, icon: Icon, cfg }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(statusFilter === label.toLowerCase() as StatusFilter ? 'all' : label.toLowerCase() as StatusFilter)}
            className={cn(
              'rounded-xl border px-4 py-3 flex items-center gap-3 transition-all text-left',
              cfg.bg,
              statusFilter === label.toLowerCase() ? 'ring-1 ring-inset ring-current' : 'hover:brightness-110'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', cfg.text)} />
            <div>
              <p className={cn('text-xl font-bold tabular-nums', cfg.text)}>{value}</p>
              <p className="text-[11px] text-[#A8A8A8]">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Status filter pills ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'done', 'error'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
              statusFilter === s
                ? 'bg-venom-500 text-white'
                : 'bg-white/[0.05] text-[#A8A8A8] hover:bg-white/[0.08] hover:text-[#E8E8E8]'
            )}
          >
            {s === 'all' ? `All (${clusters.length})` : `${STATUS_CFG[s]?.label} (${s === 'pending' ? stats.pending : s === 'done' ? stats.done : stats.error})`}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[#6E6E6E]">
          {filtered.length} cluster{filtered.length !== 1 ? 's' : ''} shown · click row to expand
        </span>
      </div>

      {/* ── Cluster list ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-black/50 backdrop-blur-xl border-b border-white/10">
          <div className="w-4 shrink-0" />
          <div className="flex-1 text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Entity / Title</div>
          <div className="w-28 hidden sm:block text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Category</div>
          <div className="w-24 text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Status</div>
          <div className="shrink-0 w-32 text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider">Media</div>
          <div className="w-20 text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider text-right">When</div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-8 w-8 text-[#404040] mb-3" />
            <p className="text-sm font-medium text-[#6E6E6E]">No clusters match this filter</p>
          </div>
        ) : (
          <div>
            {filtered.map((cluster) => (
              <ClusterRow key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
