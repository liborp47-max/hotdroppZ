'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Radio, Send, Eye, EyeOff, Zap, ArrowRight,
  CheckSquare, Square, RefreshCw, BarChart2,
  Sparkles, Clock, AlertCircle, Music2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DistPost = {
  id: string
  title: string
  content: string
  artist: string | null
  category: string | null
  priority: string | null
  image_url: string | null
  spotify_url: string | null
  created_at: string
  published_at: string | null
  hdua_distributed_at: string | null
  distribution_priority: string | null
  is_radar: boolean | null
  view_count: number | null
  boost_count: number | null
  like_count: number | null
  metadata: Record<string, unknown> | null
}

type Tab = 'queue' | 'live'

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'URGENT', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25' },
  high:   { label: 'HIGH',   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
  normal: { label: 'NORMAL', color: 'text-[#A8A8A8]',   bg: 'bg-white/[0.08] border-white/15' },
  low:    { label: 'LOW',    color: 'text-[#6E6E6E]',   bg: 'bg-white/[0.04] border-white/10' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#A8A8A8]">
      <Icon className={cn('h-3 w-3', color)} />
      <span className="tabular-nums text-[#D0D0D0]">{value.toLocaleString()}</span>
      <span>{label}</span>
    </span>
  )
}

function PostCard({
  post,
  selectable,
  selected,
  onToggle,
  onAction,
}: {
  post: DistPost
  selectable?: boolean
  selected?: boolean
  onToggle?: () => void
  onAction?: (action: 'retract' | 'radar', value?: boolean) => void
}) {
  const priKey = post.distribution_priority ?? 'normal'
  const priCfg = PRIORITY_CFG[priKey] ?? PRIORITY_CFG.normal
  const isLive = !!post.hdua_distributed_at

  return (
    <div
      className={cn(
        'group relative border transition-all duration-150',
        selected
          ? 'border-cyan-500/60 bg-cyan-500/5'
          : 'border-white/10 bg-white/[0.025] hover:border-white/15'
      )}
    >
      {/* Selection checkbox */}
      {selectable && (
        <button
          onClick={onToggle}
          className="absolute top-3 left-3 z-10 text-[#6E6E6E] hover:text-cyan-400 transition-colors"
        >
          {selected
            ? <CheckSquare className="h-4 w-4 text-cyan-400" />
            : <Square className="h-4 w-4" />}
        </button>
      )}

      <div className={cn('p-4', selectable && 'pl-9')}>
        {/* Header row */}
        <div className="flex items-start gap-3">
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="w-12 h-12 object-cover shrink-0 border border-white/10"
            />
          )}
          {!post.image_url && (
            <div className="w-12 h-12 bg-white/[0.05] flex items-center justify-center shrink-0">
              <Music2 className="h-5 w-5 text-[#404040]" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {post.priority && (
                <span className="text-[10px] font-bold text-[#6E6E6E] font-mono">{post.priority}</span>
              )}
              {isLive && (
                <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', priCfg.bg, priCfg.color)}>
                  {priCfg.label}
                </span>
              )}
              {post.is_radar && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                  <Zap className="h-2.5 w-2.5" /> RADAR
                </span>
              )}
            </div>
            <p className="text-[13px] font-semibold text-[#E8E8E8] leading-snug line-clamp-1">{post.title}</p>
            {post.artist && (
              <p className="text-[11px] text-[#A8A8A8] mt-0.5">{post.artist}</p>
            )}
          </div>
        </div>

        {/* Content preview */}
        <p className="mt-2 text-[12px] text-[#A8A8A8] leading-relaxed line-clamp-2">{post.content}</p>

        {/* Footer row */}
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-[#6E6E6E]">
              <Clock className="h-3 w-3" />
              {isLive
                ? `Live ${timeAgo(post.hdua_distributed_at!)}`
                : `Approved ${timeAgo(post.published_at ?? post.created_at)}`}
            </span>
            {isLive && (
              <>
                {(post.view_count ?? 0) > 0 && (
                  <StatBadge icon={Eye} value={post.view_count ?? 0} label="views" color="text-[#A8A8A8]" />
                )}
                {(post.boost_count ?? 0) > 0 && (
                  <StatBadge icon={Zap} value={post.boost_count ?? 0} label="boosts" color="text-yellow-500" />
                )}
                {(post.like_count ?? 0) > 0 && (
                  <StatBadge icon={BarChart2} value={post.like_count ?? 0} label="likes" color="text-pink-500" />
                )}
              </>
            )}
          </div>

          {/* Action buttons (live panel) */}
          {isLive && onAction && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onAction('radar', !post.is_radar)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-[11px] font-medium border transition-all duration-150',
                  post.is_radar
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                    : 'border-white/15 bg-white/[0.04] text-[#A8A8A8] hover:text-yellow-400 hover:border-yellow-500/30'
                )}
              >
                <Sparkles className="h-3 w-3" />
                {post.is_radar ? 'Radar ON' : 'Radar'}
              </button>
              <button
                onClick={() => onAction('retract')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-white/15 bg-white/[0.04] text-[#A8A8A8] hover:text-red-400 hover:border-red-500/30 transition-all duration-150"
              >
                <EyeOff className="h-3 w-3" />
                Retract
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DistributionClient() {
  const [tab, setTab] = useState<Tab>('queue')
  const [queue, setQueue] = useState<DistPost[]>([])
  const [live, setLive] = useState<DistPost[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushPriority, setPushPriority] = useState<string>('normal')
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPushed, setLastPushed] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [qRes, lRes] = await Promise.all([
        fetch('/api/distribution/queue'),
        fetch('/api/distribution/live'),
      ])
      const [qData, lData] = await Promise.all([qRes.json(), lRes.json()])
      setQueue(qData.posts ?? [])
      setLive(lData.posts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load distribution data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === queue.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(queue.map(p => p.id)))
    }
  }

  const pushSelected = async () => {
    if (selected.size === 0) return
    setPushing(true)
    setError(null)
    try {
      const res = await fetch('/api/distribution/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), priority: pushPriority }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Push failed')
      setLastPushed(data.pushed ?? 0)
      setSelected(new Set())
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed')
    } finally {
      setPushing(false)
    }
  }

  const handleLiveAction = async (postId: string, action: 'retract' | 'radar', value?: boolean) => {
    const body: Record<string, unknown> = { action }
    if (action === 'radar') body.radar = value
    try {
      const res = await fetch(`/api/distribution/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Action failed')
        return
      }
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'queue', label: 'Queue', count: queue.length, color: 'text-amber-400' },
    { key: 'live',  label: 'Live in HDUA', count: live.length, color: 'text-[#00E085]' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          <Radio className="h-3.5 w-3.5" />
          Pipeline / 05 / Distribution
        </div>
        <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">HDCC → HDUA</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
          Explicit push gateway. Approved posts wait in queue — you control what goes live in HDUA.
        </p>

        {/* Summary stats */}
        <div className="mt-4 flex items-center gap-6 flex-wrap">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-amber-400 tabular-nums">{queue.length}</span>
            <span className="text-[11px] text-[#6E6E6E]">in queue</span>
          </div>
          <ArrowRight className="h-5 w-5 text-[#404040]" />
          <div className="flex flex-col">
            <span className="text-2xl font-black text-[#00E085] tabular-nums">{live.length}</span>
            <span className="text-[11px] text-[#6E6E6E]">live in HDUA</span>
          </div>
          <div className="ml-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 bg-white/[0.03] backdrop-blur-md text-[12px] text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/15 transition-all"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error / success banners */}
      {error && (
        <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {lastPushed !== null && !error && (
        <div className="flex items-center gap-2 border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-4 py-3 text-[13px] text-[#00E085]">
          <Send className="h-4 w-4 shrink-0" />
          {lastPushed} post{lastPushed !== 1 ? 's' : ''} pushed live to HDUA.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border border-white/10 bg-white/[0.03] backdrop-blur-md p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium transition-all duration-150',
              tab === t.key
                ? 'bg-white/[0.05] text-[#E8E8E8]'
                : 'text-[#A8A8A8] hover:text-[#D0D0D0]'
            )}
          >
            {t.label}
            <span className={cn('text-[11px] font-mono tabular-nums font-bold', tab === t.key ? t.color : 'text-[#6E6E6E]')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── QUEUE TAB ── */}
      {tab === 'queue' && (
        <div className="space-y-3">
          {/* Toolbar */}
          {queue.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-[12px] text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
              >
                {selected.size === queue.length
                  ? <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
                  : <Square className="h-3.5 w-3.5" />}
                {selected.size === queue.length ? 'Deselect all' : 'Select all'}
              </button>

              {selected.size > 0 && (
                <>
                  <div className="h-4 w-px bg-white/[0.05]" />
                  <span className="text-[12px] text-[#A8A8A8]">{selected.size} selected</span>
                  <div className="h-4 w-px bg-white/[0.05]" />
                  <select
                    value={pushPriority}
                    onChange={e => setPushPriority(e.target.value)}
                    className="rounded-md border border-white/15 bg-white/[0.03] backdrop-blur-md px-2 py-1 text-[12px] text-[#D0D0D0] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    onClick={pushSelected}
                    disabled={pushing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[12px] font-semibold text-black transition-all duration-150"
                  >
                    <Send className={cn('h-3.5 w-3.5', pushing && 'animate-pulse')} />
                    {pushing ? 'Pushing...' : `Push ${selected.size} to HDUA`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Queue list */}
          {queue.length === 0 && !loading && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <Radio className="h-8 w-8 text-[#404040] mx-auto mb-3" />
              <p className="text-sm text-[#A8A8A8]">Queue is empty. Approve posts in FEED to see them here.</p>
            </div>
          )}
          {queue.map(post => (
            <PostCard
              key={post.id}
              post={post}
              selectable
              selected={selected.has(post.id)}
              onToggle={() => toggleSelect(post.id)}
            />
          ))}
        </div>
      )}

      {/* ── LIVE TAB ── */}
      {tab === 'live' && (
        <div className="space-y-3">
          {live.length === 0 && !loading && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <Eye className="h-8 w-8 text-[#404040] mx-auto mb-3" />
              <p className="text-sm text-[#A8A8A8]">Nothing live yet. Push posts from the Queue tab.</p>
            </div>
          )}
          {live.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onAction={(action, value) => handleLiveAction(post.id, action, value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
