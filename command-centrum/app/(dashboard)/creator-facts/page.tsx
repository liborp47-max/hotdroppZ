'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Globe2, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type CreatorFactPackage = {
  package_id: string
  story_id: string
  artist_name: string
  headline: string
  did_you_know: string
  fact_body: string
  why_it_hits: string
  source_confidence: number
  source_fact_ids: string[]
  image_plan: {
    source_image_url?: string | null
    image_prompt: string
    crop_focus: string
    overlay_style: string
    fallback_background: string
  }
  tags: string[]
  preferred_languages: string[]
  watermark: {
    logo_path: string
    position: string
    opacity: number
    scale: number
    blend_mode: string
  }
  generated_at: string
  metadata?: Record<string, unknown>
}

type CreatorFactResult = {
  status: 'empty' | 'ok' | 'error'
  packages?: CreatorFactPackage[]
  total_packages?: number
  message?: string
  error?: string
}

export default function CreatorFactsPage() {
  const [packages, setPackages] = useState<CreatorFactPackage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPackages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/facts')
      const data: CreatorFactResult = await res.json()
      setPackages(data.packages || [])
    } catch {
      setPackages([])
      setError('Failed to load creator fact packages')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runBuilder = async () => {
    setIsRunning(true)
    setError(null)
    try {
      const params = new URLSearchParams({ max_packages: '10', languages: 'en,cs,de' })
      const res = await fetch(`/api/creator/facts?${params.toString()}`, { method: 'POST' })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Creator fact builder failed')
      }
      const data: CreatorFactResult = await res.json()
      setPackages(data.packages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creator fact builder failed')
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.18),_transparent_32%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.95))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Fact Builder
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Artist image + fact package generator</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              This stage picks the strongest artist-centered interesting fact from Story Builder, writes a premium Did you know angle, attaches multilingual targets, and defines the photo treatment plus permanent HotDroppZ watermark.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadPackages()}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                isLoading ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-[#6E6E6E]' : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Reload
            </button>
            <button
              onClick={() => void runBuilder()}
              disabled={isRunning}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-black transition-colors',
                isRunning ? 'cursor-not-allowed bg-white/[0.05] text-[#A8A8A8]' : 'bg-amber-500 text-black hover:bg-amber-400'
              )}
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
              Build facts
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
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Packages</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{packages.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Languages</span>
            <Globe2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{new Set(packages.flatMap((item) => item.preferred_languages)).size}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Watermark</span>
            <ImageIcon className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-lg font-bold text-[#E8E8E8]">Always on</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {isLoading && packages.length === 0 ? (
          <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading creator packages...
          </div>
        ) : packages.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">No creator fact packages generated yet.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Run Fact Builder to shape artist fun facts from Story Builder output.</p>
          </div>
        ) : (
          packages.map((item) => (
            <div key={item.package_id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/70">
              <div className="relative min-h-[280px] p-6" style={{ background: item.image_plan.fallback_background }}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex w-fit rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                      Did you know
                    </div>
                    <h2 className="max-w-md text-3xl font-black uppercase tracking-tight text-white">{item.artist_name}</h2>
                    <p className="max-w-lg text-xl font-semibold leading-tight text-white">{item.did_you_know}</p>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#E8E8E8]">Confidence {item.source_confidence}</p>
                      <p className="mt-1 text-sm text-[#E8E8E8]">{item.headline}</p>
                    </div>
                    <img src={item.watermark.logo_path} alt="HotDroppZ watermark" className="h-14 w-14 object-contain opacity-70" style={{ opacity: item.watermark.opacity + 0.25 }} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Fact body</p>
                  <p className="mt-2 text-sm leading-6 text-[#D0D0D0]">{item.fact_body}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Why it hits</p>
                  <p className="mt-2 text-sm leading-6 text-[#D0D0D0]">{item.why_it_hits}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Image brief</p>
                  <p className="mt-2 text-sm leading-6 text-[#D0D0D0]">{item.image_plan.image_prompt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-xs text-[#D0D0D0]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
