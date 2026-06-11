'use client'

import { useState } from 'react'
import { ExternalLink, Zap, TrendingUp, Users, Eye, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoutItem {
  id: string
  title: string
  source: string
  category: string
  momentum: number          // 0-100: entertainment/shock value
  entities: number          // entity count
  links: number             // cross-references
  relevance: number         // 0-100
  viralScore: number        // 0-100: keep human scrolling
  status: 'fresh' | 'curated' | 'clustered' | 'enriched'
  url: string
  timestamp: string
}

interface ScoutResultsProps {
  items: ScoutItem[]
  isLoading?: boolean
  onViewDetails?: (item: ScoutItem) => void
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ScoutResults({ items, isLoading, onViewDetails }: ScoutResultsProps) {
  const [sortBy, setSortBy] = useState<'viral' | 'momentum' | 'fresh'>('viral')
  const [filterStatus, setFilterStatus] = useState<'all' | 'fresh' | 'curated' | 'clustered' | 'enriched'>('all')

  const filtered = items.filter(item => filterStatus === 'all' || item.status === filterStatus)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'viral') return b.viralScore - a.viralScore
    if (sortBy === 'momentum') return b.momentum - a.momentum
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const stats = {
    total: sorted.length,
    avgMomentum: sorted.length ? Math.round(sorted.reduce((s, i) => s + i.momentum, 0) / sorted.length) : 0,
    avgViral: sorted.length ? Math.round(sorted.reduce((s, i) => s + i.viralScore, 0) / sorted.length) : 0,
    sources: new Set(sorted.map(i => i.source)).size,
  }

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div>
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-3">Scout Results</h3>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatCard label="Total Items" value={stats.total} icon={Eye} />
          <StatCard label="Avg Momentum" value={`${stats.avgMomentum}%`} icon={TrendingUp} />
          <StatCard label="Avg Viral" value={`${stats.avgViral}%`} icon={Zap} />
          <StatCard label="Sources" value={stats.sources} icon={Users} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['viral', 'momentum', 'fresh'] as const).map(sort => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={cn(
                'text-xs px-2 py-1 border transition-colors',
                sortBy === sort
                  ? 'border-venom-500/50 bg-venom-500/20 text-venom-300'
                  : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
              )}
            >
              Sort: {sort}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['all', 'fresh', 'curated', 'clustered', 'enriched'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'text-xs px-2 py-1 border transition-colors',
                filterStatus === status
                  ? 'border-green-500/50 bg-green-500/20 text-[#1AEE99]'
                  : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] backdrop-blur-md">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#A8A8A8]">Title</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#A8A8A8]">Source</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-[#A8A8A8]">Momentum</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-[#A8A8A8]">Viral</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-[#A8A8A8]">Entities</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-[#A8A8A8]">Status</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-[#A8A8A8]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#A8A8A8]">
                  Loading scout results...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#A8A8A8]">
                  No items found
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-2 max-w-xs truncate text-[#D0D0D0] text-xs">
                    {item.title}
                  </td>
                  <td className="px-4 py-2 text-[#A8A8A8] text-xs">
                    {item.source}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <MomentumBadge value={item.momentum} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <ViralBadge value={item.viralScore} />
                  </td>
                  <td className="px-4 py-2 text-center text-[#A8A8A8] text-xs">
                    {item.entities}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-1 hover:bg-white/[0.05] transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#A8A8A8] hover:text-[#D0D0D0]" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: {
  label: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#A8A8A8]" />
      <div className="min-w-0">
        <p className="text-[10px] text-[#A8A8A8] truncate">{label}</p>
        <p className="text-sm font-bold text-[#E8E8E8]">{value}</p>
      </div>
    </div>
  )
}

// ─── Badge: Momentum ───────────────────────────────────────────────────────────

function MomentumBadge({ value }: { value: number }) {
  const color = value >= 75 ? 'text-[#00E085] bg-[rgba(0,224,133,0.10)] border-[#00E085]/35' :
                value >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                             'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 border text-xs font-mono', color)}>
      {value}%
    </span>
  )
}

// ─── Badge: Viral Score ───────────────────────────────────────────────────────

function ViralBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'text-venom-400 bg-venom-500/10 border-venom-500/30' :
                value >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                             'text-[#A8A8A8] bg-white/[0.12] border-white/20'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 border text-xs font-mono', color)}>
      <Zap className="h-3 w-3" /> {value}
    </span>
  )
}

// ─── Badge: Status ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    fresh: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    curated: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    clustered: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    enriched: 'text-[#00E085] bg-[rgba(0,224,133,0.10)] border-[#00E085]/35',
  }
  return (
    <span className={cn('inline-block px-2 py-1 border text-xs font-semibold', colors[status] || colors.fresh)}>
      {status}
    </span>
  )
}
