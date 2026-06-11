import {
  Radio, Rss, Layers, Archive, Settings as SettingsIcon,
  TrendingUp, Activity, Zap, CheckCircle2,
} from 'lucide-react'
import type { ElementType } from 'react'
import { PipelineDeleteBar } from '@/components/shared/pipeline-delete-bar'
import { createAdminClient, createClient } from '@/lib/supabase/server'

type ModuleCard = {
  name: string
  status: 'active' | 'idle'
  lastRun: string | null
  itemCount: number
  errorCount: number
  uptime: number
}

export default async function ScoutHQOverviewPage() {
  const authClient = await createClient()
  const db = createAdminClient() ?? authClient

  const [
    totalCollectedRes,
    processedRes,
    filteredRes,
    approvedRes,
    queueReadyRes,
    feedCardsRes,
    finalPoolRes,
    scoutErrorsRes,
    scoutRunRes,
  ] = await Promise.all([
    db.from('scout_items').select('*', { count: 'exact', head: true }),
    db.from('scout_items').select('*', { count: 'exact', head: true }).neq('status', 'SCOUTED'),
    db.from('scout_items').select('*', { count: 'exact', head: true }).eq('status', 'discarded'),
    db.from('scout_items').select('*', { count: 'exact', head: true }).eq('status', 'CURATED'),
    db.from('story_clusters').select('*', { count: 'exact', head: true }),
    db.from('feed_posts').select('*', { count: 'exact', head: true }),
    db.from('posts').select('*', { count: 'exact', head: true }).in('status', ['approved', 'draft']),
    db.from('scout_items').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    db.from('scout_runs').select('status,started_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const metrics = {
    totalCollected: totalCollectedRes.count ?? 0,
    processed: processedRes.count ?? 0,
    filtered: filteredRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    queueReady: queueReadyRes.count ?? 0,
  }

  const latestScoutRun = scoutRunRes.data
  const modules: ModuleCard[] = [
    {
      name: 'DroppZ Scout',
      status: latestScoutRun?.status === 'running' ? 'active' : 'idle',
      lastRun: latestScoutRun?.started_at ?? null,
      itemCount: metrics.totalCollected,
      errorCount: scoutErrorsRes.count ?? 0,
      uptime: latestScoutRun?.status === 'running' ? 100 : 99.5,
    },
    {
      name: 'Feed Content Scout',
      status: (feedCardsRes.count ?? 0) > 0 ? 'active' : 'idle',
      lastRun: latestScoutRun?.started_at ?? null,
      itemCount: feedCardsRes.count ?? 0,
      errorCount: 0,
      uptime: (feedCardsRes.count ?? 0) > 0 ? 100 : 0,
    },
    {
      name: 'Final Pool',
      status: (finalPoolRes.count ?? 0) > 0 ? 'active' : 'idle',
      lastRun: latestScoutRun?.started_at ?? null,
      itemCount: finalPoolRes.count ?? 0,
      errorCount: 0,
      uptime: (finalPoolRes.count ?? 0) > 0 ? 100 : 0,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#E8E8E8]">SCOUT HQ</h1>
        <p className="text-sm text-[#A8A8A8]">Intelligence control center for SCOUT HQ</p>
      </div>

      <PipelineDeleteBar mode="scout" />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <MetricCard label="Total Collected" value={metrics.totalCollected} icon={TrendingUp} color="text-blue-400" />
        <MetricCard label="Processed" value={metrics.processed} icon={Activity} color="text-[#00E085]" />
        <MetricCard label="Filtered" value={metrics.filtered} icon={Zap} color="text-yellow-400" />
        <MetricCard label="Approved" value={metrics.approved} icon={CheckCircle2} color="text-[#00E085]" />
        <MetricCard label="Queue Ready" value={metrics.queueReady} icon={TrendingUp} color="text-purple-400" highlight />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[#E8E8E8] mb-3">Module Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modules.map((module) => (
            <div key={module.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#E8E8E8]">{module.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    module.status === 'active'
                      ? 'bg-green-900/30 text-[#1AEE99]'
                      : 'bg-yellow-900/30 text-yellow-300'
                  }`}
                >
                  {module.status === 'active' ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#A8A8A8]">
                  <span>Last Run:</span>
                  <span>{timeAgo(module.lastRun)}</span>
                </div>
                <div className="flex justify-between text-[#A8A8A8]">
                  <span>Items:</span>
                  <span className="font-mono">{module.itemCount}</span>
                </div>
                <div className="flex justify-between text-[#A8A8A8]">
                  <span>Errors:</span>
                  <span className={module.errorCount > 0 ? 'text-red-400' : 'text-[#00E085]'}>{module.errorCount}</span>
                </div>
                <div className="flex justify-between text-[#A8A8A8]">
                  <span>Uptime:</span>
                  <span className="font-mono">{module.uptime.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[#E8E8E8] mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <QuickLinkCard label="DroppZ Scout" href="/scout-hq/droppz" icon={Radio} description="Music release monitoring" />
          <QuickLinkCard label="Feed Content Scout" href="/scout-hq/feed" icon={Rss} description="Content intelligence" />
          <QuickLinkCard label="Final Pool" href="/scout-hq/pool" icon={Layers} description="Unified aggregation" />
          <QuickLinkCard label="Storage Explorer" href="/scout-hq/storage" icon={Archive} description="Search & export" />
          <QuickLinkCard label="Settings" href="/scout-hq/settings" icon={SettingsIcon} description="Configuration" />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  highlight,
}: {
  label: string
  value: number
  icon: ElementType
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border ${
        highlight ? 'border-purple-800 bg-purple-900/20' : 'border-white/10 bg-white/[0.03]'
      } p-4`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs font-medium text-[#A8A8A8] uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function QuickLinkCard({
  label,
  href,
  icon: Icon,
  description,
}: {
  label: string
  href: string
  icon: ElementType
  description: string
}) {
  return (
    <a
      href={href}
      className="group border border-white/10 bg-white/[0.03] p-3 hover:border-blue-700 hover:bg-blue-900/20 transition-all duration-150"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
        <span className="font-medium text-sm text-[#E8E8E8] group-hover:text-[#E8E8E8]">{label}</span>
      </div>
      <p className="text-xs text-[#A8A8A8] group-hover:text-[#A8A8A8]">{description}</p>
    </a>
  )
}

function timeAgo(input: string | null): string {
  if (!input) return 'never'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return 'never'

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
