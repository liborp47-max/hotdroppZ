'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Globe2, Image as ImageIcon, Layers3, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssetBuilder } from '@/components/creator/asset-builder'

type CreatorCaptionVariant = {
  language: string
  headline: string
  overlay_kicker: string
  overlay_fact: string
  caption: string
  cta: string
  hashtags: string[]
}

type CreatorQueuePost = {
  package_id: string
  story_id: string
  artist_name: string
  template: string
  platform: string
  aspect_ratio: string
  source_image_url?: string | null
  image_prompt: string
  overlay_lines: string[]
  caption_variants: CreatorCaptionVariant[]
  watermark: {
    logo_path: string
    position: string
    opacity: number
    scale: number
    blend_mode: string
  }
  publish_priority: number
  queue_status: string
  generated_at: string
  metadata?: {
    overlay_style?: string
    crop_focus?: string
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

const DEFAULT_LANGUAGES = ['en', 'cs', 'de']

export default function CreatorPage() {
  const [posts, setPosts] = useState<CreatorQueuePost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isGeneratingFromAssets, setIsGeneratingFromAssets] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState('en')

  const loadPosts = useCallback(async () => {
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

  const runCreator = async () => {
    setIsRunning(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        max_posts: '10',
        languages: DEFAULT_LANGUAGES.join(','),
        templates: 'feed_card,story_card',
      })
      const res = await fetch(`/api/creator/posts?${params.toString()}`, { method: 'POST' })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Creator pipeline failed')
      }
      const data: CreatorResult = await res.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creator pipeline failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleAssetGenerate = async (fact: any, quote: any, picture: any) => {
    setIsGeneratingFromAssets(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        asset_fact_id: fact.id,
        asset_quote_id: quote.id,
        asset_picture_id: picture.id,
        languages: DEFAULT_LANGUAGES.join(','),
        templates: 'feed_card,story_card',
      })
      const res = await fetch(`/api/creator/posts?${params.toString()}`, { method: 'POST' })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Failed to generate post from assets')
      }
      const data: CreatorResult = await res.json()
      setPosts(data.posts || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate post from assets')
      throw err
    } finally {
      setIsGeneratingFromAssets(false)
    }
  }

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const languages = useMemo(() => {
    const unique = new Set<string>()
    posts.forEach((post) => {
      post.caption_variants.forEach((variant) => unique.add(variant.language))
    })
    return unique.size ? Array.from(unique) : DEFAULT_LANGUAGES
  }, [posts])

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Asset Builder Section */}
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.15),_transparent_40%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(18,24,27,0.92))] p-6">
        <AssetBuilder onGenerate={handleAssetGenerate} isGenerating={isGeneratingFromAssets} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(132,204,22,0.24),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[rgba(0,224,133,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1AEE99]">
              <Sparkles className="h-3.5 w-3.5" />
              Creator Engine
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Artist fun facts into multilingual queue posts</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              Creator turns approved story packages into premium Did you know cards, multilingual captions, and queue-ready feed posts with HotDroppZ watermark instructions baked in.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-[#A8A8A8]">
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Photo-first visual brief</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Multilanguage captions</span>
              <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-1">Watermark always on</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
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
            <button
              onClick={() => void runCreator()}
              disabled={isRunning}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 text-sm font-black transition-colors',
                isRunning
                  ? 'cursor-not-allowed bg-white/[0.05] text-[#A8A8A8]'
                  : 'bg-[#00E085] text-black hover:bg-[#1AEE99]'
              )}
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
              Build queue
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Queue posts</span>
            <Layers3 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{posts.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Languages</span>
            <Globe2 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{languages.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Watermark</span>
            <ImageIcon className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-lg font-bold text-[#E8E8E8]">/icons/ICON.ico</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {languages.map((language) => (
          <button
            key={language}
            onClick={() => setActiveLanguage(language)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
              activeLanguage === language
                ? 'border-lime-500 bg-[#00E085] text-black'
                : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/20 hover:text-[#E8E8E8]'
            )}
          >
            {language}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {isLoading && posts.length === 0 ? (
          <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading creator queue...
          </div>
        ) : posts.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">No creator queue posts yet.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Run Fact Builder first, then Creator Engine will assemble multilingual queue cards.</p>
          </div>
        ) : (
          posts.map((post) => {
            const variant = post.caption_variants.find((item) => item.language === activeLanguage) || post.caption_variants[0]
            return (
              <div key={`${post.package_id}-${post.template}`} className="overflow-hidden rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl shadow-black/20">
                <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="relative min-h-[360px] overflow-hidden bg-white/[0.03] backdrop-blur-md">
                    {post.source_image_url ? (
                      <img src={post.source_image_url} alt={post.artist_name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                    <div
                      className="absolute inset-0"
                      style={{ background: post.source_image_url ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(9,9,11,0.75) 100%)' : 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #65a30d 100%)' }}
                    />
                    <div className="absolute inset-0 flex flex-col justify-between p-6">
                      <div className="space-y-3">
                        <div className="inline-flex w-fit items-center rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8E8E8]">
                          {variant?.overlay_kicker || 'Did you know'}
                        </div>
                        <div className="max-w-md space-y-2">
                          {post.overlay_lines.map((line) => (
                            <p key={line} className="text-2xl font-black uppercase leading-tight tracking-tight text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#D0D0D0]">{post.platform.replace('_', ' ')}</p>
                          <p className="mt-1 text-sm text-[#E8E8E8]">{post.aspect_ratio} · priority {post.publish_priority}</p>
                        </div>
                        <img
                          src={post.watermark.logo_path}
                          alt="HotDroppZ watermark"
                          className="h-14 w-14 object-contain opacity-70"
                          style={{ opacity: post.watermark.opacity + 0.25 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#00E085]">{post.artist_name}</p>
                      <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">{variant?.headline || post.artist_name}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#D0D0D0]">{variant?.caption || post.image_prompt}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">CTA</p>
                      <p className="mt-2 text-sm text-[#E8E8E8]">{variant?.cta || 'Share your take.'}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Hashtags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(variant?.hashtags || []).map((tag) => (
                          <span key={tag} className="rounded-full border border-white/15 bg-black px-2.5 py-1 text-xs text-[#D0D0D0]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Visual brief</p>
                      <p className="mt-2 text-sm leading-6 text-[#D0D0D0]">{post.image_prompt}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
