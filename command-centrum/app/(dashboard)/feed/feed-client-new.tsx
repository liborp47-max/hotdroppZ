'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, RefreshCw, Rss, ChevronRight, Calendar, Globe, Settings, FileText, Zap } from 'lucide-react'
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
  message?: string
}

export default function FeedClientNew() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'published' | 'writer' | 'creator'>('all')

  const loadPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feed/posts')
      if (!res.ok) throw new Error('Failed to load posts')
      const data: FeedResult = await res.json()
      setPosts(data.posts || [])
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

  const filteredPosts = posts.filter((post) => {
    if (filter === 'all') return true
    if (['draft', 'scheduled', 'published'].includes(filter)) return post.status === filter
    return post.source === filter
  })

  const stats = {
    total: posts.length,
    draft: posts.filter(p => p.status === 'draft').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    writer: posts.filter(p => p.source === 'writer').length,
    creator: posts.filter(p => p.source === 'creator').length,
  }

  const statusColor = {
    draft: 'bg-white/[0.12] text-[#D0D0D0] border-white/15',
    scheduled: 'bg-blue-500/10 text-blue-300 border-blue-700',
    published: 'bg-[rgba(0,224,133,0.10)] text-[#1AEE99] border-green-700',
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(255,102,0,0.24),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300">
              <Rss className="h-3.5 w-3.5" />
              Feed Hub
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">All prepared feed posts</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              Articles from Writer and cards from Creator. Edit, manage versions in all languages, and publish to platforms.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-[#A8A8A8]">
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Full article + feed card</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Multilingual editor</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Multi-platform publish</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <Link
              href="/feed/publish"
              className="flex items-center justify-center gap-2 bg-green-500 text-black px-4 py-3 text-sm font-semibold hover:bg-[#1AEE99] transition-colors"
            >
              <Zap className="h-4 w-4 fill-current" />
              Publish
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'draft', 'scheduled', 'published', 'writer', 'creator'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors capitalize',
              filter === f
                ? 'border-orange-500 bg-orange-500 text-black'
                : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/20 hover:text-[#E8E8E8]'
            )}
          >
            {f === 'all' ? 'All' : f}
            {f !== 'all' && (
              <span className="ml-1 text-[10px] opacity-70">
                ({f === 'draft' ? stats.draft : f === 'scheduled' ? stats.scheduled : f === 'published' ? stats.published : f === 'writer' ? stats.writer : stats.creator})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      <div className="space-y-3">
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading feed posts...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">
              {posts.length === 0 ? 'No feed posts yet.' : `No ${filter} posts.`}
            </p>
            <p className="mt-2 text-xs text-[#6E6E6E]">
              {posts.length === 0 ? 'Run Writer or Creator engines to generate posts, then they will appear here.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <Link
              key={post.id}
              href={`/feed/editor?postId=${post.id}`}
              className="group block rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl hover:border-orange-500/30 hover:bg-white/[0.03] backdrop-blur-md transition-all p-4"
            >
              <div className="flex gap-4">
                {/* Source icon */}
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl" style={{
                  backgroundColor: post.source === 'writer' ? 'rgba(0, 224, 133, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                  borderColor: post.source === 'writer' ? 'rgba(0, 224, 133, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                  borderWidth: '1px',
                }}>
                  {post.source === 'writer' ? (
                    <FileText className="h-5 w-5" style={{ color: post.source === 'writer' ? '#86efac' : '#fed7aa' }} />
                  ) : (
                    <Zap className="h-5 w-5" style={{ color: post.source === 'creator' ? '#fed7aa' : '#86efac' }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#E8E8E8] group-hover:text-orange-400 transition-colors truncate">
                        {post.headline}
                      </h3>
                      <p className="text-xs text-[#A8A8A8] mt-1">{post.artist_name}</p>
                    </div>
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0', statusColor[post.status])}>
                      {post.status}
                    </span>
                  </div>

                  <p className="text-sm text-[#A8A8A8] line-clamp-2 mb-3">{post.content}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-[#A8A8A8]">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {post.languages.join(', ')}
                    </div>
                    {post.platforms.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Rss className="h-3 w-3" />
                        {post.platforms.slice(0, 2).join(', ')}
                        {post.platforms.length > 2 && ` +${post.platforms.length - 2}`}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.created_at).toLocaleDateString('cs-CZ')}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="shrink-0 flex items-center text-[#6E6E6E] group-hover:text-orange-400 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Stats */}
      {!isLoading && posts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Total Posts</div>
            <div className="mt-3 text-2xl font-black text-[#E8E8E8]">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Drafts</div>
            <div className="mt-3 text-2xl font-black text-[#E8E8E8]">{stats.draft}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Scheduled</div>
            <div className="mt-3 text-2xl font-black text-[#E8E8E8]">{stats.scheduled}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Published</div>
            <div className="mt-3 text-2xl font-black text-[#E8E8E8]">{stats.published}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">From Writer</div>
            <div className="mt-3 text-2xl font-black text-[#00E085]">{stats.writer}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">From Creator</div>
            <div className="mt-3 text-2xl font-black text-orange-400">{stats.creator}</div>
          </div>
        </div>
      )}
    </div>
  )
}
