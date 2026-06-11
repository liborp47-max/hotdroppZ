'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Zap, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type StoryPackage = {
  story_id: string
  cluster_ids: string[]
  story_type: string
  headline: string
  narrative: {
    hook: string
    context: string
    key_developments: string[]
    current_state: string
  }
  key_facts: Array<{
    headline: string
    detail: string
    importance: number
    source_items: string[]
  }>
  assets: Array<{
    type: string
    content: string
    label: string
    source?: string
  }>
  primary_entities: string[]
  secondary_entities: string[]
  tone: string
  audience_interest: number
  generated_at: string
}

type StoryBuilderResult = {
  status: 'empty' | 'ok' | 'error'
  stories?: StoryPackage[]
  total_stories?: number
  message?: string
  error?: string
}

export default function StoryBuilderPage() {
  const [stories, setStories] = useState<StoryPackage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedStory, setExpandedStory] = useState<string | null>(null)

  const loadStories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/story-builder/stories')
      const data: StoryBuilderResult = await res.json()

      if (data.status === 'error' || !data.stories) {
        setStories([])
        return
      }

      setStories(data.stories || [])
    } catch (err) {
      setError('Failed to load stories')
      setStories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runStoryBuilder = async () => {
    setIsRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/story-builder/stories?max_stories=10', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Story builder failed')
      }
      const data: StoryBuilderResult = await res.json()
      setStories(data.stories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Story builder run failed')
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    void loadStories()
  }, [loadStories])

  const getStoryColor = (type: string) => {
    const colors: Record<string, string> = {
      artist_ecosystem: 'text-blue-400 bg-blue-400/10',
      collaboration: 'text-purple-400 bg-purple-400/10',
      drama: 'text-red-400 bg-red-400/10',
      trend: 'text-yellow-400 bg-yellow-400/10',
      release: 'text-[#00E085] bg-[#1AEE99]/10',
      comeback: 'text-indigo-400 bg-indigo-400/10',
      beef: 'text-orange-400 bg-orange-400/10',
      milestone: 'text-cyan-400 bg-cyan-400/10',
    }
    return colors[type] || 'text-[#A8A8A8] bg-white/[0.06]'
  }

  const getToneColor = (tone: string) => {
    const colors: Record<string, string> = {
      news: 'bg-blue-500/20 border-blue-500/40',
      hype: 'bg-purple-500/20 border-purple-500/40',
      editorial: 'bg-amber-500/20 border-amber-500/40',
      analysis: 'bg-green-500/20 border-green-500/40',
    }
    return colors[tone] || 'bg-white/[0.12] border-white/20'
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-8 h-8 bg-green-500/15">
              <Zap className="h-4 w-4 text-[#00E085]" />
            </div>
            <h1 className="text-2xl font-bold text-[#E8E8E8]">Story Builder</h1>
          </div>
          <p className="text-sm text-[#A8A8A8]">
            Transform clusters into narrative story packages ready for Writer Engine
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void loadStories()}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-semibold border transition-colors',
              isLoading
                ? 'text-[#A8A8A8] border-white/10 bg-white/[0.025] cursor-not-allowed'
                : 'bg-white/[0.05] hover:bg-white/[0.05] text-[#D0D0D0] border-white/15'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Reload
          </button>
          <button
            onClick={() => void runStoryBuilder()}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-bold shadow-lg transition-colors',
              isRunning
                ? 'bg-white/[0.05] text-[#A8A8A8] shadow-none cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/25',
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                BUILDING...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                BUILD STORIES
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Status */}
      <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#A8A8A8]">Stories Generated</span>
          <span className="text-lg font-bold text-[#E8E8E8]">{stories.length}</span>
        </div>
      </div>

      {/* Stories List */}
      <div className="space-y-3">
        {isLoading && !stories.length ? (
          <div className="flex items-center gap-2 py-8 justify-center text-[#6E6E6E]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stories...
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-[#A8A8A8]">No stories generated yet</p>
            <p className="text-xs text-[#404040] mt-1">Run Story Builder to generate story packages from clusters</p>
          </div>
        ) : (
          stories.map((story) => (
            <div
              key={story.story_id}
              className="rounded-lg border border-white/10 bg-white/[0.025] overflow-hidden"
            >
              {/* Story Header */}
              <button
                onClick={() => setExpandedStory(expandedStory === story.story_id ? null : story.story_id)}
                className="w-full flex items-start justify-between gap-3 p-4 hover:bg-white/[0.05] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('px-2 py-0.5 text-xs font-semibold', getStoryColor(story.story_type))}>
                      {story.story_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={cn('px-2 py-0.5 text-xs font-medium border', getToneColor(story.tone))}>
                      {story.tone}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[#E8E8E8] line-clamp-2">{story.headline}</h3>
                  <p className="text-xs text-[#A8A8A8] mt-1 line-clamp-2">{story.narrative.hook}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#6E6E6E]">
                    <span>🎯 Interest: {story.audience_interest}%</span>
                    <span>📋 Facts: {story.key_facts.length}</span>
                    <span>🏷️ Entities: {story.primary_entities.length}</span>
                  </div>
                </div>

                {expandedStory === story.story_id
                  ? <ChevronDown className="h-4 w-4 text-[#6E6E6E] shrink-0 mt-1" />
                  : <ChevronRight className="h-4 w-4 text-[#6E6E6E] shrink-0 mt-1" />
                }
              </button>

              {/* Expanded Content */}
              {expandedStory === story.story_id && (
                <div className="border-t border-white/10 p-4 space-y-4 bg-black/40 backdrop-blur-md">
                  {/* Narrative */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Narrative</h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-[#E8E8E8]">
                        <span className="font-semibold">Hook:</span> {story.narrative.hook}
                      </p>
                      <p className="text-[#D0D0D0] text-xs">
                        <span className="font-semibold">Context:</span> {story.narrative.context}
                      </p>
                      <p className="text-[#A8A8A8] text-xs">
                        <span className="font-semibold">Current:</span> {story.narrative.current_state}
                      </p>
                    </div>
                  </div>

                  {/* Key Facts */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Key Facts</h4>
                    <div className="space-y-1">
                      {story.key_facts.map((fact, i) => (
                        <div key={i} className="bg-white/[0.03] backdrop-blur-md p-2 text-xs border border-white/10">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold text-[#E8E8E8]">{fact.headline}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300">
                              Importance: {fact.importance}/10
                            </span>
                          </div>
                          <p className="text-[#A8A8A8]">{fact.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Entities */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Entities</h4>
                    <div className="flex flex-wrap gap-2">
                      {story.primary_entities.map((entity) => (
                        <span key={entity} className="bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs px-2 py-1 rounded">
                          {entity}
                        </span>
                      ))}
                      {story.secondary_entities.map((entity) => (
                        <span key={entity} className="bg-white/[0.05] border border-white/15 text-[#A8A8A8] text-xs px-2 py-1 rounded">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Assets */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Assets</h4>
                    <div className="space-y-1">
                      {story.assets.map((asset, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 bg-white/[0.03] backdrop-blur-md border border-white/10">
                          <span className="shrink-0 px-1.5 py-0.5 bg-white/[0.05] text-[#A8A8A8] font-mono">
                            {asset.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#E8E8E8]">{asset.label}</p>
                            <p className="text-[#A8A8A8] truncate">{asset.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="border-t border-white/10 pt-2 text-xs text-[#6E6E6E]">
                    <p>Story ID: {story.story_id.slice(0, 12)}... | Generated: {new Date(story.generated_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
