'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateArtistOverview, updateArtistTracking, updateArtistLinks } from '@/lib/actions/artists'
import { IntelProgressModal } from '@/components/sources/intel-progress-modal'
import { IntelResultModal, type IntelResultModalData } from '@/components/sources/intel-result-modal'
import type { ArtistIntelRunState } from '@/lib/services/artist-intel-progress'
import {
  ChevronRight, Save, Trash2, RefreshCw, ExternalLink,
  Music, CheckCircle, Circle, ArrowLeft,
  Plus, X, Sparkles,
} from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

type Artist = {
  id: string
  name: string
  normalized_name: string
  aliases: string[]
  negative_keywords: string[]
  country: string
  city: string | null
  genre: string
  genres: string[]
  description: string | null
  tags: string[]
  metadata: Record<string, unknown> | null
  base_score: number
  priority_level: 'low' | 'medium' | 'high' | 'critical'
  is_active: boolean
  is_tracking_active: boolean
  tracking_enabled: boolean
  last_release_at: string | null
  last_checked: string | null
  total_releases: number
  profile_image_url: string | null
  cover_image_url: string | null
  spotify_url: string | null
  youtube_url: string | null
  apple_music_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  genius_url: string | null
  website_url: string | null
  created_at: string
  updated_at: string
}

type ArtistLinks = {
  id?: string
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  youtube_channel_id: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  soundcloud_url: string | null
  genius_url: string | null
  spotify_id: string | null
  apple_music_id: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  spotify_verified: boolean
  apple_verified: boolean
  youtube_verified: boolean
  instagram_verified: boolean
  facebook_verified: boolean
  tiktok_verified: boolean
  soundcloud_verified: boolean
  genius_verified: boolean
  last_enriched_at: string | null
}

type ArtistRelease = {
  id: string
  title: string
  type: string
  release_date: string
  platform: string | null
  url: string | null
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  thumbnail: string | null
  is_new_release: boolean
  is_hot_trend: boolean
  created_at: string
}

type ArtistImage = {
  id: string
  image_url: string
  type: 'profile' | 'cover' | 'gallery' | 'banner'
  width: number | null
  height: number | null
  uploaded_at: string
}

type Tab = 'overview' | 'gallery' | 'platforms' | 'official' | 'tracking' | 'releases'

function createPendingIntelRun(input: {
  runId: string
  mode: 'single' | 'bulk'
  artistName?: string | null
  total: number
  currentStep: string
}): ArtistIntelRunState {
  return {
    runId: input.runId,
    status: 'running',
    mode: input.mode,
    artistName: input.artistName ?? null,
    currentStep: input.currentStep,
    sourcesUsed: [],
    findings: [],
    completedActions: [],
    updatedFields: [],
    confidence: null,
    processed: 0,
    total: input.total,
    startedAt: Date.now(),
    finishedAt: null,
    logs: [{ timestamp: Date.now(), message: input.currentStep }],
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high:     'bg-orange-500/20 text-orange-400',
  medium:   'bg-white/[0.06] text-[#A8A8A8]',
  low:      'bg-white/[0.04] text-[#6E6E6E]',
}

const COUNTRIES = ['cz','sk','de','fr','it','es','nl','pl','ru','sr','hr','bs','us','uk','global']
const GENRES    = ['rap','hiphop','drill','trap','rnb','grime','afrobeat','reggaeton','latin','other']

const DESCRIPTION_LABEL_PREFIXES = [
  /^Kdo to je:\s*/i,
  /^Pochazi z:\s*/i,
  /^Co dela:\s*/i,
  /^Zajimavosti:\s*/i,
  /^Detstvi:\s*/i,
  /^Jak se proslavil:\s*/i,
  /^Klicove body kariery:\s*/i,
  /^Zdroj bio:\s*/i,
]

function cleanDescriptionForUi(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .split('\n')
    .map((line) => {
      let next = line
      for (const re of DESCRIPTION_LABEL_PREFIXES) {
        next = next.replace(re, '')
      }
      return next.trimEnd()
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned || null
}

function getOfficialWebsite(artist: Artist | null): string | null {
  if (!artist) return null
  const metadataWebsite = (artist.metadata as { artist_intel?: { official_website?: string | null } } | null | undefined)?.artist_intel?.official_website ?? null
  return artist.website_url ?? metadataWebsite
}

function formatIntelField(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const EMPTY_LINKS: ArtistLinks = {
  spotify_url: null, apple_music_url: null, youtube_url: null, youtube_channel_id: null,
  instagram_url: null, facebook_url: null, tiktok_url: null, soundcloud_url: null, genius_url: null,
  spotify_id: null, apple_music_id: null, instagram_handle: null, tiktok_handle: null,
  spotify_verified: false, apple_verified: false, youtube_verified: false, instagram_verified: false,
  facebook_verified: false, tiktok_verified: false, soundcloud_verified: false, genius_verified: false,
  last_enriched_at: null,
}

export default function ArtistProfilePage() {
  const params    = useParams()
  const router    = useRouter()
  const supabase  = createClient()
  const artistId  = params.id as string

  const [artist,   setArtist]   = useState<Artist | null>(null)
  const [links,    setLinks]    = useState<ArtistLinks>(EMPTY_LINKS)
  const [releases, setReleases] = useState<ArtistRelease[]>([])
  const [galleryImages, setGalleryImages] = useState<ArtistImage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<Tab>('overview')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [intelModal, setIntelModal] = useState<IntelResultModalData | null>(null)
  const [progressRunId, setProgressRunId] = useState<string | null>(null)
  const [progressRun, setProgressRun] = useState<ArtistIntelRunState | null>(null)
  const [progressOpen, setProgressOpen] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [newNegKw, setNewNegKw] = useState('')
  const [newRelease, setNewRelease] = useState({ title:'', type:'track', release_date:'', url:'' })
  const [showAddRelease, setShowAddRelease] = useState(false)

  // Editable copies
  const [editArtist, setEditArtist] = useState<Partial<Artist>>({})
  const [editLinks,  setEditLinks]  = useState<ArtistLinks>(EMPTY_LINKS)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: r }, { data: g }] = await Promise.all([
      supabase.from('artists').select('*').eq('id', artistId).single(),
      supabase.from('artist_links').select('*').eq('artist_id', artistId).maybeSingle(),
      supabase.from('artist_releases').select('*').eq('artist_id', artistId).order('release_date', { ascending: false }).limit(50),
      supabase.from('artist_images').select('id,image_url,type,width,height,uploaded_at').eq('artist_id', artistId).eq('type', 'gallery').order('uploaded_at', { ascending: false }).limit(30),
    ])
    if (!a) { router.push('/sources/artists'); return }
    const cleanedArtist = {
      ...(a as Artist),
      description: cleanDescriptionForUi((a as Artist).description),
    }
    setArtist(cleanedArtist)
    setEditArtist(cleanedArtist)
    const linksData = (l as ArtistLinks | null) ?? EMPTY_LINKS
    setLinks(linksData)
    setEditLinks(linksData)
    setReleases((r as ArtistRelease[]) ?? [])
    setGalleryImages((g as ArtistImage[]) ?? [])
    setLoading(false)
  }, [artistId, router, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!progressRunId || !progressOpen) return

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/artist/enrich?runId=${encodeURIComponent(progressRunId)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as ArtistIntelRunState
        if (cancelled) return
        setProgressRun(data)
        if (data.status === 'completed' || data.status === 'error' || data.status === 'stopped') {
          return
        }
      } catch {
        return
      }
      if (!cancelled) {
        setTimeout(poll, 800)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [progressRunId, progressOpen])

  async function saveOverview() {
    setSaving(true)
    try {
      await updateArtistOverview(artistId, {
        name:              editArtist.name ?? '',
        country:           editArtist.country ?? '',
        city:              editArtist.city ?? null,
        genre:             editArtist.genre ?? '',
        description:       cleanDescriptionForUi(editArtist.description),
        aliases:           editArtist.aliases ?? [],
        negative_keywords: editArtist.negative_keywords ?? [],
        tags:              editArtist.tags ?? [],
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000); await load()
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Save failed'))
    } finally { setSaving(false) }
  }

  async function saveTracking() {
    setSaving(true)
    try {
      await updateArtistTracking(artistId, {
        base_score:         editArtist.base_score ?? 50,
        priority_level:     editArtist.priority_level ?? 'medium',
        is_active:          editArtist.is_active ?? false,
        is_tracking_active: editArtist.is_tracking_active ?? false,
        tracking_enabled:   editArtist.tracking_enabled ?? false,
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000); await load()
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Save failed'))
    } finally { setSaving(false) }
  }

  async function savePlatforms() {
    setSaving(true)
    try {
      await updateArtistLinks(artistId, editLinks, !!links.id)
      setSaved(true); setTimeout(() => setSaved(false), 2000); await load()
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Save failed'))
    } finally { setSaving(false) }
  }

  async function addRelease(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('artist_releases').insert({
      artist_id:    artistId,
      title:        newRelease.title,
      type:         newRelease.type,
      release_date: newRelease.release_date || new Date().toISOString().split('T')[0],
      url:          newRelease.url || null,
      is_new_release: true,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowAddRelease(false)
    setNewRelease({ title:'', type:'track', release_date:'', url:'' })
    load()
  }

  async function deleteArtist() {
    if (!confirm(`Permanently delete ${artist?.name}? This cannot be undone.`)) return
    await supabase.from('artists').delete().eq('id', artistId)
    router.push('/sources/artists')
  }

  const addAlias = () => {
    if (!newAlias.trim()) return
    setEditArtist({ ...editArtist, aliases: [...(editArtist.aliases ?? []), newAlias.trim()] })
    setNewAlias('')
  }

  const removeAlias = (alias: string) =>
    setEditArtist({ ...editArtist, aliases: (editArtist.aliases ?? []).filter(a => a !== alias) })

  const addNegKw = () => {
    const kw = newNegKw.trim().toLowerCase()
    if (!kw) return
    if ((editArtist.negative_keywords ?? []).includes(kw)) { setNewNegKw(''); return }
    setEditArtist({ ...editArtist, negative_keywords: [...(editArtist.negative_keywords ?? []), kw] })
    setNewNegKw('')
  }

  const removeNegKw = (kw: string) =>
    setEditArtist({ ...editArtist, negative_keywords: (editArtist.negative_keywords ?? []).filter(k => k !== kw) })

  async function getIntel() {
    const runId = crypto.randomUUID()
    setEnriching(true)
    setEnrichMsg('Get Intel running...')
    setProgressRunId(runId)
    setProgressRun(createPendingIntelRun({
      runId,
      mode: 'single',
      artistName: artist?.name ?? 'Artist',
      total: 1,
      currentStep: `Starting Get Intel for ${artist?.name ?? 'Artist'}...`,
    }))
    setProgressOpen(true)
    try {
      const res = await fetch('/api/artist/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, mode: 'full', runId }),
      })
      const data = await res.json()
      if (!res.ok) { setEnrichMsg(`Error: ${data.error}`); return }
      const fields = (data.updated_fields as string[] | undefined) ?? []
      if (fields.length > 0) setEnrichMsg(`Updated: ${fields.join(', ')}`)
      else setEnrichMsg('Intel refreshed')
      const officialPages = [
        (data.website_url as string | null | undefined) ?? null,
        ...((data.official_pages as string[] | undefined) ?? []),
      ].filter((value): value is string => Boolean(value))
      const galleryImages = (data.gallery_image_urls as string[] | undefined) ?? []
      setIntelModal({
        title: `${artist?.name ?? 'Artist'} Intel Complete`,
        summary: fields.length > 0 ? `${fields.length} fields were filled or refreshed.` : 'Intel refresh completed without new field changes.',
        badges: [
          `Confidence ${Math.round((((data.confidence as number | undefined) ?? 0) * 100))}%`,
          ...(((data.sources as string[] | undefined) ?? []).map((source) => source.toUpperCase())),
        ],
        sections: [
          {
            title: 'Filled Data',
            items: fields.length > 0 ? fields.map(formatIntelField) : ['No new fields were added.'],
          },
          {
            title: 'Official Pages',
            items: officialPages.length > 0 ? officialPages : ['No official pages found yet.'],
          },
          {
            title: 'Pictures',
            items: [
              data.profile_image_url ? `Profile image: ${data.profile_image_url}` : 'No profile image found yet.',
              galleryImages.length > 0 ? `Gallery images: ${galleryImages.length}` : 'No gallery images found yet.',
            ],
          },
        ],
      })
      await load()
    } catch {
      setEnrichMsg('Request failed')
    } finally {
      setEnriching(false)
    }
  }

  async function refreshGalleryIntel() {
    const runId = crypto.randomUUID()
    setEnriching(true)
    setEnrichMsg('Refreshing gallery with current artist photos...')
    setProgressRunId(runId)
    setProgressRun(createPendingIntelRun({
      runId,
      mode: 'single',
      artistName: artist?.name ?? 'Artist',
      total: 1,
      currentStep: `Refreshing gallery for ${artist?.name ?? 'Artist'}...`,
    }))
    setProgressOpen(true)
    try {
      const res = await fetch('/api/artist/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, mode: 'full', refreshGallery: true, runId }),
      })
      const data = await res.json()
      if (!res.ok) { setEnrichMsg(`Error: ${data.error}`); return }
      setEnrichMsg('Gallery replaced with refreshed artist-connected photos')
      const fields = (data.updated_fields as string[] | undefined) ?? []
      const officialPages = [
        (data.website_url as string | null | undefined) ?? null,
        ...((data.official_pages as string[] | undefined) ?? []),
      ].filter((value): value is string => Boolean(value))
      const galleryImages = (data.gallery_image_urls as string[] | undefined) ?? []
      setIntelModal({
        title: `${artist?.name ?? 'Artist'} Gallery Refresh Complete`,
        summary: 'Current gallery pictures were replaced with refreshed artist-connected photos.',
        badges: [
          `Confidence ${Math.round((((data.confidence as number | undefined) ?? 0) * 100))}%`,
          ...(((data.sources as string[] | undefined) ?? []).map((source) => source.toUpperCase())),
        ],
        sections: [
          {
            title: 'Filled Data',
            items: fields.length > 0 ? fields.map(formatIntelField) : ['Gallery refresh completed.'],
          },
          {
            title: 'Gallery Status',
            items: [`${Math.min(5, hqGalleryImages.length)} high-quality images are currently visible before reload.`],
          },
          {
            title: 'Official Pages',
            items: officialPages.length > 0 ? officialPages : ['No official pages found yet.'],
          },
          {
            title: 'Pictures',
            items: [
              data.profile_image_url ? `Profile image: ${data.profile_image_url}` : 'No profile image found yet.',
              galleryImages.length > 0 ? `Gallery images: ${galleryImages.length}` : 'No gallery images found yet.',
            ],
          },
        ],
      })
      await load()
    } catch {
      setEnrichMsg('Request failed')
    } finally {
      setEnriching(false)
    }
  }

  if (loading) return <div className="p-6 text-[#6E6E6E] text-sm">Loading artist profile…</div>
  if (!artist) return null

  const hqGalleryImages = galleryImages
    .filter((image) => (image.width ?? 0) >= 1200 && (image.height ?? 0) >= 800)
    .slice(0, 5)

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <IntelProgressModal open={progressOpen} run={progressRun} onClose={() => setProgressOpen(false)} />
      <IntelResultModal open={!!intelModal} data={intelModal} onClose={() => setIntelModal(null)} />
      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[#6E6E6E] mb-2">
          <Link href="/sources" className="hover:text-[#A8A8A8]">Sources</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/sources/artists" className="hover:text-[#A8A8A8]">AIL</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#A8A8A8]">{artist.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {artist.profile_image_url ? (
              <img src={artist.profile_image_url} alt={artist.name}
                className="h-14 w-14 rounded-full object-cover border-2 border-white/15 shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-white/[0.05] border-2 border-white/15 flex items-center justify-center shrink-0">
                <Music className="h-6 w-6 text-[#6E6E6E]" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-[#E8E8E8]">{artist.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-[#A8A8A8]">{artist.country}</span>
                <span className="text-xs text-[#6E6E6E]">·</span>
                <span className="text-xs text-[#A8A8A8]">{artist.genre}</span>
                <span className={cn('px-1.5 py-0.5 text-[9px] font-semibold uppercase', PRIORITY_COLORS[artist.priority_level])}>
                  {artist.priority_level}
                </span>
                <span className="text-[10px] font-mono text-[#6E6E6E]">score {Math.round(artist.base_score)}</span>
                {artist.is_active
                  ? <span className="px-1.5 py-0.5 text-[8px] bg-green-500/15 text-[#00E085]">active</span>
                  : <span className="px-1.5 py-0.5 text-[8px] bg-white/[0.05] text-[#6E6E6E]">inactive</span>
                }
              </div>
              <p className="text-[10px] text-[#6E6E6E] mt-1">
                {artist.total_releases} releases · Last: {artist.last_release_at ? timeAgo(artist.last_release_at) : 'never'} · Added {timeAgo(artist.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/sources/artists" className="flex items-center gap-1 px-2.5 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] transition-colors">
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <button onClick={deleteArtist} className="flex items-center gap-1 px-2.5 py-1.5 border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(['overview', 'gallery', 'platforms', 'official', 'tracking', 'releases'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-venom-500 text-[#E8E8E8]'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── TAB: OVERVIEW ────────────────────────────────────────────────────────── */}
      {tab === 'overview' && editArtist && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Artist Name">
              <input type="text" value={editArtist.name ?? ''}
                onChange={e=>setEditArtist({...editArtist, name:e.target.value})}
                className={inputCls}
              />
            </FormField>
            <FormField label="City">
              <input type="text" value={editArtist.city ?? ''}
                onChange={e=>setEditArtist({...editArtist, city:e.target.value})}
                placeholder="Optional" className={inputCls}
              />
            </FormField>
            <FormField label="Country">
              <select value={editArtist.country ?? ''} onChange={e=>setEditArtist({...editArtist, country:e.target.value})}
                className={inputCls}
              >
                {COUNTRIES.map(c=><option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </FormField>
            <FormField label="Genre">
              <select value={editArtist.genre ?? ''} onChange={e=>setEditArtist({...editArtist, genre:e.target.value})}
                className={inputCls}
              >
                {GENRES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Description / Biography">
            <textarea value={editArtist.description ?? ''} rows={4}
              onChange={e=>setEditArtist({...editArtist, description:e.target.value})}
              placeholder="Artist bio, context, key facts…" className={cn(inputCls, 'resize-none')}
            />
          </FormField>

          <FormField label="Aliases / Stage Names">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(editArtist.aliases ?? []).map(alias => (
                <span key={alias} className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.05] text-xs text-[#D0D0D0]">
                  {alias}
                  <button onClick={() => removeAlias(alias)} className="text-[#6E6E6E] hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newAlias} onChange={e=>setNewAlias(e.target.value)}
                onKeyDown={e=>e.key==='Enter' && (e.preventDefault(), addAlias())}
                placeholder="Add alias… (Enter to add)" className={cn(inputCls, 'flex-1')}
              />
              <button onClick={addAlias} className="px-3 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </FormField>

          <FormField label="Negative Keywords">
            <p className="text-[10px] text-[#6E6E6E] mb-2">
              Words that disqualify an article from being tagged with this artist. Matched against full article text (case-insensitive).
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(editArtist.negative_keywords ?? []).map(kw => (
                <span key={kw} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {kw}
                  <button onClick={() => removeNegKw(kw)} className="text-red-600 hover:text-red-300 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {(editArtist.negative_keywords ?? []).length === 0 && (
                <span className="text-[10px] text-[#404040] italic">None — all articles containing this artist name will be tagged</span>
              )}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newNegKw} onChange={e=>setNewNegKw(e.target.value)}
                onKeyDown={e=>e.key==='Enter' && (e.preventDefault(), addNegKw())}
                placeholder="Add keyword… (Enter to add)" className={cn(inputCls, 'flex-1')}
              />
              <button onClick={addNegKw} className="px-3 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </FormField>

          <SaveBar saving={saving} saved={saved} onSave={saveOverview} />
        </div>
      )}

      {/* ─── TAB: GALLERY ────────────────────────────────────────────────────────── */}
      {tab === 'gallery' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Gallery</h3>
              <span className="text-[10px] text-[#6E6E6E]">{hqGalleryImages.length}/5 artist-connected HQ photos</span>
            </div>

            {hqGalleryImages.length >= 5 ? (
              <p className="text-xs text-[#00E085]">Gallery ready for pipeline: 5 artist-connected professional photos available.</p>
            ) : (
              <p className="text-xs text-yellow-400">Gallery incomplete. Run Get Intel to fill at least 5 artist-connected professional photos.</p>
            )}

            {hqGalleryImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {hqGalleryImages.map((image) => (
                  <a key={image.id} href={image.image_url} target="_blank" rel="noopener noreferrer" className="group block">
                    <img
                      src={image.image_url}
                      alt={`${artist.name} gallery`}
                      className="h-28 w-full object-cover border border-white/15 group-hover:border-white/20 transition-colors"
                    />
                    <p className="text-[9px] text-[#6E6E6E] mt-1">
                      {image.width && image.height ? `${image.width}x${image.height}` : 'unknown size'}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6E6E6E]">No gallery images yet. Run Get Intel to generate artist-connected professional photos.</p>
            )}

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={refreshGalleryIntel}
                disabled={enriching}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-yellow-500/30 text-xs text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 transition-colors"
              >
                {enriching
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />
                }
                {enriching ? 'Refreshing Gallery…' : 'Refresh Gallery With Get Intel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: PLATFORMS ───────────────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="space-y-4">
          <p className="text-xs text-[#6E6E6E]">Platform URLs and IDs used by the pipeline for enrichment and tracking.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlatformSection title="Spotify" color="text-[#00E085]" verified={editLinks.spotify_verified}>
              <FormField label="Artist / Track URL">
                <input type="url" value={editLinks.spotify_url ?? ''} placeholder="https://open.spotify.com/artist/…"
                  onChange={e=>setEditLinks({...editLinks, spotify_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="Spotify ID">
                <input type="text" value={editLinks.spotify_id ?? ''} placeholder="Artist ID from Spotify"
                  onChange={e=>setEditLinks({...editLinks, spotify_id:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <VerifiedToggle checked={editLinks.spotify_verified} onChange={v=>setEditLinks({...editLinks, spotify_verified:v})} />
            </PlatformSection>

            <PlatformSection title="Apple Music" color="text-pink-400" verified={editLinks.apple_verified}>
              <FormField label="Artist / Song URL">
                <input type="url" value={editLinks.apple_music_url ?? ''} placeholder="https://music.apple.com/…"
                  onChange={e=>setEditLinks({...editLinks, apple_music_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="Apple Music ID">
                <input type="text" value={editLinks.apple_music_id ?? ''} placeholder="Apple Music artist ID"
                  onChange={e=>setEditLinks({...editLinks, apple_music_id:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <VerifiedToggle checked={editLinks.apple_verified} onChange={v=>setEditLinks({...editLinks, apple_verified:v})} />
            </PlatformSection>

            <PlatformSection title="YouTube" color="text-red-400" verified={editLinks.youtube_verified}>
              <FormField label="Channel URL">
                <input type="url" value={editLinks.youtube_url ?? ''} placeholder="https://youtube.com/@…"
                  onChange={e=>setEditLinks({...editLinks, youtube_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="Channel ID">
                <input type="text" value={editLinks.youtube_channel_id ?? ''} placeholder="UC… channel ID"
                  onChange={e=>setEditLinks({...editLinks, youtube_channel_id:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <VerifiedToggle checked={editLinks.youtube_verified} onChange={v=>setEditLinks({...editLinks, youtube_verified:v})} />
            </PlatformSection>

            <PlatformSection title="Instagram" color="text-purple-400" verified={editLinks.instagram_verified}>
              <FormField label="Profile URL">
                <input type="url" value={editLinks.instagram_url ?? ''} placeholder="https://instagram.com/…"
                  onChange={e=>setEditLinks({...editLinks, instagram_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="@handle">
                <input type="text" value={editLinks.instagram_handle ?? ''} placeholder="@handle (without @)"
                  onChange={e=>setEditLinks({...editLinks, instagram_handle:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <VerifiedToggle checked={editLinks.instagram_verified} onChange={v=>setEditLinks({...editLinks, instagram_verified:v})} />
            </PlatformSection>

            <PlatformSection title="TikTok" color="text-blue-400" verified={editLinks.tiktok_verified}>
              <FormField label="Profile URL">
                <input type="url" value={editLinks.tiktok_url ?? ''} placeholder="https://tiktok.com/@…"
                  onChange={e=>setEditLinks({...editLinks, tiktok_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="@handle">
                <input type="text" value={editLinks.tiktok_handle ?? ''} placeholder="@handle"
                  onChange={e=>setEditLinks({...editLinks, tiktok_handle:e.target.value||null})} className={inputCls}
                />
              </FormField>
            </PlatformSection>

            <PlatformSection title="Other Platforms" color="text-[#A8A8A8]">
              <FormField label="Facebook URL">
                <input type="url" value={editLinks.facebook_url ?? ''} placeholder="https://facebook.com/…"
                  onChange={e=>setEditLinks({...editLinks, facebook_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="SoundCloud URL">
                <input type="url" value={editLinks.soundcloud_url ?? ''} placeholder="https://soundcloud.com/…"
                  onChange={e=>setEditLinks({...editLinks, soundcloud_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
              <FormField label="Genius URL">
                <input type="url" value={editLinks.genius_url ?? ''} placeholder="https://genius.com/artists/…"
                  onChange={e=>setEditLinks({...editLinks, genius_url:e.target.value||null})} className={inputCls}
                />
              </FormField>
            </PlatformSection>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={getIntel}
                disabled={enriching}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
              >
                {enriching
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                }
                {enriching ? 'Getting Intel…' : 'Get Intel'}
              </button>
              {enrichMsg && (
                <span className={cn('text-xs', enrichMsg.startsWith('Error') ? 'text-red-400' : 'text-[#00E085]')}>
                  {enrichMsg}
                </span>
              )}
              {editLinks.last_enriched_at && (
                <span className="text-[10px] text-[#6E6E6E]">Last enriched: {timeAgo(editLinks.last_enriched_at)}</span>
              )}
            </div>
          </div>

          <SaveBar saving={saving} saved={saved} onSave={savePlatforms} label="Save Platforms" />
        </div>
      )}

      {/* ─── TAB: OFFICIAL SOURCES ─────────────────────────────────────────────── */}
      {tab === 'official' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Official Sources</h3>
              <span className="text-[10px] text-[#6E6E6E]">Primary source pages used by Get Intel</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SourceLinkCard label="Web Page" url={getOfficialWebsite(artist)} />
              <SourceLinkCard label="Spotify Artist Page" url={links.spotify_url ?? artist.spotify_url} />
              <SourceLinkCard label="Apple Music Page" url={links.apple_music_url ?? artist.apple_music_url} />
              <SourceLinkCard label="YouTube Page" url={links.youtube_url ?? artist.youtube_url} />
              <SourceLinkCard label="Instagram Page" url={links.instagram_url ?? artist.instagram_url} />
              <SourceLinkCard label="TikTok Page" url={links.tiktok_url ?? artist.tiktok_url} />
              <SourceLinkCard label="Genius Page" url={links.genius_url ?? artist.genius_url} />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: TRACKING ────────────────────────────────────────────────────────── */}
      {tab === 'tracking' && editArtist && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Base Priority Score (0–100)">
              <input type="number" value={editArtist.base_score ?? 50} min={0} max={100}
                onChange={e=>setEditArtist({...editArtist, base_score:Number(e.target.value)})}
                className={inputCls}
              />
              <p className="text-[10px] text-[#6E6E6E] mt-1">Controls feed ranking boost and scout priority</p>
            </FormField>
            <FormField label="Priority Level">
              <select value={editArtist.priority_level ?? 'medium'} onChange={e=>setEditArtist({...editArtist, priority_level:e.target.value as Artist['priority_level']})}
                className={inputCls}
              >
                <option value="critical">Critical — top-tier, always boosted</option>
                <option value="high">High — major artist, strong boost</option>
                <option value="medium">Medium — tracked, standard priority</option>
                <option value="low">Low — passive monitoring only</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToggleField
              label="Active"
              description="Include in feed ranking and searches"
              checked={!!editArtist.is_active}
              onChange={v=>setEditArtist({...editArtist, is_active:v})}
            />
            <ToggleField
              label="Tracking Enabled"
              description="Auto-check for new releases via ATE"
              checked={!!editArtist.tracking_enabled}
              onChange={v=>setEditArtist({...editArtist, tracking_enabled:v})}
            />
            <ToggleField
              label="Is Tracking Active"
              description="Currently being polled by the tracker"
              checked={!!editArtist.is_tracking_active}
              onChange={v=>setEditArtist({...editArtist, is_tracking_active:v})}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <h4 className="text-xs font-semibold text-[#A8A8A8]">Pipeline Integration</h4>
            <div className="grid grid-cols-2 gap-3 text-xs text-[#A8A8A8]">
              <div>
                <p className="text-[#6E6E6E]">Last checked</p>
                <p className="text-[#D0D0D0]">{artist.last_checked ? timeAgo(artist.last_checked) : 'never'}</p>
              </div>
              <div>
                <p className="text-[#6E6E6E]">Last release</p>
                <p className="text-[#D0D0D0]">{artist.last_release_at ? timeAgo(artist.last_release_at) : 'unknown'}</p>
              </div>
              <div>
                <p className="text-[#6E6E6E]">Total tracked releases</p>
                <p className="text-[#D0D0D0]">{artist.total_releases}</p>
              </div>
            </div>
          </div>

          <SaveBar saving={saving} saved={saved} onSave={saveTracking} label="Save Tracking Settings" />
        </div>
      )}

      {/* ─── TAB: RELEASES ────────────────────────────────────────────────────────── */}
      {tab === 'releases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#A8A8A8]">{releases.length} tracked releases</p>
            <button
              onClick={() => setShowAddRelease(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Release
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase">Title</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-20">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-28">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase">Links</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-20">Flags</th>
                </tr>
              </thead>
              <tbody>
                {releases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#6E6E6E] text-sm">
                      No releases tracked yet.{' '}
                      <button onClick={() => setShowAddRelease(true)} className="text-venom-400 hover:underline">Add one</button>
                    </td>
                  </tr>
                )}
                {releases.map(rel => (
                  <tr key={rel.id} className="border-b border-white/10 hover:bg-white/[0.05]">
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-[#E8E8E8]">{rel.title}</p>
                      {rel.url && (
                        <a href={rel.url} target="_blank" rel="noopener" className="text-[10px] text-[#6E6E6E] hover:text-[#A8A8A8] flex items-center gap-0.5 mt-0.5">
                          <ExternalLink className="h-2.5 w-2.5" /> {rel.platform || 'link'}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 text-[8px] font-medium bg-white/[0.05] text-[#A8A8A8]">{rel.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#A8A8A8]">{rel.release_date}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {rel.spotify_url && (
                          <a href={rel.spotify_url} target="_blank" rel="noopener" className="text-[10px] text-green-500 hover:underline">Spotify</a>
                        )}
                        {rel.youtube_url && (
                          <a href={rel.youtube_url} target="_blank" rel="noopener" className="text-[10px] text-red-400 hover:underline">YouTube</a>
                        )}
                        {rel.apple_music_url && (
                          <a href={rel.apple_music_url} target="_blank" rel="noopener" className="text-[10px] text-pink-400 hover:underline">Apple</a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {rel.is_new_release && <span className="px-1 py-0.5 text-[7px] bg-green-500/15 text-[#00E085]">new</span>}
                        {rel.is_hot_trend   && <span className="px-1 py-0.5 text-[7px] bg-orange-500/15 text-orange-400">hot</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddRelease && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-6 w-full max-w-md">
                <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Add Release</h3>
                <form onSubmit={addRelease} className="space-y-3">
                  <input type="text" placeholder="Release title *" value={newRelease.title}
                    onChange={e=>setNewRelease({...newRelease, title:e.target.value})}
                    className={inputCls} required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={newRelease.type} onChange={e=>setNewRelease({...newRelease, type:e.target.value})}
                      className={inputCls}
                    >
                      {['track','single','album','ep','mixtape','video'].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" value={newRelease.release_date}
                      onChange={e=>setNewRelease({...newRelease, release_date:e.target.value})}
                      className={inputCls}
                    />
                  </div>
                  <input type="url" placeholder="URL (optional)" value={newRelease.url}
                    onChange={e=>setNewRelease({...newRelease, url:e.target.value})}
                    className={inputCls}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={()=>setShowAddRelease(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8]">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold">Add Release</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SHARED UI HELPERS ─────────────────────────────────────────────────────────

const inputCls = 'w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none placeholder:text-[#6E6E6E]'

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium text-[#A8A8A8] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function PlatformSection({ title, color, verified = false, children }: {
  title: string; color: string; verified?: boolean; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={cn('text-xs font-semibold', color)}>{title}</h4>
        {verified && <span className="flex items-center gap-1 text-[9px] text-[#00E085]"><CheckCircle className="h-3 w-3" /> verified</span>}
      </div>
      {children}
    </div>
  )
}

function SourceLinkCard({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A8A8A8]">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-all text-sm text-[#E8E8E8] hover:text-[#E8E8E8] hover:underline"
        >
          {url}
        </a>
      ) : (
        <p className="mt-1 text-sm text-[#6E6E6E]">No source found yet.</p>
      )}
    </div>
  )
}

function VerifiedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-1.5 text-[10px] font-medium transition-colors', checked ? 'text-[#00E085]' : 'text-[#6E6E6E] hover:text-[#A8A8A8]')}
    >
      {checked ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      Mark as verified
    </button>
  )
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors w-full',
        checked ? 'border-venom-500/30 bg-venom-500/5' : 'border-white/10 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#E8E8E8]">{label}</span>
        <div className={cn('w-8 h-4 rounded-full transition-colors', checked ? 'bg-venom-500' : 'bg-white/[0.08]')}>
          <div className={cn('w-3 h-3 rounded-full bg-white m-0.5 transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
        </div>
      </div>
      <p className="text-[10px] text-[#6E6E6E]">{description}</p>
    </button>
  )
}

function SaveBar({ saving, saved, onSave, label = 'Save Changes' }: {
  saving: boolean; saved: boolean; onSave: () => void; label?: string
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
      {saved && <span className="text-xs text-[#00E085]">Saved!</span>}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-venom-500 hover:bg-venom-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
      >
        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}
