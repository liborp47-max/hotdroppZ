'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Sparkles, Image as ImageIcon, Quote, Zap, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type FunFact = {
  id: string
  title: string
  fact: string
  artist: string
  useCase: string
  tags: string[]
  confidence: number
}

type Quote = {
  id: string
  author: string
  quote: string
  source: string
  context: string
  tags: string[]
  confidence: number
}

type Picture = {
  id: string
  title: string
  source: string
  url: string
  license: string
  platform: string
  aspectRatio: string
  tags: string[]
  creatorSafe: boolean
}

type AssetBuilderProps = {
  onGenerate: (fact: FunFact, quote: Quote, picture: Picture) => Promise<void>
  isGenerating?: boolean
}

export function AssetBuilder({ onGenerate, isGenerating = false }: AssetBuilderProps) {
  const [facts, setFacts] = useState<FunFact[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pictures, setPictures] = useState<Picture[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selected assets
  const [selectedFact, setSelectedFact] = useState<FunFact | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [selectedPicture, setSelectedPicture] = useState<Picture | null>(null)

  // UI state
  const [openFactDropdown, setOpenFactDropdown] = useState(false)
  const [openQuoteDropdown, setOpenQuoteDropdown] = useState(false)
  const [openPictureDropdown, setOpenPictureDropdown] = useState(false)

  const loadAssets = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/assets')
      if (!res.ok) throw new Error('Failed to load assets')
      const data = await res.json()
      if (data.assets) {
        setFacts(data.assets.fun_facts || [])
        setQuotes(data.assets.quotes || [])
        setPictures(data.assets.pictures || [])

        // Auto-select first of each
        if (data.assets.fun_facts?.length) setSelectedFact(data.assets.fun_facts[0])
        if (data.assets.quotes?.length) setSelectedQuote(data.assets.quotes[0])
        if (data.assets.pictures?.length) setSelectedPicture(data.assets.pictures[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAssets()
  }, [])

  const isReady = selectedFact && selectedQuote && selectedPicture

  const handleGenerate = async () => {
    if (!isReady) return
    try {
      await onGenerate(selectedFact, selectedQuote, selectedPicture)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate post')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-[#00E085]" />
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[#E8E8E8]">Asset Builder</h3>
        </div>
        <p className="text-xs text-[#A8A8A8]">Pick a fact, quote, and picture. Preview below. Then generate post.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-[#A8A8A8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading media assets...</span>
        </div>
      ) : (
        <>
          {/* Three-column selector */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Fun Facts Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenFactDropdown(!openFactDropdown)}
                className={cn(
                  'w-full border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center justify-between',
                  openFactDropdown
                    ? 'border-[#00E085]/50 bg-[rgba(0,224,133,0.10)] text-[#E8E8E8]'
                    : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:border-white/15'
                )}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  Fact
                </span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', openFactDropdown && 'rotate-180')} />
              </button>
              {openFactDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-white/15 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-black/30 max-h-48 overflow-y-auto">
                  {facts.map((fact) => (
                    <button
                      key={fact.id}
                      onClick={() => {
                        setSelectedFact(fact)
                        setOpenFactDropdown(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 border-b border-white/10 last:border-b-0 hover:bg-white/[0.04] transition-colors text-xs',
                        selectedFact?.id === fact.id && 'bg-[#00E085]/20'
                      )}
                    >
                      <div className="font-semibold text-[#E8E8E8]">{fact.title}</div>
                      <div className="text-[11px] text-[#A8A8A8] mt-0.5 line-clamp-1">{fact.fact}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedFact && (
                <div className="mt-2 text-[11px] text-[#A8A8A8]">
                  <span className="text-[#00E085]">✓</span> {selectedFact.title}
                </div>
              )}
            </div>

            {/* Quotes Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenQuoteDropdown(!openQuoteDropdown)}
                className={cn(
                  'w-full border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center justify-between',
                  openQuoteDropdown
                    ? 'border-[#00E085]/50 bg-[rgba(0,224,133,0.10)] text-[#E8E8E8]'
                    : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:border-white/15'
                )}
              >
                <span className="flex items-center gap-2">
                  <Quote className="h-3 w-3" />
                  Quote
                </span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', openQuoteDropdown && 'rotate-180')} />
              </button>
              {openQuoteDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-white/15 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-black/30 max-h-48 overflow-y-auto">
                  {quotes.map((quote) => (
                    <button
                      key={quote.id}
                      onClick={() => {
                        setSelectedQuote(quote)
                        setOpenQuoteDropdown(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 border-b border-white/10 last:border-b-0 hover:bg-white/[0.04] transition-colors text-xs',
                        selectedQuote?.id === quote.id && 'bg-[#00E085]/20'
                      )}
                    >
                      <div className="font-semibold text-[#E8E8E8]">{quote.author}</div>
                      <div className="text-[11px] text-[#A8A8A8] mt-0.5 line-clamp-1">"{quote.quote}"</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedQuote && (
                <div className="mt-2 text-[11px] text-[#A8A8A8]">
                  <span className="text-[#00E085]">✓</span> {selectedQuote.author}
                </div>
              )}
            </div>

            {/* Pictures Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenPictureDropdown(!openPictureDropdown)}
                className={cn(
                  'w-full border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center justify-between',
                  openPictureDropdown
                    ? 'border-[#00E085]/50 bg-[rgba(0,224,133,0.10)] text-[#E8E8E8]'
                    : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:border-white/15'
                )}
              >
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" />
                  Picture
                </span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', openPictureDropdown && 'rotate-180')} />
              </button>
              {openPictureDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-white/15 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-black/30 max-h-48 overflow-y-auto">
                  {pictures.map((pic) => (
                    <button
                      key={pic.id}
                      onClick={() => {
                        setSelectedPicture(pic)
                        setOpenPictureDropdown(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 border-b border-white/10 last:border-b-0 hover:bg-white/[0.04] transition-colors text-xs',
                        selectedPicture?.id === pic.id && 'bg-[#00E085]/20'
                      )}
                    >
                      <div className="font-semibold text-[#E8E8E8]">{pic.title}</div>
                      <div className="text-[11px] text-[#A8A8A8] mt-0.5">
                        {pic.license === 'cc0' ? '📜 CC0' : pic.license === 'artist-approved' ? '⭐ Artist' : '🔓 Free'} · {pic.aspectRatio}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedPicture && (
                <div className="mt-2 text-[11px] text-[#A8A8A8]">
                  <span className="text-[#00E085]">✓</span> {selectedPicture.title}
                </div>
              )}
            </div>
          </div>

          {/* Live Preview */}
          {isReady && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md">
              <div className="relative min-h-56 bg-white/[0.03] backdrop-blur-md overflow-hidden">
                {selectedPicture?.url && (
                  <img src={selectedPicture.url} alt="preview" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background: selectedPicture?.url
                      ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(9,9,11,0.8) 100%)'
                      : 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #65a30d 100%)',
                  }}
                />
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase text-[#E8E8E8]">
                      {selectedFact.useCase.replace(/_/g, ' ')}
                    </div>
                    <p className="text-lg font-black text-white leading-tight drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
                      {selectedFact.fact.slice(0, 80)}...
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[#D0D0D0] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">"{selectedQuote.quote.slice(0, 60)}..."</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={() => void handleGenerate()}
            disabled={!isReady || isGenerating}
            className={cn(
              'w-full px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition-colors flex items-center justify-center gap-2',
              isReady && !isGenerating
                ? 'bg-[#00E085] text-black hover:bg-[#1AEE99]'
                : 'cursor-not-allowed bg-white/[0.05] text-[#6E6E6E]'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                Generate Post from Assets
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}
