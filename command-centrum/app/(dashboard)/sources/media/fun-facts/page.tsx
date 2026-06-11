'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Sparkles, ShieldCheck, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type FunFactItem = {
  title: string
  fact: string
  source: string
  artist: string
  language: string
  topic: string
  confidence: number
  useCase: string
  tags: string[]
  languageHint: string
}

const FUN_FACTS: FunFactItem[] = [
  {
    title: 'Artist trivia seed',
    fact: 'Use one verified artist milestone to open a Did you know post in one line.',
    source: 'Artist registry + public milestone',
    artist: 'Example artist',
    language: 'en / cs / de',
    topic: 'trivia',
    confidence: 94,
    useCase: 'Best for feed hooks and carousel covers.',
    tags: ['did-you-know', 'artist-trivia', 'feed-hook'],
    languageHint: 'Translate the core fact, not just the wording.',
  },
  {
    title: 'Fan reaction angle',
    fact: 'Pair a fact with a fan-relevant consequence, like chart impact, tour energy, or cultural influence.',
    source: 'Chart and culture context',
    artist: 'Artist cluster',
    language: 'en / cs / pl',
    topic: 'fan-context',
    confidence: 88,
    useCase: 'Great for social captions and quote cards.',
    tags: ['fan-context', 'caption-ready', 'social'],
    languageHint: 'Keep the emotion local for each language.',
  },
  {
    title: 'Editorial micro-story',
    fact: 'Turn one fact into a short story about why it matters now, not only what happened.',
    source: 'Story Builder output',
    artist: 'Artist name',
    language: 'en / fr / es',
    topic: 'editorial',
    confidence: 90,
    useCase: 'Works for higher quality 2026-standard posts.',
    tags: ['editorial', 'story-angle', 'premium'],
    languageHint: 'Preserve the meaning and tone across all languages.',
  },
]

export default function MediaFunFactsPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyFact = async (fact: string, id: string) => {
    await navigator.clipboard.writeText(fact)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const stats = useMemo(() => ({ total: FUN_FACTS.length, seeded: FUN_FACTS.filter((item) => item.tags.length > 0).length }), [])

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.95))] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              Fun Facts Database
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Free hooks for Creator</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              This library stores reusable artist fact seeds for Creator. Each item is short enough for a feed hook, but structured enough to become multilingual Did you know content.
            </p>
          </div>
          <Link href="/sources/media" className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-sm font-semibold text-[#E8E8E8] transition-colors hover:bg-white/[0.05]">
            Back to MEDIA
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Total hooks</p>
          <p className="mt-2 text-3xl font-black text-[#E8E8E8]">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Tagged items</p>
          <p className="mt-2 text-3xl font-black text-[#E8E8E8]">{stats.seeded}</p>
        </div>
      </div>

      <div className="space-y-4">
        {FUN_FACTS.map((item) => (
          <div key={item.title} className="rounded-3xl border border-white/10 bg-black/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <h2 className="text-xl font-black text-[#E8E8E8]">{item.title}</h2>
                <p className="max-w-3xl text-sm leading-6 text-[#D0D0D0]">{item.fact}</p>
                <div className="flex flex-wrap gap-2 text-[11px] text-[#A8A8A8]">
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.artist}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.language}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.topic}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{item.confidence}</span>
                </div>
                <p className="text-xs text-[#A8A8A8]">Use case: {item.useCase}</p>
                <p className="text-xs text-[#A8A8A8]">Language note: {item.languageHint}</p>
                <p className="text-xs text-[#A8A8A8] flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Source: {item.source}</p>
              </div>
              <button
                onClick={() => void copyFact(item.fact, item.title)}
                className={cn(
                  'inline-flex items-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                  copied === item.title
                    ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                    : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
                )}
              >
                <Copy className="h-4 w-4" />
                {copied === item.title ? 'Copied' : 'Copy fact'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-xs text-[#D0D0D0]">{tag}</span>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Multilingual source preview</p>
              <div className="mt-2 grid gap-2 text-sm text-[#D0D0D0] md:grid-cols-3">
                <p><span className="text-[#A8A8A8]">EN</span> Did you know: {item.fact}</p>
                <p><span className="text-[#A8A8A8]">CS</span> Zajímavost: {item.fact}</p>
                <p><span className="text-[#A8A8A8]">DE</span> Wusstest du: {item.fact}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
