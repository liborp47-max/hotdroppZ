'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, Loader2, RefreshCw, ArrowRight, FileText, Zap, Check, Info,
  Square, CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedPost = {
  id: string
  story_id: string
  artist_name: string
  headline: string
  content: string
  platforms: string[]
  status: 'draft' | 'scheduled' | 'published'
  languages: string[]
  image_url?: string
  priority: number
  created_at: string
  source: 'writer' | 'creator'
}

type FeedResult = {
  status: 'empty' | 'ok' | 'error'
  posts?: FeedPost[]
  total_posts?: number
}

export default function FeedIncomingPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'compact' | 'detail'>('compact')
  // Bulk select — triage multiple Factory outputs and open them in the Editor.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feed/posts')
      if (!res.ok) throw new Error('Failed to load posts')
      const data: FeedResult = await res.json()
      setPosts(data.posts || [])
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const stats = {
    total: posts.length,
    writer: posts.filter(p => p.source === 'writer').length,
    creator: posts.filter(p => p.source === 'creator').length,
  }

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const allSelected = posts.length > 0 && selectedIds.size === posts.length

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(posts.map(p => p.id)))
  }, [posts])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // "Move to Editor" for the selection — opens each selected post's Editor page
  // in a new tab (the Editor is single-post; this is the bulk equivalent).
  const openSelectedInEditor = useCallback(() => {
    for (const id of selectedIds) {
      window.open(`/feed/editor?postId=${id}`, '_blank', 'noopener')
    }
  }, [selectedIds])

  const selectedCount = selectedIds.size
  const compactReady = useMemo(
    () => viewMode === 'compact' && !isLoading && posts.length > 0,
    [viewMode, isLoading, posts.length],
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(0,224,133,0.24),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1AEE99]">
              <Info className="h-3.5 w-3.5" />
              Step 01 / Incoming
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Factory output awaiting review</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              Fresh content from Writer (articles) and Creator (cards). Review, validate data, then move to Editor for refinement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'compact' ? 'detail' : 'compact')}
              className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
            >
              {viewMode === 'compact' ? 'Detail' : 'Compact'}
            </button>
            <button
              onClick={() => void loadPosts()}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                isLoading
                  ? 'cursor-not-allowed border-white/10 bg-white/[0.03] backdrop-blur-md text-[#6E6E6E]'
                  : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Reload
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      {!isLoading && posts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Total Incoming</div>
            <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">
              <FileText className="h-3 w-3 text-[#00E085]" />
              From Writer
            </div>
            <div className="mt-3 text-3xl font-black text-[#00E085]">{stats.writer}</div>
            <p className="text-[11px] text-[#A8A8A8] mt-2">Articles with full body</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">
              <Zap className="h-3 w-3 text-orange-400" />
              From Creator
            </div>
            <div className="mt-3 text-3xl font-black text-orange-400">{stats.creator}</div>
            <p className="text-[11px] text-[#A8A8A8] mt-2">Feed cards with multilingual</p>
          </div>
        </div>
      )}

      {/* Bulk select toolbar (compact view) */}
      {compactReady && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-2.5 text-xs">
          <button
            onClick={allSelected ? clearSelection : selectAll}
            className="flex items-center gap-1.5 font-semibold text-[#D0D0D0] hover:text-[#E8E8E8] transition-colors"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-[#00E085]" /> : <Square className="h-4 w-4" />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          {selectedCount > 0 && (
            <>
              <span className="text-[#1AEE99] font-semibold">{selectedCount} selected</span>
              <span className="ml-auto flex items-center gap-2">
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={openSelectedInEditor}
                  className="flex items-center gap-1.5 border border-[#00E085]/35 bg-[rgba(0,224,133,0.12)] px-3 py-1.5 font-semibold text-[#1AEE99] hover:bg-[rgba(0,224,133,0.20)] transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move {selectedCount} to Editor
                </button>
              </span>
            </>
          )}
        </div>
      )}

      {/* Posts */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading incoming posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">No posts waiting for review.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Run Writer or Creator engines to generate new content.</p>
          </div>
        ) : viewMode === 'compact' ? (
          // Compact view - stacked list with bulk-select checkbox
          posts.map((post) => {
            const selected = selectedIds.has(post.id)
            return (
              <div
                key={post.id}
                className={cn(
                  'group flex items-stretch border bg-black/55 backdrop-blur-xl transition-all',
                  selected
                    ? 'border-[#00E085]/50 bg-[rgba(0,224,133,0.06)]'
                    : 'border-white/10 hover:border-[#00E085]/35 hover:bg-white/[0.03]'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(post.id)}
                  aria-label={selected ? `Deselect ${post.headline}` : `Select ${post.headline}`}
                  className="flex items-center px-3 text-[#6E6E6E] hover:text-[#00E085] transition-colors"
                >
                  {selected
                    ? <CheckSquare className="h-4 w-4 text-[#00E085]" />
                    : <Square className="h-4 w-4" />}
                </button>
                <Link
                  href={`/feed/editor?postId=${post.id}`}
                  className="flex-1 min-w-0 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.source === 'writer' ? (
                          <FileText className="h-3.5 w-3.5 text-[#00E085] shrink-0" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        )}
                        <h3 className="font-bold text-sm text-[#E8E8E8] truncate group-hover:text-[#00E085] transition-colors">
                          {post.headline}
                        </h3>
                      </div>
                      <p className="text-xs text-[#A8A8A8] truncate">{post.artist_name}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] bg-white/[0.05] px-1.5 py-0.5 text-[#A8A8A8]">
                        {post.languages.length} langs
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#6E6E6E] group-hover:text-[#00E085] transition-colors" />
                    </div>
                  </div>
                </Link>
              </div>
            )
          })
        ) : (
          // Detail view - full cards
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/feed/editor?postId=${post.id}`}
              className="group block rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl hover:border-[#00E085]/35 hover:bg-white/[0.03] backdrop-blur-md transition-all p-5"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Left side - Content */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {post.source === 'writer' ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#00E085]" />
                        <span className="text-xs font-semibold text-[#00E085] uppercase">Article</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-400" />
                        <span className="text-xs font-semibold text-orange-400 uppercase">Card</span>
                      </div>
                    )}
                    <span className="text-[10px] text-[#6E6E6E] ml-auto">{new Date(post.created_at).toLocaleDateString('cs-CZ')}</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-[#E8E8E8] group-hover:text-[#00E085] transition-colors mb-1">
                      {post.headline}
                    </h3>
                    <p className="text-sm text-[#A8A8A8] line-clamp-3">{post.content}</p>
                  </div>

                  <p className="text-xs text-[#A8A8A8] italic">{post.artist_name}</p>
                </div>

                {/* Right side - Metadata */}
                <div className="space-y-3 text-xs">
                  <div className="rounded-lg border border-white/15 bg-white/[0.03] p-3">
                    <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-2">Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {post.languages.map((lang) => (
                        <span key={lang} className="rounded bg-blue-500/10 border border-blue-500/30 px-2 py-1 text-blue-300 font-mono">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/15 bg-white/[0.03] p-3">
                    <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-2">Platforms</p>
                    <div className="flex flex-wrap gap-2">
                      {post.platforms.map((plat) => (
                        <span key={plat} className="rounded bg-[rgba(0,224,133,0.10)] border border-[#00E085]/35 px-2 py-1 text-[#1AEE99] font-mono">
                          {plat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/15 bg-white/[0.03] p-3">
                    <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-2">Priority & Status</p>
                    <div className="space-y-1">
                      <p><span className="text-[#A8A8A8]">Priority:</span> <span className="text-[#E8E8E8] font-semibold">{post.priority}/100</span></p>
                      <p><span className="text-[#A8A8A8]">Status:</span> <span className="text-[#E8E8E8] font-semibold capitalize">{post.status}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-[#6E6E6E]">Story ID: {post.story_id}</span>
                <button className="flex items-center gap-2 text-sm font-semibold text-[#00E085] hover:text-[#1AEE99] transition-colors">
                  <Check className="h-4 w-4" />
                  Move to Editor
                </button>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Workflow indicator */}
      {posts.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold">WORKFLOW STATUS</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 bg-[rgba(0,224,133,0.10)] border border-[#00E085]/35 px-2 py-1 text-[#1AEE99]">
                <Check className="h-3 w-3" /> Incoming: {stats.total}
              </span>
              <ArrowRight className="h-4 w-4 text-[#6E6E6E]" />
              <span className="text-[#A8A8A8]">Next: Editor (Step 02)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
