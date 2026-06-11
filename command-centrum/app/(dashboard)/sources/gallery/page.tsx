'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, ArrowRight, Globe2, Image as ImageIcon, Loader2, RefreshCw, Sparkles, ShieldCheck, Star } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

type GalleryArtist = {
  id: string
  name: string
  country: string
  genre: string
  base_score: number
  is_tracking_active: boolean
  last_checked: string | null
  total_releases: number
  profile_image_url: string | null
}

type GalleryStats = {
  withProfileImage: number
  trackedArtists: number
}

type OnlineSource = {
  name: string
  href: string
  license: string
  usage: string
  creatorSafe: boolean
  note: string
}

const ONLINE_SOURCES: OnlineSource[] = [
  {
    name: 'Unsplash',
    href: 'https://unsplash.com',
    license: 'Unsplash License',
    usage: 'Editorial portrait style, hero crops, background texture',
    creatorSafe: true,
    note: 'Use only images that are reusable and on-brand for the post layout.',
  },
  {
    name: 'Pexels',
    href: 'https://www.pexels.com',
    license: 'Pexels License',
    usage: 'Free picture gallery, lifestyle shots, cover art support',
    creatorSafe: true,
    note: 'Good for free image discovery when artist-owned photos are unavailable.',
  },
  {
    name: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org',
    license: 'Varies by asset',
    usage: 'Reference images, public domain assets, archival photos',
    creatorSafe: true,
    note: 'Check the individual file license before using in production.',
  },
  {
    name: 'Pixabay',
    href: 'https://pixabay.com',
    license: 'Pixabay License',
    usage: 'Free gallery backup for visuals and atmospheric imagery',
    creatorSafe: true,
    note: 'Use for supporting imagery; keep artist likeness checks strict.',
  },
]

export default function SourcesGalleryPage() {
  const supabase = createClient()
  const [artists, setArtists] = useState<GalleryArtist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGallery = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('artists')
        .select('id,name,country,genre,base_score,is_tracking_active,last_checked,total_releases,profile_image_url')
        .order('base_score', { ascending: false })
        .limit(120)

      if (fetchError) throw fetchError
      setArtists((data as GalleryArtist[] | null) ?? [])
    } catch (fetchError) {
      setArtists([])
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery data')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadGallery()
  }, [loadGallery])

  const stats = useMemo<GalleryStats>(() => {
    const withProfileImage = artists.filter((artist) => Boolean(artist.profile_image_url)).length
    return {
      withProfileImage,
      trackedArtists: artists.filter((artist) => artist.is_tracking_active).length,
    }
  }, [artists])

  const creatorReadyCount = useMemo(() => {
    return artists.filter((artist) => Boolean(artist.profile_image_url) || artist.is_tracking_active).length
  }, [artists])

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,224,133,0.18),_transparent_30%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.94))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1AEE99]">
              <Sparkles className="h-3.5 w-3.5" />
              Sources Gallery
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#E8E8E8]">Artist image hub for Creator</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8A8A8]">
              This section gathers profile-ready artist visuals so Creator can build premium Did you know cards with a proper image source, a clean editorial composition, and a permanent HotDroppZ watermark.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void loadGallery()}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                isLoading ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-[#6E6E6E]' : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#E8E8E8] hover:bg-white/[0.05]'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Reload
            </button>
            <Link
              href="/sources/artists"
              className="flex items-center gap-2 bg-[#00E085] px-4 py-3 text-sm font-black text-black transition-colors hover:bg-[#1AEE99]"
            >
              Open AIL
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Creator-safe pool</span>
            <ShieldCheck className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{ONLINE_SOURCES.length}</div>
          <p className="mt-2 text-xs text-[#A8A8A8]">External free source collections connected to the gallery.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Creator-ready items</span>
            <Star className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{creatorReadyCount}</div>
          <p className="mt-2 text-xs text-[#A8A8A8]">Artists with images or active tracking can feed Creator cards.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">License rule</span>
            <Globe2 className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-lg font-bold text-[#E8E8E8]">Only free / approved assets</div>
          <p className="mt-2 text-xs text-[#A8A8A8]">No asset enters Creator unless its usage is clear and safe.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/70 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Connected online sources</p>
            <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">Free galleries and image sources</h2>
            <p className="mt-2 text-sm text-[#A8A8A8]">These external sources are linked directly so the gallery can grow beyond the local artist registry.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ONLINE_SOURCES.map((source) => (
            <a
              key={source.name}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 transition-colors hover:border-white/15 hover:bg-white/[0.03] backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-white/10 bg-black">
                  <ImageIcon className="h-4 w-4 text-[#00E085]" />
                </div>
                <ArrowRight className="h-4 w-4 text-[#404040] transition-transform group-hover:translate-x-0.5 group-hover:text-[#D0D0D0]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-[#E8E8E8]">{source.name}</h3>
              <p className="mt-2 text-xs text-[#A8A8A8]">{source.license}</p>
              <p className="mt-2 text-sm leading-6 text-[#A8A8A8]">{source.usage}</p>
              <p className={cn('mt-3 text-xs font-semibold', source.creatorSafe ? 'text-[#1AEE99]' : 'text-amber-300')}>
                {source.creatorSafe ? 'Creator-safe when license conditions are met' : 'Requires manual review'}
              </p>
              <p className="mt-2 text-xs text-[#A8A8A8]">{source.note}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,1))] p-5">
        <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8A8A8]">Creator usage</p>
            <h2 className="mt-2 text-xl font-black text-[#E8E8E8]">How Creator should use gallery content</h2>
            <p className="mt-2 text-sm text-[#A8A8A8]">Only content marked free or approved should go forward. Creator can use it for feed cards, story cards, and quote cards with watermark applied at render time.</p>
          </div>
          <div className="grid gap-2 text-xs text-[#A8A8A8] sm:grid-cols-2">
            {['feed cards', 'story cards', 'quote cards', 'multilingual overlays'].map((item) => (
              <span key={item} className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-center">
                {item}
              </span>
            ))}
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
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Profile images</span>
            <ImageIcon className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{stats.withProfileImage}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Tracked artists</span>
            <Sparkles className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{stats.trackedArtists}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Watermark mode</span>
            <ImageIcon className="h-4 w-4 text-[#00E085]" />
          </div>
          <div className="mt-3 text-lg font-bold text-[#E8E8E8]">Always embedded</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {isLoading && artists.length === 0 ? (
          <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-[#A8A8A8]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading gallery artists...
          </div>
        ) : artists.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.03] backdrop-blur-md p-10 text-center">
            <p className="text-sm text-[#A8A8A8]">No artists available in the gallery yet.</p>
            <p className="mt-2 text-xs text-[#6E6E6E]">Add artist image metadata in Sources AIL to power this gallery.</p>
          </div>
        ) : (
          artists.map((artist) => (
            <div key={artist.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/70">
              <div className="relative min-h-[240px] bg-white/[0.03] backdrop-blur-md">
                {artist.profile_image_url ? (
                  <img src={artist.profile_image_url} alt={artist.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="relative z-10 flex h-full min-h-[240px] flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1AEE99]">{artist.country}</p>
                      <h2 className="text-2xl font-black text-white">{artist.name}</h2>
                    </div>
                    <span className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                      artist.is_tracking_active
                        ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8]'
                    )}>
                      {artist.is_tracking_active ? 'tracked' : 'idle'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#D0D0D0]">{artist.genre}</p>
                      <p className="mt-1 text-sm text-[#E8E8E8]">Score {artist.base_score} · releases {artist.total_releases}</p>
                    </div>
                    <img
                      src="/icons/ICON.ico"
                      alt="HotDroppZ watermark"
                      className="h-12 w-12 object-contain opacity-70"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm text-[#D0D0D0]">{artist.profile_image_url ? 'Profile image ready for Creator and editorial reuse.' : 'No profile image yet. Use AIL to enrich the gallery.'}</p>
                <p className="text-xs text-[#A8A8A8]">Last checked: {artist.last_checked ? timeAgo(artist.last_checked) : 'unknown'}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}