'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Image as ImageIcon, Quote, Search, ShieldCheck, Sparkles, Wand2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const MEDIA_SECTIONS = [
  {
    title: 'Fun Facts',
    href: '/sources/media/fun-facts',
    icon: Sparkles,
    description: 'A curated free-content base for short artist facts, trivia, and Did you know hooks.',
    bullets: ['Artist trivia', 'Did you know angles', 'Headline seeds', 'Multilanguage-ready snippets'],
  },
  {
    title: 'Quotes',
    href: '/sources/media/quotes',
    icon: Quote,
    description: 'Quote database for captions, carousel overlays, and editorial pull-outs.',
    bullets: ['Short quote cards', 'Attribution-ready lines', 'Context notes', 'Fan-friendly tone'],
  },
  {
    title: 'Free Pictures Gallery',
    href: '/sources/gallery',
    icon: ImageIcon,
    description: 'Free and reusable picture hub for Creator cover images, overlays, and watermark rendering.',
    bullets: ['Profile photos', 'Editorial shots', 'Watermark-safe previews', 'Creator-ready picks'],
  },
  {
    title: 'Artists Gallery',
    href: '/sources/artists',
    icon: BookOpen,
    description: 'Artist registry and intelligence source that connects visual assets to real artist metadata.',
    bullets: ['Artist profiles', 'Source links', 'Gallery readiness', 'Tracking status'],
  },
]

const MEDIA_LAYERS = [
  {
    title: 'Rights Layer',
    description: 'Stores license type, provenance, and usage status so only free or approved content reaches Creator.',
    items: ['license', 'provenance', 'usage_status', 'source_url'],
    icon: ShieldCheck,
  },
  {
    title: 'Search & Tags',
    description: 'Filters by artist name, language, content type, mood, and source category.',
    items: ['artist', 'language', 'topic', 'mood', 'tags'],
    icon: Search,
  },
  {
    title: 'Quality Scoring',
    description: 'Ranks every item by freshness, confidence, relevance, and Creator readiness.',
    items: ['confidence', 'freshness', 'quality_score', 'ready_for_creator'],
    icon: Star,
  },
  {
    title: 'Multilingual Output',
    description: 'Keeps source text separate from localized variants for captions, overlays, and feed posts.',
    items: ['source_text', 'localized_variants', 'overlay_text', 'caption_text'],
    icon: Quote,
  },
]

const MEDIA_PREVIEW = {
  artist: 'Artist preview',
  title: 'Did you know that some artists build iconic eras from one visual detail?',
  caption: 'A premium Creator-ready preview combines a fact, a quote, a free image, and a watermark-safe layout.',
  license: 'Free / approved',
  language: 'en / cs / de',
  score: 92,
}

export default function SourcesMediaPage() {
  const [query, setQuery] = useState('')

  const filteredSections = useMemo(() => {
    const lower = query.trim().toLowerCase()
    if (!lower) return MEDIA_SECTIONS
    return MEDIA_SECTIONS.filter((section) => {
      return (
        section.title.toLowerCase().includes(lower) ||
        section.description.toLowerCase().includes(lower) ||
        section.bullets.some((bullet) => bullet.toLowerCase().includes(lower))
      )
    })
  }, [query])

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.94))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
              <Wand2 className="h-3.5 w-3.5" />
              Sources Media
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Free content database for Creator</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              MEDIA is the source layer for Creator. It organizes free facts, quotes, pictures, and artist gallery inputs into reusable content building blocks that can be turned into posts, cards, and multilingual output.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/creator-facts"
              className="flex items-center gap-2 border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-sm font-semibold text-[#E8E8E8] transition-colors hover:bg-white/[0.05]"
            >
              Open Creator Fact Builder
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Vault search</p>
            <p className="mt-1 text-sm text-[#A8A8A8]">Search the MEDIA vault by source type, topic, or intended Creator use.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search facts, quotes, gallery, rights..."
            className="w-full lg:w-[380px] border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-sm text-[#E8E8E8] outline-none placeholder:text-[#6E6E6E] focus:border-sky-500"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filteredSections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.title}
              href={section.href}
              className="group rounded-3xl border border-white/10 bg-black/70 p-5 transition-all hover:border-white/15 hover:bg-white/[0.03] backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
                  <Icon className="h-5 w-5 text-sky-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#404040] transition-transform group-hover:translate-x-0.5 group-hover:text-[#D0D0D0]" />
              </div>
              <h2 className="mt-4 text-lg font-black text-[#E8E8E8]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#A8A8A8]">{section.description}</p>
              <ul className="mt-4 space-y-1 text-xs text-[#A8A8A8]">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MEDIA_LAYERS.map((layer) => {
          const Icon = layer.icon
          return (
            <div key={layer.title} className="rounded-3xl border border-white/10 bg-black/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
                  <Icon className="h-5 w-5 text-sky-400" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E6E]">required</span>
              </div>
              <h2 className="mt-4 text-lg font-black text-[#E8E8E8]">{layer.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#A8A8A8]">{layer.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {layer.items.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-xs text-[#D0D0D0]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A8A8A8]">Creator source flow</p>
          <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">MEDIA → Creator</h2>
          <p className="mt-3 text-sm leading-6 text-[#A8A8A8]">
            MEDIA is meant to feed the Creator pipeline with clean source material. Fun facts become hook lines, quotes become overlays or captions, and images become watermark-ready cards.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A8A8A8]">Standard</p>
          <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">2026 content quality</h2>
          <p className="mt-3 text-sm leading-6 text-[#A8A8A8]">
            Every source in this section should be reusable, multilingual-ready, and safe for branded output with the HotDroppZ logo watermark present on final creative.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,1))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A8A8A8]">Watermark-safe preview</p>
            <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">Creator output preview</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#A8A8A8]">
            <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{MEDIA_PREVIEW.license}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">{MEDIA_PREVIEW.language}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1">score {MEDIA_PREVIEW.score}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md min-h-[220px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(39,39,42,0.9))]" />
            <div className="relative z-10 flex h-full flex-col justify-between p-5">
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E8E8E8]">
                  Did you know
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white">{MEDIA_PREVIEW.title}</h3>
                <p className="text-sm leading-6 text-[#E8E8E8]">{MEDIA_PREVIEW.caption}</p>
              </div>
              <img src="/icons/ICON.ico" alt="HotDroppZ watermark" className="h-14 w-14 object-contain opacity-70" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Required fields</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['fact', 'source', 'artist', 'language', 'topic', 'confidence', 'license', 'preview'].map((item) => (
                <span key={item} className={cn('rounded-full border px-2.5 py-1 text-xs', 'border-white/15 bg-black text-[#D0D0D0]')}>
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#A8A8A8]">
              <p>Artist: {MEDIA_PREVIEW.artist}</p>
              <p>Language set: {MEDIA_PREVIEW.language}</p>
              <p>Quality score: {MEDIA_PREVIEW.score}/100</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}