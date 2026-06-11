'use client'

import { useState, useEffect } from 'react'
import {
  Trophy, ArrowRight, CheckCircle2, XCircle, Clock, Loader2,
  Filter, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Music, Newspaper, Globe, Flame, Lightbulb, Shirt, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ContentCategory = 'droppz' | 'music_news' | 'global_news' | 'drama_beef' | 'intel' | 'fashion'

type FinalsStatus = 'draft' | 'approved' | 'sent_to_feed' | 'rejected'

type FinalItem = {
  id: string
  title: string
  category: ContentCategory
  status: FinalsStatus
  templateId: string
  clusterId: string
  writerContent?: string
  createdAt: string
  approvedAt?: string
  feedPostId?: string
}

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const MOCK_ITEMS: FinalItem[] = [
  {
    id: 'fin-001',
    title: 'Travis Scott Drops Surprise Collab with Metro Boomin',
    category: 'droppz',
    status: 'draft',
    templateId: 'droppz_v1',
    clusterId: 'cl-xxxx-001',
    writerContent: 'Travis Scott and Metro Boomin have quietly dropped a collaborative EP titled "ASTRO METRO" across all streaming platforms...',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'fin-002',
    title: 'Kendrick Lamar Named Global Ambassador for Nike',
    category: 'music_news',
    status: 'approved',
    templateId: 'music_news_v1',
    clusterId: 'cl-xxxx-002',
    writerContent: 'Nike has officially announced Kendrick Lamar as its new global brand ambassador, extending a partnership that began...',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    approvedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'fin-003',
    title: 'Drake vs. Future Feud Escalates After IG Post',
    category: 'drama_beef',
    status: 'sent_to_feed',
    templateId: 'drama_beef_v1',
    clusterId: 'cl-xxxx-003',
    writerContent: "The ongoing tension between Drake and Future reached a new level this week after a cryptic Instagram post...",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    approvedAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    feedPostId: 'feed-post-77',
  },
  {
    id: 'fin-004',
    title: "Off-White x Virgil Archive Drop — Limited Fashion Capsule",
    category: 'fashion',
    status: 'draft',
    templateId: 'fashion_v1',
    clusterId: 'cl-xxxx-004',
    writerContent: "The posthumous Virgil Abloh archive has released a limited 12-piece capsule through Off-White's Paris flagship...",
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
]

const CATEGORY_META: Record<ContentCategory, { label: string; icon: React.ElementType; color: string }> = {
  droppz:     { label: 'DroppZ',      icon: Music,     color: 'text-venom-400' },
  music_news:  { label: 'Music News',  icon: Newspaper, color: 'text-blue-400' },
  global_news: { label: 'Global News', icon: Globe,     color: 'text-cyan-400' },
  drama_beef:  { label: 'Drama/Beef',  icon: Flame,     color: 'text-red-400' },
  intel:       { label: 'Intel',       icon: Lightbulb, color: 'text-amber-400' },
  fashion:     { label: 'Fashion',     icon: Shirt,     color: 'text-pink-400' },
}

const STATUS_CONFIG: Record<FinalsStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  draft:        { label: 'Draft',        color: 'text-[#A8A8A8]',   bg: 'bg-white/[0.05]',      border: 'border-white/15',      icon: Clock },
  approved:     { label: 'Approved',     color: 'text-[#00E085]',  bg: 'bg-[rgba(0,224,133,0.10)]',  border: 'border-[#00E085]/35',  icon: CheckCircle2 },
  sent_to_feed: { label: 'In Feed',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: ArrowRight },
  rejected:     { label: 'Rejected',     color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: XCircle },
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function FinalsPool() {
  const [items, setItems] = useState<FinalItem[]>(MOCK_ITEMS)
  const [filterStatus, setFilterStatus] = useState<FinalsStatus | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<ContentCategory | 'all'>('all')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    setLoading(false)
  }

  const approveItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'approved', approvedAt: new Date().toISOString() } : item
    ))
  }

  const rejectItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'rejected' } : item
    ))
  }

  const sendToFeed = async (id: string) => {
    setSendingId(id)
    await new Promise(r => setTimeout(r, 800))
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, status: 'sent_to_feed', feedPostId: `feed-${Date.now()}` }
        : item
    ))
    setSendingId(null)
  }

  const filtered = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    return true
  })

  // Stats
  const stats = {
    total:    items.length,
    draft:    items.filter(i => i.status === 'draft').length,
    approved: items.filter(i => i.status === 'approved').length,
    inFeed:   items.filter(i => i.status === 'sent_to_feed').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-500/10 border border-orange-500/30">
              <Trophy className="h-4 w-4 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#E8E8E8]">Finals Pool</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 uppercase tracking-widest">
              → Feed
            </span>
          </div>
          <p className="text-[#A8A8A8] text-sm ml-11">
            Final content staging area. Approve items to push them into the Feed pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-sm text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/15 transition-all"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <Link
            href="/factory/coordinator"
            className="flex items-center gap-2 px-3 py-2 border border-amber-500/30 bg-amber-500/8 text-sm text-amber-400 hover:bg-amber-500/15 transition-all"
          >
            Run Coordinator →
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-[#D0D0D0]' },
          { label: 'Draft',    value: stats.draft,    color: 'text-[#A8A8A8]' },
          { label: 'Approved', value: stats.approved, color: 'text-[#00E085]' },
          { label: 'In Feed',  value: stats.inFeed,   color: 'text-orange-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-md px-3 py-3 text-center">
            <div className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</div>
            <div className="text-[10px] text-[#6E6E6E] uppercase tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[#6E6E6E] shrink-0" />

        <div className="flex gap-1">
          {(['all', 'draft', 'approved', 'sent_to_feed', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-all',
                filterStatus === s
                  ? 'bg-white/[0.08] text-[#E8E8E8]'
                  : 'text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05]'
              )}
            >
              {s === 'all' ? 'All Status' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.05]" />

        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium transition-all',
              filterCategory === 'all' ? 'bg-white/[0.08] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05]'
            )}
          >
            All Categories
          </button>
          {(Object.entries(CATEGORY_META) as [ContentCategory, typeof CATEGORY_META[ContentCategory]][]).map(([key, m]) => {
            const Icon = m.icon
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-all',
                  filterCategory === key ? 'bg-white/[0.08] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05]'
                )}
              >
                <Icon className={cn('h-3 w-3', filterCategory === key ? m.color : 'text-[#6E6E6E]')} />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-10 flex flex-col items-center justify-center text-center">
            <Trophy className="h-8 w-8 text-[#404040] mb-3" />
            <p className="text-sm text-[#6E6E6E]">No items match your filters</p>
            <p className="text-xs text-[#404040] mt-1">Run the Coordinator to generate content</p>
          </div>
        ) : (
          filtered.map(item => {
            const catMeta = CATEGORY_META[item.category]
            const statusMeta = STATUS_CONFIG[item.status]
            const CatIcon = catMeta.icon
            const StatusIcon = statusMeta.icon
            const isExpanded = expandedItem === item.id
            const isSending = sendingId === item.id

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border bg-white/[0.03] backdrop-blur-md transition-all overflow-hidden',
                  isExpanded ? 'border-white/15' : 'border-white/10 hover:border-white/15'
                )}
              >
                {/* Item Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    className="shrink-0"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-[#A8A8A8]" />
                      : <ChevronRight className="h-4 w-4 text-[#A8A8A8]" />
                    }
                  </button>

                  <CatIcon className={cn('h-4 w-4 shrink-0', catMeta.color)} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8E8E8] truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#6E6E6E] font-mono">{item.id}</span>
                      <span className="text-[10px] text-[#404040]">·</span>
                      <span className="text-[10px] text-[#6E6E6E]">{item.templateId}</span>
                      <span className="text-[10px] text-[#404040]">·</span>
                      <span className="text-[10px] text-[#6E6E6E]">{new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={cn(
                    'flex items-center gap-1.5 px-2 py-1 border text-[11px] font-semibold shrink-0',
                    statusMeta.bg, statusMeta.border, statusMeta.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {statusMeta.label}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === 'draft' && (
                      <>
                        <button
                          onClick={() => approveItem(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-[#00E085]/35 bg-green-500/8 text-[#00E085] text-xs font-medium hover:bg-green-500/15 transition-all"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => rejectItem(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <button
                        onClick={() => sendToFeed(item.id)}
                        disabled={isSending}
                        className="flex items-center gap-1 px-3 py-1.5 border border-orange-500/30 bg-orange-500/8 text-orange-400 text-xs font-bold hover:bg-orange-500/15 transition-all disabled:opacity-50"
                      >
                        {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        Push to Feed
                      </button>
                    )}
                    {item.status === 'sent_to_feed' && item.feedPostId && (
                      <Link
                        href="/feed/incoming"
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-white/15 text-[#A8A8A8] text-xs hover:text-[#D0D0D0] transition-all"
                      >
                        <ExternalLink className="h-3 w-3" /> View in Feed
                      </Link>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/10 space-y-3">
                    <div className="grid grid-cols-3 gap-3 pt-3">
                      <div className="px-3 py-2 bg-black border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Category</div>
                        <div className="flex items-center gap-1.5">
                          <CatIcon className={cn('h-3 w-3', catMeta.color)} />
                          <span className="text-xs text-[#E8E8E8]">{catMeta.label}</span>
                        </div>
                      </div>
                      <div className="px-3 py-2 bg-black border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Template</div>
                        <span className="text-xs text-[#E8E8E8]">{item.templateId}</span>
                      </div>
                      <div className="px-3 py-2 bg-black border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Source Cluster</div>
                        <span className="text-xs text-[#A8A8A8] font-mono">{item.clusterId}</span>
                      </div>
                    </div>

                    {item.writerContent && (
                      <div className="px-3 py-3 bg-black border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-2">Content Preview</div>
                        <p className="text-sm text-[#D0D0D0] leading-relaxed">{item.writerContent}</p>
                      </div>
                    )}

                    {item.approvedAt && (
                      <p className="text-[10px] text-[#404040]">
                        Approved at {new Date(item.approvedAt).toLocaleString()}
                        {item.feedPostId && ` · Feed ID: ${item.feedPostId}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
