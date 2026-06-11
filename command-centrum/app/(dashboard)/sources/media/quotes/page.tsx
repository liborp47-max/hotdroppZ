'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Quote, ShieldCheck, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuoteItem = {
  author: string
  quote: string
  source: string
  artist: string
  language: string
  topic: string
  confidence: number
  context: string
  languageHint: string
  tags: string[]
}

const QUOTES: QuoteItem[] = [
  {
    author: 'Editorial pull quote',
    quote: 'Short quotes should carry a sharp emotion and a clear visual reason to exist.',
    source: 'Public interview / approved note',
    artist: 'Example artist',
    language: 'en / cs / de',
    topic: 'overlay',
    confidence: 91,
    context: 'Use on overlays and carousel slides.',
    languageHint: 'Localize the emotional punch, not just the words.',
    tags: ['overlay', 'caption', 'localized'],
  },
  {
    author: 'Artist voice seed',
    quote: 'If it sounds generic, it is not ready for Creator.',
    source: 'Editorial tone guide',
    artist: 'Creator team',
    language: 'en / cs / fr',
    topic: 'premium',
    confidence: 87,
    context: 'Useful when building high-end quote-style posts.',
    languageHint: 'Preserve attitude and tone in every language.',
    tags: ['tone', 'premium', 'creator'],
  },
  {
    author: 'Fan-line pattern',
    quote: 'A good quote should feel quotable, but still grounded in the source story.',
    source: 'Story Builder package',
    artist: 'Artist cluster',
    language: 'en / es / pl',
    topic: 'storyline',
    confidence: 89,
    context: 'Best for short quotes and quote cards.',
    languageHint: 'Keep the rhythm natural for each target language.',
    tags: ['quote-card', 'short-form', 'multilingual'],
  },
]

export default function MediaQuotesPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyQuote = async (quote: string, id: string) => {
    await navigator.clipboard.writeText(quote)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const stats = useMemo(() => ({ total: QUOTES.length }), [])

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.15),_transparent_30%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.95))] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
              <Quote className="h-3.5 w-3.5" />
              Quotes Database
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Quote-ready source material</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              Quotes can become overlays, captions, or text-led feed assets. This database keeps them short, usable, and ready to localize for Creator.
            </p>
          </div>
          <Link href="/sources/media" className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-sm font-semibold text-[#E8E8E8] transition-colors hover:bg-white/[0.05]">
            Back to MEDIA
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Quote items</p>
        <p className="mt-2 text-3xl font-black text-[#E8E8E8]">{stats.total}</p>
      </div>

      <div className="space-y-4">
        {QUOTES.map((item) => (
          <div key={item.quote} className="rounded-3xl border border-white/10 bg-black/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <h2 className="text-xl font-black text-[#E8E8E8]">{item.author}</h2>
                <p className="max-w-3xl text-sm leading-6 text-[#D0D0D0]">{item.quote}</p>
                <div className="flex flex-wrap gap-2 text-[11px] text-[#A8A8A8]">
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.artist}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.language}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{item.topic}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{item.confidence}</span>
                </div>
                <p className="text-xs text-[#A8A8A8]">Context: {item.context}</p>
                <p className="text-xs text-[#A8A8A8]">Language note: {item.languageHint}</p>
                <p className="text-xs text-[#A8A8A8] flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Source: {item.source}</p>
              </div>
              <button
                onClick={() => void copyQuote(item.quote, item.quote)}
                className={cn(
                  'inline-flex items-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                  copied === item.quote
                    ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                    : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
                )}
              >
                <Copy className="h-4 w-4" />
                {copied === item.quote ? 'Copied' : 'Copy quote'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-xs text-[#D0D0D0]">{tag}</span>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Multilingual overlay preview</p>
              <div className="mt-2 grid gap-2 text-sm text-[#D0D0D0] md:grid-cols-3">
                <p><span className="text-[#A8A8A8]">EN</span> {item.quote}</p>
                <p><span className="text-[#A8A8A8]">CS</span> {item.quote}</p>
                <p><span className="text-[#A8A8A8]">DE</span> {item.quote}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
