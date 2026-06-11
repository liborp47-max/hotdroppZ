'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type CreatorQueuePost = {
  package_id: string
  artist_name: string
  template: string
  platform: string
  publish_priority: number
  queue_status: string
  overlay_lines: string[]
  caption_variants: Array<{
    language: string
    headline: string
    caption: string
    cta: string
    hashtags: string[]
  }>
  watermark: {
    logo_path: string
    opacity: number
  }
  metadata?: {
    tags?: string[]
  }
}

type CreatorResult = {
  status: 'empty' | 'ok' | 'error'
  posts?: CreatorQueuePost[]
  total_posts?: number
  message?: string
  error?: string
}

export default function CreatorQueuePage() {
  const [posts, setPosts] = useState<CreatorQueuePost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/posts')
      const data: CreatorResult = await res.json()
      setPosts(data.posts || [])
    } catch {
      setPosts([])
      setError('Failed to load creator queue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-black/70 p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8A8A8]">Creator Queue</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#E8E8E8]">Feed-ready packages waiting for release</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
            Final queue view for Creator outputs. Every card carries the watermark path, multilingual caption variants, and priority score so editorial can publish fast without losing brand consistency.
          </p>
        </div>
        <button
          onClick={() => void loadQueue()}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
            isLoading ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-[#6E6E6E]' : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Reload
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Ready</span>
            <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{posts.filter((post) => post.queue_status === 'ready').length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Templates</span>
            <Clock3 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{new Set(posts.map((post) => post.template)).size}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Total queue</span>
            <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{posts.length}</div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading queue...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">Creator queue is empty.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Generate posts in Creator Engine to fill this release list.</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={`${post.package_id}-${post.template}`} className="rounded-2xl border border-white/10 bg-black/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-green-500/25 bg-[rgba(0,224,133,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1AEE99]">{post.queue_status}</span>
                    <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D0D0D0]">{post.platform.replace('_', ' ')}</span>
                    <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D0D0D0]">{post.template.replace('_', ' ')}</span>
                  </div>
                  <h2 className="text-xl font-black text-[#E8E8E8]">{post.artist_name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {post.overlay_lines.map((line) => (
                      <span key={line} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-xs text-[#D0D0D0]">{line}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Priority</p>
                    <p className="mt-1 text-2xl font-black text-[#E8E8E8]">{post.publish_priority}</p>
                  </div>
                  <img src={post.watermark.logo_path} alt="HotDroppZ watermark" className="h-12 w-12 object-contain" style={{ opacity: post.watermark.opacity + 0.3 }} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {post.caption_variants.map((variant) => (
                  <div key={`${post.package_id}-${variant.language}`} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">{variant.language}</span>
                      <span className="text-xs text-[#6E6E6E]">{variant.headline}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#D0D0D0]">{variant.caption}</p>
                    <p className="mt-3 text-sm font-semibold text-[#E8E8E8]">{variant.cta}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {variant.hashtags.map((tag) => (
                        <span key={tag} className="rounded-full border border-white/15 bg-black px-2 py-1 text-xs text-[#D0D0D0]">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
