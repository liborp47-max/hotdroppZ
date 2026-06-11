'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  AlertCircle, Loader2, ChevronLeft, BookOpen, Eye, Heart, MessageCircle,
  Share2, Copy, ArrowRight, BarChart3, TrendingUp, Link as LinkIcon,
  Search, Download,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  filterPublished,
  searchPosts,
  sortByPublishedDesc,
  postsToCsv,
  type ArchivableFeedPost,
} from '@/lib/feed/archive'

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
  published_at?: string | null
  source: 'writer' | 'creator'
}

type EngagementMetric = {
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  ctr: number
}

// ─── Page dispatcher: no postId => archive list; otherwise post detail ──────

export default function FeedPublishedPage() {
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')
  const approved = searchParams.get('approved')

  if (postId) {
    return <PublishedPostDetail postId={postId} approved={Boolean(approved)} />
  }
  return <PublishedArchiveList />
}

// ─── Archive list — view/search all published posts + CSV export ────────────

function PublishedArchiveList() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/feed/posts')
        if (!res.ok) throw new Error('Failed to load posts')
        const data = await res.json()
        setPosts((data.posts as FeedPost[] | undefined) ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const published = useMemo(
    () => sortByPublishedDesc(filterPublished(posts as ArchivableFeedPost[])),
    [posts],
  )
  const visible = useMemo(() => searchPosts(published, query), [published, query])

  const handleExportCsv = () => {
    const csv = postsToCsv(visible)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feed-published-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-[#A8A8A8]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading published archive...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(0,224,133,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-[#00E085]" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1AEE99]">Step 06 / Published Archive</span>
            </div>
            <h1 className="text-2xl font-black text-[#E8E8E8]">All published posts</h1>
            <p className="text-sm text-[#A8A8A8] mt-1">
              {published.length} published · {visible.length} matching filter
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={visible.length === 0}
            className="rounded-lg border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-4 py-2 text-sm font-semibold text-[#1AEE99] hover:bg-[rgba(0,224,133,0.20)] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export CSV ({visible.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#6E6E6E] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headline, artist, content..."
            className="flex-1 bg-transparent text-sm text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[11px] text-[#A8A8A8] hover:text-[#E8E8E8] px-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">
              {published.length === 0 ? 'No published posts yet.' : 'No matches.'}
            </p>
          </div>
        ) : (
          visible.map((post) => (
            <Link
              key={post.id}
              href={`/feed/published?postId=${post.id}`}
              className="group block border border-white/10 bg-black/55 backdrop-blur-xl hover:border-[#00E085]/35 hover:bg-white/[0.03] transition-all p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-[#E8E8E8] truncate group-hover:text-[#00E085] transition-colors">
                    {post.headline}
                  </h3>
                  <p className="text-xs text-[#A8A8A8] mt-1 line-clamp-1">{post.content}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] text-[#A8A8A8]">{post.artist_name || '—'}</span>
                    <span className="text-[10px] text-[#6E6E6E]">•</span>
                    <span className="text-[10px] text-[#6E6E6E]">
                      {new Date(post.published_at ?? post.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-[#6E6E6E]">•</span>
                    <span className="text-[10px] uppercase text-[#A8A8A8]">{post.source}</span>
                    {post.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="rounded bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 text-[10px] text-blue-300">
                        {p}
                      </span>
                    ))}
                    {post.platforms.length > 3 && (
                      <span className="text-[10px] text-[#6E6E6E]">+{post.platforms.length - 3}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#6E6E6E] group-hover:text-[#00E085] transition-colors shrink-0" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Post detail view — analytics per post + actions (existing behavior) ────

function PublishedPostDetail({ postId, approved }: { postId: string; approved: boolean }) {
  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Mock engagement data (real analytics integration is a separate sub-mission).
  const metrics: EngagementMetric[] = [
    { platform: 'instagram', views: 2340, likes: 145, comments: 23, shares: 12, ctr: 6.2 },
    { platform: 'tiktok', views: 5680, likes: 420, comments: 89, shares: 34, ctr: 7.4 },
    { platform: 'twitter', views: 1230, likes: 78, comments: 12, shares: 5, ctr: 3.1 },
  ]

  useEffect(() => {
    const loadPost = async () => {
      try {
        const res = await fetch('/api/feed/posts')
        if (!res.ok) throw new Error('Failed to load posts')
        const data = await res.json()
        const found = data.posts?.find((p: FeedPost) => p.id === postId)
        if (!found) throw new Error('Post not found')
        setPost(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoading(false)
      }
    }
    void loadPost()
  }, [postId])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://hotdroppz.com/post/${postId}`)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleExportPostCsv = () => {
    if (!post) return
    const csv = postsToCsv([post as ArchivableFeedPost])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feed-post-${post.id}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-[#A8A8A8]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading published post...
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error || 'Post not found'}</span>
        </div>
        <Link href="/feed/published" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to archive
        </Link>
      </div>
    )
  }

  const totalViews = metrics.reduce((sum, m) => sum + m.views, 0)
  const totalEngagement = metrics.reduce((sum, m) => sum + m.likes + m.comments + m.shares, 0)
  const avgCTR = (metrics.reduce((sum, m) => sum + m.ctr, 0) / metrics.length).toFixed(1)

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="space-y-4">
        <Link href="/feed/published" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to archive
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(0,224,133,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[#00E085]" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1AEE99]">Step 06 / Published</span>
              </div>
              <h1 className="text-2xl font-black text-[#E8E8E8]">Live & performing</h1>
              <p className="text-sm text-[#A8A8A8] mt-1">Track engagement and monitor post performance</p>
            </div>
            {approved && (
              <div className="rounded-lg border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-2 text-xs font-semibold text-[#1AEE99]">
                Approved & Published
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-1">Headline</p>
                <h2 className="text-xl font-bold text-[#E8E8E8]">{post.headline}</h2>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-1">Content</p>
                <p className="text-[#D0D0D0] line-clamp-4">{post.content}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-2">Platforms</p>
                  <div className="flex flex-wrap gap-2">
                    {post.platforms.map(p => (
                      <span key={p} className="rounded-lg bg-blue-500/20 text-blue-300 px-3 py-1 text-xs font-semibold">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-2">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {post.languages.map(l => (
                      <span key={l} className="rounded-lg bg-purple-500/20 text-purple-300 px-3 py-1 text-xs font-semibold uppercase">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-3">Metadata</p>
            <div className="space-y-3 text-sm">
              <div><p className="text-[#A8A8A8] text-xs mb-1">Artist</p><p className="text-[#E8E8E8] font-semibold">{post.artist_name}</p></div>
              <div><p className="text-[#A8A8A8] text-xs mb-1">Source</p><p className="text-[#E8E8E8] font-semibold capitalize">{post.source}</p></div>
              <div>
                <p className="text-[#A8A8A8] text-xs mb-1">Published</p>
                <p className="text-[#E8E8E8] font-semibold font-mono text-xs">
                  {new Date(post.published_at ?? post.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-xs font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <Copy className="h-3 w-3" />
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement overview (mock — see note in artifact) */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Total Views</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{totalViews.toLocaleString()}</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-[#00E085]"><TrendingUp className="h-3 w-3" /> +12% vs last post</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Engagement</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{totalEngagement}</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-[#00E085]"><TrendingUp className="h-3 w-3" /> +8% engagement rate</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Avg CTR</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{avgCTR}%</div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Click-through rate</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Status</div>
          <div className="mt-3"><span className="inline-block bg-green-500/20 text-[#1AEE99] px-3 py-1 text-sm font-bold">LIVE</span></div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Publishing complete</p>
        </div>
      </div>

      {/* Per-platform metrics (mock) */}
      <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" /> Performance by platform
        </h3>
        <div className="space-y-3">
          {metrics.map(metric => (
            <div key={metric.platform} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="font-semibold text-[#E8E8E8] uppercase text-sm">{metric.platform}</div>
                <div className="text-xs text-[#A8A8A8]">Mock data</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-1.5 flex items-center gap-1"><Eye className="h-3 w-3" /> Views</p>
                  <p className="text-lg font-black text-[#E8E8E8]">{metric.views.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-1.5 flex items-center gap-1"><Heart className="h-3 w-3 text-red-400" /> Likes</p>
                  <p className="text-lg font-black text-[#E8E8E8]">{metric.likes}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-1.5 flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-400" /> Comments</p>
                  <p className="text-lg font-black text-[#E8E8E8]">{metric.comments}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-1.5 flex items-center gap-1"><Share2 className="h-3 w-3 text-[#00E085]" /> Shares</p>
                  <p className="text-lg font-black text-[#E8E8E8]">{metric.shares}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6E6E6E] mb-1.5">CTR</p>
                  <p className="text-lg font-black text-[#E8E8E8]">{metric.ctr}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export & share — working CSV export */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Export & Share</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <button
            onClick={handleCopyLink}
            className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2"
          >
            <LinkIcon className="h-4 w-4" />
            {copiedLink ? 'Copied!' : 'Copy Post Link'}
          </button>
          <button
            onClick={handleExportPostCsv}
            className="rounded-lg border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-4 py-2 text-sm font-semibold text-[#1AEE99] hover:bg-[rgba(0,224,133,0.20)] transition-colors flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <Link
            href="/feed/published"
            className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            View Archive
          </Link>
        </div>
      </div>
    </div>
  )
}
