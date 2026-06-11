'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronUp, GitMerge, Radio, Rss, CheckCircle2,
  AlertCircle, Filter, Zap, Hash, Database, TrendingUp,
} from 'lucide-react'

export default function NormalizationPage() {
  const [activeTab, setActiveTab] = useState<'incoming' | 'normalized' | 'rejected' | 'metrics'>('incoming')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Mock data - would be replaced with real data from backend
  const [items, setItems] = useState({
    incoming: [
      {
        id: 'droppz_001',
        source: 'droppz',
        title: 'Drake - Certified Lover Boy',
        type: 'single_release',
        artist: 'Drake',
        timestamp: '2026-05-11T10:30:00Z',
        priority: 85,
      },
      {
        id: 'feed_001',
        source: 'feed',
        title: 'Kendrick Lamar New Album Announcement',
        type: 'rap_music',
        artist: 'Kendrick Lamar',
        timestamp: '2026-05-11T09:15:00Z',
        priority: 90,
      },
    ],
    normalized: [
      {
        id: 'uef_001',
        scoutSource: 'droppz',
        eventType: 'SINGLE_RELEASE',
        eventCategory: 'release',
        title: 'Drake - Certified Lover Boy',
        primaryEntity: {
          type: 'artist',
          canonicalId: 'artist_drake',
          canonicalName: 'Drake',
        },
        priority: 85,
        priorityLevel: 'HIGH',
        sourcePlatform: 'SPOTIFY',
        timestamp: '2026-05-11T10:30:00Z',
        dedupSignature: {
          entitySig: 'a1b2c3d4e5f6g7h8',
          eventSig: 'x9y8z7w6v5u4t3s2',
          timeBucket: '2026-05-11',
        },
        qualityScore: 98,
      },
      {
        id: 'uef_002',
        scoutSource: 'feed',
        eventType: 'NEWS',
        eventCategory: 'content',
        title: 'Kendrick Lamar New Album Announcement',
        primaryEntity: {
          type: 'artist',
          canonicalId: 'artist_kendrick',
          canonicalName: 'Kendrick Lamar',
        },
        priority: 90,
        priorityLevel: 'HIGH',
        sourcePlatform: 'BLOG',
        timestamp: '2026-05-11T09:15:00Z',
        dedupSignature: {
          entitySig: 'k1e2n3d4r5i6c7k8',
          eventSig: 'a8n9n0o1u2n3c4e5',
          timeBucket: '2026-05-11',
        },
        qualityScore: 95,
      },
    ],
    rejected: [
      {
        id: 'rejected_001',
        source: 'feed',
        reason: 'Missing primary entity',
        title: 'Generic Music News',
        timestamp: '2026-05-11T08:00:00Z',
      },
    ],
    metrics: {
      totalProcessed: 152,
      normalized: 148,
      rejected: 4,
      successRate: 97.4,
      avgProcessingTime: 234,
      droppzCount: 76,
      feedCount: 72,
      avgQualityScore: 96.2,
    },
  })

  const stats = {
    incoming: items.incoming.length,
    normalized: items.normalized.length,
    rejected: items.rejected.length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <GitMerge className="h-8 w-8 text-blue-400" />
          <h1 className="text-3xl font-bold text-[#E8E8E8]">Normalization Layer</h1>
        </div>
        <p className="text-sm text-[#A8A8A8]">
          Universal Event Format (UEF) conversion pipeline — transforms DroppZ and Feed outputs into canonical schema
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <PipelineCard
          label="Incoming"
          value={stats.incoming}
          icon={<TrendingUp className="h-5 w-5" />}
          color="blue"
          onClick={() => setActiveTab('incoming')}
          active={activeTab === 'incoming'}
        />
        <PipelineCard
          label="Normalized"
          value={stats.normalized}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
          onClick={() => setActiveTab('normalized')}
          active={activeTab === 'normalized'}
        />
        <PipelineCard
          label="Rejected"
          value={stats.rejected}
          icon={<AlertCircle className="h-5 w-5" />}
          color="red"
          onClick={() => setActiveTab('rejected')}
          active={activeTab === 'rejected'}
        />
        <PipelineCard
          label="Metrics"
          value={`${items.metrics.successRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="purple"
          onClick={() => setActiveTab('metrics')}
          active={activeTab === 'metrics'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
        {(['incoming', 'normalized', 'rejected', 'metrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'incoming' && (
          <IncomingTab items={items.incoming} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}
        {activeTab === 'normalized' && (
          <NormalizedTab items={items.normalized} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}
        {activeTab === 'rejected' && (
          <RejectedTab items={items.rejected} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}
        {activeTab === 'metrics' && <MetricsTab data={items.metrics} />}
      </div>
    </div>
  )
}

function PipelineCard({
  label,
  value,
  icon,
  color,
  active,
  onClick,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'red' | 'purple'
  active: boolean
  onClick: () => void
}) {
  const colors = {
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    green: 'bg-green-500/20 border-green-500/50 text-[#00E085]',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  }

  return (
    <button
      onClick={onClick}
      className={`p-4 border transition-all cursor-pointer ${
        active
          ? `${colors[color]} shadow-lg`
          : 'bg-white/[0.03] border-white/10 hover:border-white/15'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#A8A8A8] mb-1">{label}</p>
          <p className={`text-2xl font-bold ${active ? 'text-white' : 'text-[#E8E8E8]'}`}>
            {value}
          </p>
        </div>
        <div className={active ? colors[color] : 'text-[#6E6E6E]'}>{icon}</div>
      </div>
    </button>
  )
}

function IncomingTab({
  items,
  expandedId,
  setExpandedId,
}: {
  items: any[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#E8E8E8]">Scout Outputs (Raw)</h2>
        <div className="text-sm text-[#A8A8A8]">
          DroppZ: {items.filter((i) => i.source === 'droppz').length} | Feed:{' '}
          {items.filter((i) => i.source === 'feed').length}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-[#A8A8A8]">
          <p>No incoming items</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full p-4 hover:bg-white/[0.04] transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4 flex-1 text-left">
                <div className="flex items-center gap-2">
                  {item.source === 'droppz' ? (
                    <Radio className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Rss className="h-4 w-4 text-orange-400" />
                  )}
                  <span className="text-xs font-mono text-[#A8A8A8] uppercase">{item.source}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#E8E8E8]">{item.title}</p>
                  <p className="text-xs text-[#A8A8A8] mt-1">
                    {item.artist} • {item.type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    P: {item.priority}
                  </span>
                </div>
              </div>
              {expandedId === item.id ? (
                <ChevronUp className="h-4 w-4 text-[#6E6E6E]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6E6E6E]" />
              )}
            </button>

            {expandedId === item.id && (
              <div className="bg-white/[0.03] border-t border-white/10 p-4 text-sm text-[#A8A8A8] space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#6E6E6E]">Timestamp:</span>
                    <p className="text-[#D0D0D0] font-mono">{item.timestamp}</p>
                  </div>
                  <div>
                    <span className="text-[#6E6E6E]">Type:</span>
                    <p className="text-[#D0D0D0] font-mono">{item.type}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function NormalizedTab({
  items,
  expandedId,
  setExpandedId,
}: {
  items: any[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#E8E8E8]">Normalized Events (UEF)</h2>
        <div className="text-sm text-[#A8A8A8]">
          Avg Quality: {(items.reduce((a, i) => a + i.qualityScore, 0) / items.length).toFixed(1)}%
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-[#A8A8A8]">
          <p>No normalized items</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full p-4 hover:bg-white/[0.04] transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
                  <span className="text-xs font-mono text-[#A8A8A8] uppercase">{item.scoutSource}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#E8E8E8]">{item.title}</p>
                  <p className="text-xs text-[#A8A8A8] mt-1">
                    {item.primaryEntity.canonicalName} • {item.eventType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-green-500/20 text-[#00E085] px-2 py-1 rounded">
                    {item.qualityScore}%
                  </span>
                  <span className={`text-xs font-mono px-2 py-1 ${
                    item.priorityLevel === 'CRITICAL'
                      ? 'bg-red-500/20 text-red-400'
                      : item.priorityLevel === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {item.priorityLevel}
                  </span>
                </div>
              </div>
              {expandedId === item.id ? (
                <ChevronUp className="h-4 w-4 text-[#6E6E6E]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6E6E6E]" />
              )}
            </button>

            {expandedId === item.id && (
              <div className="bg-white/[0.03] border-t border-white/10 p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-[#A8A8A8] mb-2">Entity Mapping</h4>
                  <div className="bg-white/[0.03] p-2 text-xs text-[#D0D0D0] font-mono">
                    <p>
                      <span className="text-[#6E6E6E]">Canonical ID:</span> {item.primaryEntity.canonicalId}
                    </p>
                    <p>
                      <span className="text-[#6E6E6E]">Name:</span> {item.primaryEntity.canonicalName}
                    </p>
                    <p>
                      <span className="text-[#6E6E6E]">Type:</span> {item.primaryEntity.type}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-[#A8A8A8] mb-2">Dedup Signature</h4>
                    <div className="bg-white/[0.03] p-2 text-xs text-[#D0D0D0] space-y-1">
                      <div className="font-mono text-[10px] break-all">
                        <span className="text-[#6E6E6E]">Entity:</span> {item.dedupSignature.entitySig}
                      </div>
                      <div className="font-mono text-[10px] break-all">
                        <span className="text-[#6E6E6E]">Event:</span> {item.dedupSignature.eventSig}
                      </div>
                      <div className="font-mono text-[#A8A8A8]">
                        Bucket: {item.dedupSignature.timeBucket}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[#A8A8A8] mb-2">Event Metadata</h4>
                    <div className="bg-white/[0.03] p-2 text-xs text-[#D0D0D0] space-y-1 font-mono">
                      <div>
                        <span className="text-[#6E6E6E]">Platform:</span> {item.sourcePlatform}
                      </div>
                      <div>
                        <span className="text-[#6E6E6E]">Category:</span> {item.eventCategory}
                      </div>
                      <div className="text-[10px] text-[#A8A8A8]">{item.timestamp}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-[#A8A8A8] mb-2">Transformation Path</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-white/[0.05] px-2 py-1 text-[#D0D0D0]">
                      {item.scoutSource === 'droppz' ? 'DroppZ' : 'Feed'} Output
                    </span>
                    <span className="text-[#6E6E6E]">→</span>
                    <span className="bg-white/[0.05] px-2 py-1 text-[#D0D0D0]">Entity Norm</span>
                    <span className="text-[#6E6E6E]">→</span>
                    <span className="bg-white/[0.05] px-2 py-1 text-[#D0D0D0]">Type Map</span>
                    <span className="text-[#6E6E6E]">→</span>
                    <span className="bg-white/[0.05] px-2 py-1 text-[#1AEE99]">UEF</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function RejectedTab({
  items,
  expandedId,
  setExpandedId,
}: {
  items: any[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#E8E8E8]">Rejected Items (Quality Filter)</h2>
        <div className="text-sm text-[#A8A8A8]">Failed quality checks: {items.length}</div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-[#A8A8A8]">
          <p>No rejected items</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-lg border border-red-800/50 bg-red-900/20 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full p-4 hover:bg-red-800/30 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4 flex-1 text-left">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#E8E8E8]">{item.title}</p>
                  <p className="text-xs text-red-400 mt-1">Rejection: {item.reason}</p>
                </div>
              </div>
              {expandedId === item.id ? (
                <ChevronUp className="h-4 w-4 text-[#6E6E6E]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6E6E6E]" />
              )}
            </button>

            {expandedId === item.id && (
              <div className="bg-red-800/20 border-t border-red-800/50 p-4 text-sm text-[#A8A8A8] space-y-2">
                <div>
                  <span className="text-[#6E6E6E]">Reason:</span>
                  <p className="text-red-400 font-mono">{item.reason}</p>
                </div>
                <div>
                  <span className="text-[#6E6E6E]">Source:</span>
                  <p className="text-[#D0D0D0] font-mono">{item.source}</p>
                </div>
                <div>
                  <span className="text-[#6E6E6E]">Rejected At:</span>
                  <p className="text-[#D0D0D0] font-mono text-xs">{item.timestamp}</p>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function MetricsTab({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Total Processed" value={data.totalProcessed} icon={Database} />
        <MetricCard label="Successfully Normalized" value={data.normalized} icon={CheckCircle2} />
        <MetricCard label="Success Rate" value={`${data.successRate}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCard label="Avg Processing Time" value={`${data.avgProcessingTime}ms`} icon={Zap} />
        <MetricCard label="Avg Quality Score" value={`${data.avgQualityScore}%`} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="DroppZ Outputs" value={data.droppzCount} icon={Radio} />
        <MetricCard label="Feed Outputs" value={data.feedCount} icon={Rss} />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#E8E8E8]">Pipeline Flow</h3>
        <div className="space-y-2 text-xs text-[#A8A8A8]">
          <div className="flex items-center gap-2">
            <div className="w-20">DroppZ Scout</div>
            <div className="flex-1 bg-blue-500/20 h-2 rounded" style={{ width: '50%' }} />
            <div className="w-12 text-right">{data.droppzCount}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20">Feed Scout</div>
            <div className="flex-1 bg-orange-500/20 h-2 rounded" style={{ width: '47%' }} />
            <div className="w-12 text-right">{data.feedCount}</div>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <p className="text-[#A8A8A8]">
              Normalization converts heterogeneous scout outputs to Universal Event Format (UEF),
              ready for Final Pool and Cluster Engine.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[#A8A8A8] font-medium">{label}</p>
        <Icon className="h-4 w-4 text-[#6E6E6E]" />
      </div>
      <p className="text-2xl font-bold text-[#E8E8E8]">{value}</p>
    </div>
  )
}
