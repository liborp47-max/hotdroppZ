'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Send, CheckCircle, Clock, Eye } from 'lucide-react'
import Link from 'next/link'
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

export default function FeedPublishPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [publishTarget, setPublishTarget] = useState<'scheduled' | 'published'>('scheduled')

  const loadPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feed/posts')
      if (!res.ok) throw new Error('Failed to load posts')
      const data: FeedResult = await res.json()
      // Show only draft posts ready to publish
      setPosts((data.posts || []).filter(p => p.status === 'draft'))
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

  const handleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set())
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)))
    }
  }

  const handlePublish = async () => {
    if (selectedPosts.size === 0) return

    try {
      // In real implementation, this would call an API endpoint
      // For now, just show success message
      alert(`Publishing ${selectedPosts.size} post(s) as ${publishTarget}`)
      setSelectedPosts(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish posts')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(0,224,133,0.24),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1AEE99]">
              <Send className="h-3.5 w-3.5" />
              Publish & Schedule
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Ready posts for publication</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              Select posts and publish them immediately or schedule for later. Posts will be synced to all selected platforms.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] block mb-2">Publish as</label>
              <div className="flex gap-2">
                {(['scheduled', 'published'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPublishTarget(type)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-semibold uppercase transition-colors',
                      publishTarget === type
                        ? 'border-green-500 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
                    )}
                  >
                    {type === 'scheduled' ? (
                      <>
                        <Clock className="h-3 w-3 inline mr-1" />
                        Schedule
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                        Publish Now
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePublish}
              disabled={selectedPosts.size === 0 || isLoading}
              className={cn(
                'rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-[0.16em] transition-colors flex items-center gap-2',
                selectedPosts.size > 0 && !isLoading
                  ? 'bg-green-500 text-black hover:bg-[#1AEE99]'
                  : 'bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Publish Selected ({selectedPosts.size})
                </>
              )}
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

      {/* Posts List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading draft posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">No draft posts ready to publish.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Create and edit posts in the Feed Editor first.</p>
          </div>
        ) : (
          <>
            {/* Select all */}
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-3 flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm font-semibold text-[#D0D0D0] hover:text-[#E8E8E8] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedPosts.size === posts.length && posts.length > 0}
                  onChange={() => {}}
                  className="rounded border-white/15 cursor-pointer"
                />
                {selectedPosts.size === posts.length && posts.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-[#A8A8A8]">
                {selectedPosts.size} of {posts.length} selected
              </span>
            </div>

            {/* Post grid */}
            <div className="grid gap-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl border border-white/10 bg-black/55 backdrop-blur-xl hover:border-[#00E085]/35 transition-colors p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedPosts)
                        if (e.target.checked) {
                          newSelected.add(post.id)
                        } else {
                          newSelected.delete(post.id)
                        }
                        setSelectedPosts(newSelected)
                      }}
                      className="mt-1 border-white/15 cursor-pointer"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-[#E8E8E8]">{post.headline}</h3>
                          <p className="text-xs text-[#A8A8A8]">{post.artist_name}</p>
                        </div>
                        <span className="text-[10px] rounded-full bg-white/[0.04] px-2 py-1 text-[#A8A8A8]">
                          {post.source}
                        </span>
                      </div>

                      <p className="text-sm text-[#A8A8A8] line-clamp-2 mb-3">{post.content}</p>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-2">
                        <div className="flex gap-1.5">
                          {post.languages.map((lang) => (
                            <span key={lang} className="text-[10px] bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-blue-300 font-mono">
                              {lang}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          {post.platforms.map((plat) => (
                            <span key={plat} className="text-[10px] bg-[rgba(0,224,133,0.10)] border border-[#00E085]/35 px-1.5 py-0.5 text-[#1AEE99] font-mono">
                              {plat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Edit link */}
                    <Link
                      href={`/feed/editor?postId=${post.id}`}
                      className="shrink-0 text-[#A8A8A8] hover:text-[#00E085] transition-colors p-1"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
