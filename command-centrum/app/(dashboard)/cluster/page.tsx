'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GitMerge, Zap, TrendingUp,
  ChevronDown, ChevronRight, RefreshCw,
  AlertCircle, Play, Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types from Python Cluster Engine
type ClusterItem = {
  id: string
  type: string
  title: string
  artists: string[]
  publish_date: string
  priority_score: number
  links: string[]
}

type ClusterRelationship = {
  from_item_id: string
  to_item_id: string
  type: string
  confidence: number
  reason: string
}

type Cluster = {
  id: string
  type: string
  name: string
  status: string
  quality: string
  items_count: number
  relationships_count: number
  coherence: number
  diversity: number
  engagement: number
  entities: string[]
  items: ClusterItem[]
  relationships: ClusterRelationship[]
}

type PoolStats = {
  approved: number
  incoming: number
}

type ClusterResults = {
  status: string
  batch_id?: string
  clusters: Cluster[]
  total_clusters?: number
  total_items: number
  total_relationships: number
  pool_stats: PoolStats
  generated_at?: string
  message?: string
}

// Kept for when pool is empty — shows the system is ready
const EMPTY_CLUSTERS: Cluster[] = []

const CLUSTER_QUALITY_COLORS = {
  gold: 'text-yellow-400 bg-yellow-400/10',
  silver: 'text-slate-300 bg-slate-300/10',
  bronze: 'text-orange-400 bg-orange-400/10',
}

const CLUSTER_TYPE_ICONS = {
  artist: '👤',
  collaboration: '🤝',
  drama: '⚡',
  temporal: '📅',
  trending: '🔥',
}

export default function ClusterPage() {
  const [clusters, setClusters] = useState<Cluster[]>(EMPTY_CLUSTERS)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterQuality, setFilterQuality] = useState('all')
  const [expandedItems, setExpandedItems] = useState(new Set<string>())
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [poolStats, setPoolStats] = useState<PoolStats>({ approved: 0, incoming: 0 })
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadResults = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cluster/pool')
      const data: ClusterResults = await res.json()
      setClusters(data.clusters ?? [])
      setPoolStats(data.pool_stats ?? { approved: 0, incoming: 0 })
      if (data.generated_at) setLastRun(data.generated_at)
      if (data.clusters?.length > 0 && !selectedCluster) {
        setSelectedCluster(data.clusters[0])
      }
    } catch (err) {
      setError('Failed to load cluster results')
    } finally {
      setIsLoading(false)
    }
  }, [selectedCluster])

  const runPipeline = async () => {
    setIsRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/cluster/pool', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Pipeline failed')
      }
      const data: ClusterResults = await res.json()
      setClusters(data.clusters ?? [])
      setPoolStats(data.pool_stats ?? { approved: 0, incoming: 0 })
      if (data.generated_at) setLastRun(data.generated_at)
      if (data.clusters?.length > 0) setSelectedCluster(data.clusters[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline run failed')
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    loadResults()
  }, [])

  // Filter clusters
  const filteredClusters = clusters.filter((cluster) => {
    const matchesSearch =
      cluster.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cluster.entities.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = filterType === 'all' || cluster.type === filterType
    const matchesQuality = filterQuality === 'all' || cluster.quality === filterQuality
    return matchesSearch && matchesType && matchesQuality
  })

  const toggleItem = (itemId: string) => {
    const newSet = new Set(expandedItems)
    if (newSet.has(itemId)) {
      newSet.delete(itemId)
    } else {
      newSet.add(itemId)
    }
    setExpandedItems(newSet)
  }

  const handleRefresh = () => loadResults()

  return (
    <div className="flex h-full bg-black">
      {/* Left Panel - Clusters List */}
      <div className="w-96 flex flex-col border-r border-white/10 bg-black">
        {/* Header */}
        <div className="flex-none p-4 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-bold text-[#E8E8E8]">Clusters</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                disabled={isLoading || isRunning}
                className="text-[#A8A8A8] hover:text-[#E8E8E8]"
                title="Refresh results"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={runPipeline}
                disabled={isRunning || isLoading}
                className="text-[#A8A8A8] hover:text-[#00E085]"
                title="Run cluster pipeline against Final Pool"
              >
                <Play className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
          </div>
          {/* Pool status bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-[#A8A8A8]">
              <Database className="w-3 h-3" />
              Pool: <span className="text-[#00E085] font-medium">{poolStats.approved} approved</span>
            </span>
            {lastRun && (
              <span className="text-[#6E6E6E]">
                Last run: {new Date(lastRun).toLocaleTimeString()}
              </span>
            )}
            {isRunning && (
              <span className="text-blue-400 animate-pulse">Running pipeline...</span>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}

          {/* Search */}
          <Input
            placeholder="Search clusters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/[0.03] backdrop-blur-md border-white/15 text-[#E8E8E8] placeholder:text-[#6E6E6E]"
          />

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-white/[0.03] backdrop-blur-md border-white/15 text-[#E8E8E8] h-9 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white/[0.03] backdrop-blur-md border-white/15">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="collaboration">Collaboration</SelectItem>
                <SelectItem value="drama">Drama</SelectItem>
                <SelectItem value="temporal">Temporal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterQuality} onValueChange={setFilterQuality}>
              <SelectTrigger className="bg-white/[0.03] backdrop-blur-md border-white/15 text-[#E8E8E8] h-9 text-xs">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent className="bg-white/[0.03] backdrop-blur-md border-white/15">
                <SelectItem value="all">All Quality</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clusters List */}
        <div className="flex-1 overflow-y-auto">
          {filteredClusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#6E6E6E] gap-3 p-4">
              {clusters.length === 0 ? (
                <>
                  <Database className="w-8 h-8 opacity-40" />
                  <p className="text-sm text-center">
                    {poolStats.approved === 0
                      ? 'Final Pool is empty. Items need to be approved first.'
                      : 'Click ▶ to run the cluster pipeline.'}
                  </p>
                </>
              ) : (
                <p className="text-sm">No clusters match your filters</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {filteredClusters.map((cluster) => (
                <button
                  key={cluster.id}
                  onClick={() => setSelectedCluster(cluster)}
                  className={`w-full text-left p-3 transition-all border ${
                    selectedCluster?.id === cluster.id
                      ? 'bg-white/[0.05] border-blue-500/50 ring-1 ring-blue-500/50'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/15 hover:bg-white/[0.03] backdrop-blur-md'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">
                      {CLUSTER_TYPE_ICONS[cluster.type as keyof typeof CLUSTER_TYPE_ICONS]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#E8E8E8] truncate">
                        {cluster.name}
                      </h3>
                      <p className="text-xs text-[#A8A8A8] mt-0.5">
                        {cluster.items_count} items • {cluster.relationships_count} relations
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 text-xs font-medium ${CLUSTER_QUALITY_COLORS[cluster.quality as keyof typeof CLUSTER_QUALITY_COLORS]}`}>
                      {cluster.quality}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex-none p-3 border-t border-white/10 text-xs text-[#A8A8A8] space-y-1">
          <p>📊 Total: {filteredClusters.length} clusters</p>
          <p>📈 Total items: {filteredClusters.reduce((sum, c) => sum + c.items_count, 0)}</p>
        </div>
      </div>

      {/* Right Panel - Cluster Detail */}
      {!selectedCluster ? (
        <div className="flex-1 flex items-center justify-center bg-black text-[#6E6E6E]">
          <div className="text-center space-y-3">
            <GitMerge className="w-12 h-12 mx-auto opacity-20" />
            <p className="text-sm">
              {clusters.length === 0
                ? 'Run the pipeline to see clusters from Final Pool'
                : 'Select a cluster to view details'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-black">
          {/* Detail Header */}
          <div className="flex-none p-6 border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">
                    {CLUSTER_TYPE_ICONS[selectedCluster.type as keyof typeof CLUSTER_TYPE_ICONS]}
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold text-[#E8E8E8]">
                      {selectedCluster.name}
                    </h2>
                    <p className="text-sm text-[#A8A8A8] mt-1">
                      {selectedCluster.type.charAt(0).toUpperCase() + selectedCluster.type.slice(1)} Cluster • {selectedCluster.status}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1.5 text-sm font-semibold ${CLUSTER_QUALITY_COLORS[selectedCluster.quality as keyof typeof CLUSTER_QUALITY_COLORS]}`}>
                {selectedCluster.quality.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="flex-none grid grid-cols-4 gap-3 p-6 border-b border-white/10">
            <div className="bg-white/[0.03] backdrop-blur-md p-4">
              <div className="text-2xl font-bold text-[#E8E8E8]">{selectedCluster.items_count}</div>
              <p className="text-xs text-[#A8A8A8] mt-1">Items</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-md p-4">
              <div className="text-2xl font-bold text-[#E8E8E8]">{selectedCluster.relationships_count}</div>
              <p className="text-xs text-[#A8A8A8] mt-1">Relationships</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-md p-4">
              <div className="text-2xl font-bold text-[#00E085]">{selectedCluster.coherence}%</div>
              <p className="text-xs text-[#A8A8A8] mt-1">Coherence</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-md p-4">
              <div className="text-2xl font-bold text-purple-400">{selectedCluster.engagement}%</div>
              <p className="text-xs text-[#A8A8A8] mt-1">Engagement</p>
            </div>
          </div>

          {/* Entities */}
          <div className="flex-none p-6 border-b border-white/10">
            <h3 className="text-sm font-semibold text-[#E8E8E8] mb-3">Primary Entities</h3>
            <div className="flex flex-wrap gap-2">
              {selectedCluster.entities.map((entity, idx) => (
                <div key={idx} className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium">
                  {entity}
                </div>
              ))}
            </div>
          </div>

          {/* Content Items */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-semibold text-[#E8E8E8] mb-4">Content Items</h3>
            <div className="space-y-2">
              {selectedCluster.items.map((item) => {
                // Find relationships involving this item
                const related = selectedCluster.relationships.filter(
                  r => r.from_item_id === item.id || r.to_item_id === item.id
                )
                return (
                  <div key={item.id} className="bg-white/[0.03] backdrop-blur-md p-3 border border-white/10">
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-none">
                          {expandedItems.has(item.id)
                            ? <ChevronDown className="w-4 h-4 text-[#A8A8A8]" />
                            : <ChevronRight className="w-4 h-4 text-[#A8A8A8]" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-[#E8E8E8] truncate">{item.title}</p>
                          <p className="text-xs text-[#A8A8A8]">
                            {item.type} {item.artists.length > 0 && `• ${item.artists.slice(0, 2).join(', ')}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs bg-white/[0.05] px-2 py-1 text-[#A8A8A8] flex-none">
                        {item.priority_score}/100
                      </span>
                    </button>

                    {expandedItems.has(item.id) && (
                      <div className="mt-3 pt-3 border-t border-white/10 text-xs text-[#A8A8A8] space-y-2">
                        <p><strong>Published:</strong> {new Date(item.publish_date).toLocaleDateString()}</p>
                        <p><strong>Priority Score:</strong> {item.priority_score}/100</p>
                        {item.artists.length > 0 && (
                          <p><strong>Artists:</strong> {item.artists.join(', ')}</p>
                        )}
                        {item.links.length > 0 && (
                          <div>
                            <p className="font-semibold text-[#D0D0D0] mb-1">Links:</p>
                            {item.links.slice(0, 2).map((link, i) => (
                              <a
                                key={i}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-blue-400 hover:text-blue-300 truncate"
                              >
                                {link}
                              </a>
                            ))}
                          </div>
                        )}
                        {related.length > 0 && (
                          <div className="mt-2">
                            <p className="font-semibold text-[#D0D0D0] mb-1">Relationships ({related.length}):</p>
                            <div className="space-y-1 text-[#A8A8A8]">
                              {related.slice(0, 3).map((r, i) => (
                                <p key={i}>• {r.type} — {r.reason} ({Math.round(r.confidence * 100)}%)</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
