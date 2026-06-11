import { searchSpotify } from '@/lib/services/spotify'
import { searchYouTube } from '@/lib/services/youtube'
import { searchGenius } from '@/lib/services/genius'
import { searchAppleMusic } from '@/lib/services/apple-music'
import { getUnsplashRandom, searchUnsplash } from '@/lib/services/image/unsplash'
import { getPexelsRandom, searchPexels } from '@/lib/services/image/pexels'
import { searchWikimedia } from '@/lib/services/image/wikimedia'
import { getWikidataArtistDetails, searchWikidataArtist } from '@/lib/services/wikidata'
import { OFFICIAL_SOURCE_URLS } from '@/lib/services/artist-intel-official-sources'
import { createAdminClient } from '@/lib/supabase/server'

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>

type ArtistRow = {
  id: string
  name: string
  country: string | null
  genre: string | null
  city: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  spotify_id: string | null
  spotify_url: string | null
  youtube_url: string | null
  apple_music_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  genius_url: string | null
  profile_image_url: string | null
}

type EnrichMode = 'full' | 'missing' | 'update'

export type ArtistIntelSourceKey =
  | 'spotify'
  | 'youtube'
  | 'apple_music'
  | 'genius'
  | 'wikipedia'
  | 'wikidata'
  | 'unsplash'
  | 'pexels'
  | 'wikimedia'

export type ArtistIntelAgentRules = {
  minHqImages: number
  minCorePlatforms: number
  maxGallerySearchAttempts: number
  autoRelevanceCheck: boolean
  relevanceStaleAfterDays: number
  maxRelevanceChecks: number
  relevanceWorkers: number
  releaseWorkers: number
}

export type ArtistIntelFocus = {
  pictures: boolean
  description: boolean
  official: boolean
  platforms: boolean
  gallery: boolean
  releases: boolean
}

export type OfficialSourceEntry = {
  country: string
  url: string
}

export type ArtistIntelAgentConfig = {
  sources: Record<ArtistIntelSourceKey, boolean>
  rules: ArtistIntelAgentRules
  focus: ArtistIntelFocus
  additionalOfficialSources?: string[]
  officialSourceEntries?: OfficialSourceEntry[]
}

export const DEFAULT_ARTIST_INTEL_AGENT_CONFIG: ArtistIntelAgentConfig = {
  sources: {
    spotify: true,
    youtube: true,
    apple_music: true,
    genius: true,
    wikipedia: true,
    wikidata: true,
    unsplash: true,
    pexels: true,
    wikimedia: true,
  },
  rules: {
    minHqImages: 5,
    minCorePlatforms: 3,
    maxGallerySearchAttempts: 12,
    autoRelevanceCheck: true,
    relevanceStaleAfterDays: 7,
    maxRelevanceChecks: 12,
    relevanceWorkers: 4,
    releaseWorkers: 3,
  },
  focus: {
    pictures: true,
    description: true,
    official: true,
    platforms: true,
    gallery: true,
    releases: true,
  },
  additionalOfficialSources: OFFICIAL_SOURCE_URLS,
  officialSourceEntries: [],
}

function resolveAgentConfig(config?: Partial<ArtistIntelAgentConfig> | null): ArtistIntelAgentConfig {
  const minHqImages = Number(config?.rules?.minHqImages)
  const minCorePlatforms = Number(config?.rules?.minCorePlatforms)
  const maxGallerySearchAttempts = Number(config?.rules?.maxGallerySearchAttempts)
  const relevanceStaleAfterDays = Number(config?.rules?.relevanceStaleAfterDays)
  const maxRelevanceChecks = Number(config?.rules?.maxRelevanceChecks)
  const relevanceWorkers = Number(config?.rules?.relevanceWorkers)
  const releaseWorkers = Number(config?.rules?.releaseWorkers)

  const normalizedEntries = (config?.officialSourceEntries ?? [])
    .map((entry) => ({
      country: (entry.country ?? '').trim(),
      url: (entry.url ?? '').trim(),
    }))
    .filter((entry) => entry.country.length > 0 && entry.url.length > 0)

  const additionalOfficialSources = Array.from(new Set([
    ...(
      config?.additionalOfficialSources
      ?? DEFAULT_ARTIST_INTEL_AGENT_CONFIG.additionalOfficialSources
      ?? []
    ).filter(Boolean),
    ...normalizedEntries.map((entry) => entry.url),
  ]))

  return {
    sources: {
      ...DEFAULT_ARTIST_INTEL_AGENT_CONFIG.sources,
      ...(config?.sources ?? {}),
    },
    rules: {
      minHqImages: Number.isFinite(minHqImages)
        ? Math.max(1, Math.min(20, Math.round(minHqImages)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.minHqImages,
      minCorePlatforms: Number.isFinite(minCorePlatforms)
        ? Math.max(1, Math.min(3, Math.round(minCorePlatforms)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.minCorePlatforms,
      maxGallerySearchAttempts: Number.isFinite(maxGallerySearchAttempts)
        ? Math.max(3, Math.min(30, Math.round(maxGallerySearchAttempts)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.maxGallerySearchAttempts,
      autoRelevanceCheck: config?.rules?.autoRelevanceCheck ?? DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.autoRelevanceCheck,
      relevanceStaleAfterDays: Number.isFinite(relevanceStaleAfterDays)
        ? Math.max(1, Math.min(60, Math.round(relevanceStaleAfterDays)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.relevanceStaleAfterDays,
      maxRelevanceChecks: Number.isFinite(maxRelevanceChecks)
        ? Math.max(1, Math.min(30, Math.round(maxRelevanceChecks)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.maxRelevanceChecks,
      relevanceWorkers: Number.isFinite(relevanceWorkers)
        ? Math.max(1, Math.min(10, Math.round(relevanceWorkers)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.relevanceWorkers,
      releaseWorkers: Number.isFinite(releaseWorkers)
        ? Math.max(1, Math.min(10, Math.round(releaseWorkers)))
        : DEFAULT_ARTIST_INTEL_AGENT_CONFIG.rules.releaseWorkers,
    },
    focus: {
      ...DEFAULT_ARTIST_INTEL_AGENT_CONFIG.focus,
      ...(config?.focus ?? {}),
    },
    additionalOfficialSources,
    officialSourceEntries: normalizedEntries,
  }
}

type ArtistIntelOptions = {
  refreshGallery?: boolean
  officialSourcesOnly?: boolean
  config?: Partial<ArtistIntelAgentConfig> | null
  onProgress?: (update: {
    artistName?: string
    currentStep: string
    processed?: number
    total?: number
    sourcesUsed?: string[]
    findings?: Array<{ label: string; value: string; source: string }>
    completedActions?: string[]
    updatedFields?: string[]
    confidence?: number | null
  }) => void
}

type GallerySource = 'wikimedia' | 'unsplash' | 'pexels' | 'youtube' | 'spotify'

type GalleryCandidate = {
  image_url: string
  width: number | null
  height: number | null
  source: GallerySource
}

type ArtistReleaseRow = {
  id: string
  title: string
  type: string | null
  release_date: string | null
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
}

export type ArtistIntelResult = {
  id: string
  name: string
  processed: boolean
  updated: boolean
  updated_fields: string[]
  sources: string[]
  confidence: number
  website_url: string | null
  profile_image_url: string | null
  gallery_image_urls: string[]
  official_pages: string[]
  release_links_count?: number
  release_titles?: string[]
  completeness_score?: number
  missing_fields?: string[]
  error?: string
}

function buildInstagramUrl(handle: string | null): string | null {
  if (!handle) return null
  return `https://www.instagram.com/${handle.replace(/^@/, '')}`
}

function buildTikTokUrl(handle: string | null): string | null {
  if (!handle) return null
  return `https://www.tiktok.com/@${handle.replace(/^@/, '')}`
}

function buildYouTubeChannelUrl(channelId: string | null): string | null {
  if (!channelId) return null
  return `https://www.youtube.com/channel/${channelId}`
}

function buildAppleMusicUrl(appleMusicId: string | null): string | null {
  if (!appleMusicId) return null
  return `https://music.apple.com/artist/${appleMusicId}`
}

function extractSpotifyId(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/spotify\.com\/artist\/([A-Za-z0-9]+)/)
  return match?.[1] ?? null
}

function toConfidence(sources: string[]): number {
  const capped = Math.min(3, sources.length)
  return Number((capped / 3).toFixed(2))
}

function toUniqueUrls(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function detectSourceFromUrl(value: string): string {
  if (value.includes('spotify.com')) return 'spotify'
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube'
  if (value.includes('music.apple.com')) return 'apple_music'
  if (value.includes('genius.com')) return 'genius'
  if (value.includes('instagram.com')) return 'instagram'
  if (value.includes('tiktok.com')) return 'tiktok'
  if (value.includes('wikidata.org')) return 'wikidata'
  if (value.includes('wikipedia.org')) return 'wikipedia'
  return 'official_web'
}

async function isUrlRelevant(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return true
  } catch {
    // Fallback below.
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { Range: 'bytes=0-512' },
    })
    return res.ok
  } catch {
    return false
  }
}

async function runWithWorkers<T, R>(
  items: T[],
  workers: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const size = Math.max(1, Math.min(workers, items.length))
  const results: R[] = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) break
      results[index] = await handler(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()))
  return results
}

const MIN_GALLERY_WIDTH = 1200
const MIN_GALLERY_HEIGHT = 800
const MAX_BULK_LIMIT = 200
const MAX_BULK_RUNTIME_MS = 1_800_000
const PER_ARTIST_TIMEOUT_MS = 60_000
const MAX_CONSECUTIVE_FAILURES = 50
const MAX_GALLERY_SEARCH_ATTEMPTS = 12

function scoreCandidate(candidate: GalleryCandidate): number {
  const area = (candidate.width ?? 0) * (candidate.height ?? 0)
  const sourceWeight: Record<GallerySource, number> = {
    unsplash: 100,
    pexels: 90,
    wikimedia: 80,
    spotify: 75,
    youtube: 65,
  }
  return area + sourceWeight[candidate.source]
}

const IMAGE_NOISE_KEYWORDS = [
  'poster', 'logo', 'cover', 'artwork', 'album', 'book', 'newspaper', 'magazine',
  'advertisement', 'ad', 'screenshot', 'scan', 'document', 'signature', 'autograph',
  'ticket', 'flyer', 'leaflet', 'vinyl', 'cd', 'cassette', 'news', 'press clipping',
]

function artistTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function hasNoiseKeywords(value: string | null | undefined): boolean {
  if (!value) return false
  const lower = value.toLowerCase()
  return IMAGE_NOISE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function looksArtistConnected(
  artistName: string,
  titleOrSnippet: string | null | undefined
): boolean {
  if (!titleOrSnippet) return false
  const haystack = titleOrSnippet.toLowerCase()
  const tokens = artistTokens(artistName)
  if (tokens.length === 0) return false
  return tokens.some((token) => haystack.includes(token))
}

function isHighQualityCandidate(candidate: GalleryCandidate): boolean {
  return (candidate.width ?? 0) >= MIN_GALLERY_WIDTH && (candidate.height ?? 0) >= MIN_GALLERY_HEIGHT
}

function dedupeCandidates(candidates: GalleryCandidate[]): GalleryCandidate[] {
  const seen = new Set<string>()
  const unique: GalleryCandidate[] = []
  for (const candidate of candidates) {
    if (!candidate.image_url || seen.has(candidate.image_url)) continue
    seen.add(candidate.image_url)
    unique.push(candidate)
  }
  return unique
}

async function collectGalleryCandidates(
  artist: ArtistRow,
  spotifyImage: string | null,
  youtubeThumb: string | null,
  config: ArtistIntelAgentConfig
): Promise<GalleryCandidate[]> {
  const targetImages = Math.max(1, config.rules.minHqImages)
  const [unsplash, pexels, wikimedia, youtubeLive, youtubeInterview, youtubeOfficial] = await Promise.all([
    config.sources.unsplash ? searchUnsplash(`${artist.name} ${artist.genre ?? 'music artist'} portrait`, 12) : Promise.resolve({ images: [] }),
    config.sources.pexels ? searchPexels(`${artist.name} ${artist.genre ?? 'music artist'} portrait`, 12) : Promise.resolve({ images: [] }),
    config.sources.wikimedia ? searchWikimedia(`${artist.name} musician portrait`, 12) : Promise.resolve({ images: [] }),
    config.sources.youtube ? searchYouTube(`${artist.name} live performance`) : Promise.resolve({ video_url: null, thumbnail_url: null, video_id: null }),
    config.sources.youtube ? searchYouTube(`${artist.name} interview`) : Promise.resolve({ video_url: null, thumbnail_url: null, video_id: null }),
    config.sources.youtube ? searchYouTube(`${artist.name} official video`) : Promise.resolve({ video_url: null, thumbnail_url: null, video_id: null }),
  ])

  let candidates: GalleryCandidate[] = [
    ...unsplash.images.map((img) => ({ image_url: img.image_url, width: img.width, height: img.height, source: 'unsplash' as const })),
    ...pexels.images.map((img) => ({ image_url: img.image_url, width: img.width, height: img.height, source: 'pexels' as const })),
    ...wikimedia.images
      .filter((img) => {
        const titleMeta = `${img.title ?? ''} ${img.snippet ?? ''}`
        if (!looksArtistConnected(artist.name, titleMeta)) return false
        if (hasNoiseKeywords(titleMeta) || hasNoiseKeywords(img.image_url)) return false
        return true
      })
      .map((img) => ({ image_url: img.image_url, width: img.width, height: img.height, source: 'wikimedia' as const })),
  ]

  if (config.sources.spotify && spotifyImage && !hasNoiseKeywords(spotifyImage)) {
    candidates.push({ image_url: spotifyImage, width: null, height: null, source: 'spotify' as const })
  }
  if (config.sources.youtube && youtubeThumb && !hasNoiseKeywords(youtubeThumb)) {
    candidates.push({ image_url: youtubeThumb, width: null, height: null, source: 'youtube' as const })
  }
  if (config.sources.youtube && youtubeLive.thumbnail_url) {
    candidates.push({ image_url: youtubeLive.thumbnail_url, width: null, height: null, source: 'youtube' as const })
  }
  if (config.sources.youtube && youtubeInterview.thumbnail_url) {
    candidates.push({ image_url: youtubeInterview.thumbnail_url, width: null, height: null, source: 'youtube' as const })
  }
  if (config.sources.youtube && youtubeOfficial.thumbnail_url) {
    candidates.push({ image_url: youtubeOfficial.thumbnail_url, width: null, height: null, source: 'youtube' as const })
  }

  const randomQueries = [
    `${artist.name} portrait`,
    `${artist.name} professional portrait`,
    `${artist.name} live concert`,
    `${artist.name} studio portrait`,
    `${artist.name} press photo`,
    `${artist.name} high resolution portrait`,
    `${artist.genre ?? 'music'} artist portrait`,
  ]

  let uniqueHighQuality = dedupeCandidates(candidates).filter(isHighQualityCandidate)
  let attempt = 0
  const maxAttempts = Math.max(3, config.rules.maxGallerySearchAttempts || MAX_GALLERY_SEARCH_ATTEMPTS)
  while (uniqueHighQuality.length < targetImages && attempt < maxAttempts) {
    const query = randomQueries[attempt % randomQueries.length]
    const [randomUnsplash, randomPexels] = await Promise.all([
      config.sources.unsplash ? getUnsplashRandom(query, 8) : Promise.resolve([]),
      config.sources.pexels ? getPexelsRandom(query, 8) : Promise.resolve([]),
    ])

    candidates = [
      ...candidates,
      ...randomUnsplash.map((img) => ({ image_url: img.image_url, width: img.width, height: img.height, source: 'unsplash' as const })),
      ...randomPexels.map((img) => ({ image_url: img.image_url, width: img.width, height: img.height, source: 'pexels' as const })),
    ]

    uniqueHighQuality = dedupeCandidates(candidates).filter(isHighQualityCandidate)
    attempt += 1
  }

  // spotify/youtube can still be used as profile image fallback, but not as HQ gallery assets
  if (uniqueHighQuality.length >= targetImages) {
    return uniqueHighQuality
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
      .slice(0, targetImages)
  }

  // fallback for low-volume artists: keep strong HQ first, then artist-connected platform images
  const dedupedAll = dedupeCandidates(candidates)
  const hqUrls = new Set(uniqueHighQuality.map((candidate) => candidate.image_url))
  const connectedFallback = dedupedAll.filter((candidate) =>
    !hqUrls.has(candidate.image_url) && (candidate.source === 'spotify' || candidate.source === 'youtube')
  )

  return [...uniqueHighQuality, ...connectedFallback]
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, targetImages)
}

async function ensureGalleryImages(
  db: AdminDb,
  artist: ArtistRow,
  spotifyImage: string | null,
  youtubeThumb: string | null,
  options: ArtistIntelOptions = {}
): Promise<string[]> {
  const config = resolveAgentConfig(options.config)
  const { data: existing } = await db
    .from('artist_images')
    .select('id,image_url,width,height,uploaded_at')
    .eq('artist_id', artist.id)
    .eq('type', 'gallery')
    .order('uploaded_at', { ascending: false })
    .limit(20)

  const existingRows = existing ?? []
  const refreshGallery = options.refreshGallery === true

  if (refreshGallery && existingRows.length > 0) {
    await db
      .from('artist_images')
      .delete()
      .eq('artist_id', artist.id)
      .eq('type', 'gallery')
  }

  const baselineRows = refreshGallery ? [] : existingRows
  const existingUrls = new Set(baselineRows.map((row) => row.image_url as string))
  const existingHighQualityCount = existingRows.filter((row) =>
    (row.width ?? 0) >= MIN_GALLERY_WIDTH && (row.height ?? 0) >= MIN_GALLERY_HEIGHT
  ).length
  const existingHqUrls = baselineRows
    .filter((row) => (row.width ?? 0) >= MIN_GALLERY_WIDTH && (row.height ?? 0) >= MIN_GALLERY_HEIGHT)
    .map((row) => row.image_url as string)

  const needed = refreshGallery
    ? config.rules.minHqImages
    : Math.max(0, config.rules.minHqImages - existingHighQualityCount)
  if (needed === 0) return existingHqUrls.slice(0, config.rules.minHqImages)

  const candidates = await collectGalleryCandidates(artist, spotifyImage, youtubeThumb, config)
  const selected = candidates
    .filter((candidate) => !existingUrls.has(candidate.image_url))
    .slice(0, needed)

  if (selected.length === 0) return existingHqUrls.slice(0, config.rules.minHqImages)

  await db.from('artist_images').insert(
    selected.map((candidate) => ({
      artist_id: artist.id,
      image_url: candidate.image_url,
      type: 'gallery',
      width: candidate.width,
      height: candidate.height,
    }))
  )

  return [...existingHqUrls, ...selected.map((candidate) => candidate.image_url)].slice(0, config.rules.minHqImages)
}

function computeCompleteness(input: {
  description: string | null | undefined
  profileImage: string | null | undefined
  spotifyUrl: string | null | undefined
  appleMusicUrl: string | null | undefined
  youtubeUrl: string | null | undefined
  instagramUrl: string | null | undefined
  tiktokUrl: string | null | undefined
  geniusUrl: string | null | undefined
  galleryCount: number
  requiredHqImages: number
  requiredCorePlatforms: number
}): {
  score: number
  missing: string[]
  corePlatformsConnected: number
  minimumStandardComplete: boolean
} {
  const required = [
    ['description', input.description],
    ['profile_image', input.profileImage],
    ['spotify', input.spotifyUrl],
    ['apple_music', input.appleMusicUrl],
    ['youtube', input.youtubeUrl],
    ['instagram', input.instagramUrl],
    ['tiktok', input.tiktokUrl],
    ['genius', input.geniusUrl],
    ['gallery_hq_min', input.galleryCount >= input.requiredHqImages ? 'ok' : null],
  ] as const

  const missing = required
    .filter(([, value]) => !value)
    .map(([name]) => name)

  const score = Number((((required.length - missing.length) / required.length) * 100).toFixed(1))
  const corePlatformsConnected = [input.spotifyUrl, input.appleMusicUrl, input.youtubeUrl]
    .filter((value) => Boolean(value)).length
  const minimumStandardComplete = input.galleryCount >= input.requiredHqImages && corePlatformsConnected >= input.requiredCorePlatforms
  return { score, missing, corePlatformsConnected, minimumStandardComplete }
}

type WikiSummary = {
  title: string
  description: string | null
  extract: string | null
  content_url: string | null
}

function cleanText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\s+/g, ' ')
    .replace(/\(listen\)|\[\d+\]/gi, '')
    .trim()
}

function pickSentences(text: string, count: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.slice(0, count).join(' ')
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

async function fetchWikiSummary(name: string): Promise<WikiSummary | null> {
  const candidates = [
    name,
    `${name} (rapper)`,
    `${name} (musician)`,
    `${name} (singer)`,
  ]

  for (const candidate of candidates) {
    const encoded = encodeURIComponent(candidate)
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue

      const data = await res.json() as {
        title?: string
        type?: string
        description?: string
        extract?: string
        content_urls?: { desktop?: { page?: string } }
      }

      if (data.type === 'disambiguation') continue
      if (!data.title || !data.extract) continue

      return {
        title: data.title,
        description: cleanText(data.description),
        extract: cleanText(data.extract),
        content_url: data.content_urls?.desktop?.page ?? null,
      }
    } catch {
      // try next candidate
    }
  }

  return null
}

function formatArtistDescription(input: {
  name: string
  country: string | null
  genre: string | null
  wiki: WikiSummary | null
}): string {
  const extract = input.wiki?.extract ?? ''
  const compact = cleanText(extract)
  const sentences = splitSentences(compact)

  // Internal skeleton kept for structure, but labels are not rendered in UI text.
  const sections = {
    identity: input.wiki?.description
      ? `${input.name} je ${input.wiki.description}.`
      : `${input.name} je ${input.genre ?? 'hudebni'} interpret se zamerenim na soucasnou tvorbu a vystupovani.`,
    origin: input.country
      ? `${input.country} je jeho/jeji hlavni geograficky kontext. ${sentences[0] ?? ''}`.trim()
      : `${sentences[0] ?? `${input.name} pusobi na domaci i online scene a rozviji svuj styl napric platformami.`}`,
    work: sentences.length > 1
      ? [sentences[1], sentences[2]].filter(Boolean).join(' ')
      : `${input.name} dlouhodobe rozviji vlastni hudebni identitu, pracuje s release strategii a aktivne buduje dosah na streamovacich platformach.`,
    interesting: sentences.length > 3
      ? [sentences[3], sentences[4]].filter(Boolean).join(' ')
      : `Z dostupnych dat je patrny rust viditelnosti, konzistentni aktivita a potencial pro dalsi karierni posun v ramci rap/urban trhu.`,
    childhood: sentences.length > 5
      ? `Verejne dostupne zdroje naznacuji tento vyvoj: ${sentences[5]}`
      : `Overene detailni informace o ranem obdobi nejsou bezne verejne dostupne; profil je postaven hlavne na dolozitelnem hudebnim vystupu.`,
    breakthrough: sentences.length > 0
      ? `Vyraznejsi pozornost ziskal/a diky release aktivite a momentu: ${sentences[0]}`
      : `Vyraznejsi pozornost ziskal/a postupnou konsolidaci publika, pravidelnymi releasy a navazanim na klicove platformy.`,
    career: sentences.length > 2
      ? `Klicove body kariery zahrnuji: ${pickSentences(compact, Math.min(5, sentences.length))}`
      : `Klicove body kariery zahrnuji stabilni release tempo, rust engagementu, praci s vizualni identitou a postupne sireni dosahu v ramci trhu.`,
    source: input.wiki?.content_url
      ? `Biograficke podklady byly konsolidovany z verejnych zdroju, zejmena ${input.wiki.content_url}.`
      : `Biograficke podklady byly konsolidovany z internich intel dat bez jednoho dominantniho verejneho biografickeho zdroje.`,
  }

  return [
    sections.identity,
    sections.origin,
    sections.work,
    sections.interesting,
    sections.childhood,
    sections.breakthrough,
    sections.career,
    sections.source,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
}

async function upsertArtistLinks(db: AdminDb, artistId: string, patch: Record<string, string | boolean | null>) {
  const row = {
    artist_id: artistId,
    ...patch,
    last_enriched_at: new Date().toISOString(),
  }

  await db
    .from('artist_links')
    .upsert(row, { onConflict: 'artist_id' })
}

async function updateArtistMetadata(db: AdminDb, artist: ArtistRow, patch: Record<string, unknown>) {
  const metadata = {
    ...(artist.metadata ?? {}),
    artist_intel: {
      ...(((artist.metadata ?? {}) as { artist_intel?: Record<string, unknown> }).artist_intel ?? {}),
      ...patch,
      updated_at: new Date().toISOString(),
    },
  }

  await db.from('artists').update({ metadata }).eq('id', artist.id)
}

async function ensureProfileImage(db: AdminDb, artistId: string, imageUrl: string | null) {
  if (!imageUrl) return

  const { data: existing } = await db
    .from('artist_images')
    .select('id')
    .eq('artist_id', artistId)
    .eq('type', 'profile')
    .limit(1)

  if (existing && existing.length > 0) return

  await db.from('artist_images').insert({
    artist_id: artistId,
    image_url: imageUrl,
    type: 'profile',
  })
}

async function ensureReleaseLinks(
  db: AdminDb,
  artist: ArtistRow,
  options?: { workers?: number }
): Promise<{ updatedCount: number; titles: string[] }> {
  const { data: releases } = await db
    .from('artist_releases')
    .select('id,title,type,release_date,spotify_url,apple_music_url,youtube_url')
    .eq('artist_id', artist.id)
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(12)

  const releaseRows = (releases ?? []) as ArtistReleaseRow[]
  const candidates = releaseRows.filter((release) => !(release.spotify_url && release.apple_music_url && release.youtube_url))

  const releaseResults = await runWithWorkers(candidates, options?.workers ?? 3, async (release) => {
    const [spotify, appleMusic, youtube] = await Promise.all([
      release.spotify_url ? Promise.resolve({ track_url: null }) : searchSpotify(artist.name, release.title),
      release.apple_music_url ? Promise.resolve({ song_url: null, artist_url: null }) : searchAppleMusic(artist.name, release.title),
      release.youtube_url ? Promise.resolve({ video_url: null }) : searchYouTube(`${artist.name} ${release.title}`),
    ])

    const patch: Record<string, string | null> = {}
    if (!release.spotify_url && spotify.track_url) patch.spotify_url = spotify.track_url
    if (!release.apple_music_url && appleMusic.song_url) patch.apple_music_url = appleMusic.song_url
    if (!release.youtube_url && youtube.video_url) patch.youtube_url = youtube.video_url

    if (Object.keys(patch).length === 0) return null

    await db.from('artist_releases').update(patch).eq('id', release.id)
    return release.title
  })

  const updatedTitles = releaseResults.filter((title): title is string => Boolean(title))
  return { updatedCount: updatedTitles.length, titles: updatedTitles }
}

export async function runArtistIntelForArtist(
  db: AdminDb,
  artistId: string,
  mode: EnrichMode = 'full',
  options: ArtistIntelOptions = {}
): Promise<ArtistIntelResult> {
  const config = resolveAgentConfig(options.config)
  const officialSourcesOnly = options.officialSourcesOnly === true
  const effectiveFocus = officialSourcesOnly
    ? {
        pictures: false,
        description: false,
        gallery: false,
        releases: false,
        official: true,
        platforms: true,
      }
    : config.focus
  const { data: artist, error } = await db
    .from('artists')
    .select('id,name,country,genre,city,description,metadata,spotify_id,spotify_url,youtube_url,apple_music_url,instagram_url,tiktok_url,genius_url,profile_image_url')
    .eq('id', artistId)
    .single()

  if (error || !artist) {
    return {
      id: artistId,
      name: 'unknown',
      processed: false,
      updated: false,
      updated_fields: [],
      sources: [],
      confidence: 0,
      website_url: null,
      profile_image_url: null,
      gallery_image_urls: [],
      official_pages: [],
      error: 'Artist not found',
    }
  }

  const row = artist as ArtistRow
  const artistIntelMeta = ((row.metadata ?? {}) as { artist_intel?: Record<string, unknown> }).artist_intel ?? {}
  const lastRelevanceCheckAtRaw = artistIntelMeta.relevance_checked_at
  const lastRelevanceCheckAt = typeof lastRelevanceCheckAtRaw === 'string' ? new Date(lastRelevanceCheckAtRaw).getTime() : null
  const relevanceStaleAfterMs = config.rules.relevanceStaleAfterDays * 86_400_000
  const shouldRefreshRelevance =
    mode === 'update'
    || (config.rules.autoRelevanceCheck && (!lastRelevanceCheckAt || (Date.now() - lastRelevanceCheckAt) > relevanceStaleAfterMs))

  options.onProgress?.({ artistName: row.name, currentStep: `Collecting sources for ${row.name}` })
  const wikidataId = await searchWikidataArtist(row.name)
  const [spotify, youtube, genius, appleMusic, wiki, wikidata] = await Promise.all([
    config.sources.spotify ? searchSpotify(row.name) : Promise.resolve({ track_url: null, artist_url: null, image_url: null, artist_name: null }),
    config.sources.youtube ? searchYouTube(`${row.name} official music`) : Promise.resolve({ video_url: null, thumbnail_url: null, video_id: null }),
    config.sources.genius ? searchGenius(row.name) : Promise.resolve({ song_url: null, title: null }),
    config.sources.apple_music ? searchAppleMusic(row.name) : Promise.resolve({ song_url: null, artist_url: null, artist_id: null, artwork_url: null, track_name: null, artist_name: null }),
    config.sources.wikipedia ? fetchWikiSummary(row.name) : Promise.resolve(null),
    config.sources.wikidata && wikidataId ? getWikidataArtistDetails(wikidataId) : Promise.resolve(null),
  ])

  const sources: string[] = []
  const artistPatch: Record<string, string | number> = {}
  const linksPatch: Record<string, string | boolean | null> = {}
  const updatedFields: string[] = []
  let officialWebsite: string | null =
    ((row.metadata ?? {}) as { artist_intel?: { official_website?: string | null } }).artist_intel?.official_website ?? null
  const wikiUrl = wiki?.content_url ?? null
  const wikidataUrl = wikidata?.qid ? `https://www.wikidata.org/wiki/${wikidata.qid}` : null

  options.onProgress?.({
    artistName: row.name,
    currentStep: `Collected ${[
      spotify.artist_url ? 'spotify' : null,
      youtube.video_url ? 'youtube' : null,
      appleMusic.artist_url ? 'apple_music' : null,
      genius.song_url ? 'genius' : null,
      wiki ? 'wikipedia' : null,
      wikidata ? 'wikidata' : null,
    ].filter(Boolean).length} sources for ${row.name}`,
    sourcesUsed: [
      ...(spotify.artist_url ? ['spotify'] : []),
      ...(youtube.video_url ? ['youtube'] : []),
      ...(appleMusic.artist_url ? ['apple_music'] : []),
      ...(genius.song_url ? ['genius'] : []),
      ...(wiki ? ['wikipedia'] : []),
      ...(wikidata ? ['wikidata'] : []),
    ],
    findings: toUniqueUrls([
      spotify.artist_url,
      youtube.video_url,
      appleMusic.artist_url,
      genius.song_url,
      wikiUrl,
      wikidataUrl,
    ]).map((value) => ({
      label: 'Found official source',
      value,
      source: detectSourceFromUrl(value),
    })),
  })

  if (spotify.artist_url) {
    sources.push('spotify')
    if (effectiveFocus.platforms) {
      linksPatch.spotify_url = spotify.artist_url
      const extractedId = extractSpotifyId(spotify.artist_url)
      if (extractedId) linksPatch.spotify_id = extractedId
      linksPatch.spotify_verified = true

      if (!row.spotify_url || mode === 'full') {
        artistPatch.spotify_url = spotify.artist_url
        updatedFields.push('spotify_url')
      }
      if (extractedId && (!row.spotify_id || mode === 'full')) {
        artistPatch.spotify_id = extractedId
        updatedFields.push('spotify_id')
      }
    }
  }

  if (youtube.video_url) {
    sources.push('youtube')
    if (effectiveFocus.platforms) {
      linksPatch.youtube_url = youtube.video_url
      if (!row.youtube_url || mode === 'full') {
        artistPatch.youtube_url = youtube.video_url
        updatedFields.push('youtube_url')
      }
    }
  }

  if (appleMusic.artist_url) {
    sources.push('apple_music')
    if (effectiveFocus.platforms) {
      linksPatch.apple_music_url = appleMusic.artist_url
      if (appleMusic.artist_id) linksPatch.apple_music_id = appleMusic.artist_id
      linksPatch.apple_verified = true
      if (!row.apple_music_url || mode === 'full') {
        artistPatch.apple_music_url = appleMusic.artist_url
        updatedFields.push('apple_music_url')
      }
    }
  }

  if (genius.song_url) {
    sources.push('genius')
    if (effectiveFocus.platforms) {
      linksPatch.genius_url = genius.song_url
      if (!row.genius_url || mode === 'full') {
        artistPatch.genius_url = genius.song_url
        updatedFields.push('genius_url')
      }
    }
  }

  if (wikidata) {
    sources.push('wikidata')
    if (effectiveFocus.official) {
      officialWebsite = wikidata.official_website ?? officialWebsite
    }

    const wikidataYouTubeUrl = buildYouTubeChannelUrl(wikidata.youtube_channel_id)
    const wikidataInstagramUrl = buildInstagramUrl(wikidata.instagram_handle)
    const wikidataTikTokUrl = buildTikTokUrl(wikidata.tiktok_handle)
    const wikidataAppleMusicUrl = buildAppleMusicUrl(wikidata.apple_music_id)

    if (effectiveFocus.platforms && wikidata.spotify_id && (!artistPatch.spotify_id || !row.spotify_id)) {
      linksPatch.spotify_id = wikidata.spotify_id
      linksPatch.spotify_verified = true
      if ((!row.spotify_id || mode === 'full') && !artistPatch.spotify_id) {
        artistPatch.spotify_id = wikidata.spotify_id
        updatedFields.push('spotify_id')
      }
    }

    if (effectiveFocus.platforms && wikidataYouTubeUrl) {
      linksPatch.youtube_url = wikidataYouTubeUrl
      if (wikidata.youtube_channel_id) linksPatch.youtube_channel_id = wikidata.youtube_channel_id
      linksPatch.youtube_verified = true
      if ((!row.youtube_url || mode === 'full') && !artistPatch.youtube_url) {
        artistPatch.youtube_url = wikidataYouTubeUrl
        updatedFields.push('youtube_url')
      }
    }

    if (effectiveFocus.platforms && wikidataInstagramUrl) {
      linksPatch.instagram_url = wikidataInstagramUrl
      if (wikidata.instagram_handle) linksPatch.instagram_handle = wikidata.instagram_handle.replace(/^@/, '')
      linksPatch.instagram_verified = true
      if (!row.instagram_url || mode === 'full') {
        artistPatch.instagram_url = wikidataInstagramUrl
        updatedFields.push('instagram_url')
      }
    }

    if (effectiveFocus.platforms && wikidataTikTokUrl) {
      linksPatch.tiktok_url = wikidataTikTokUrl
      if (wikidata.tiktok_handle) linksPatch.tiktok_handle = wikidata.tiktok_handle.replace(/^@/, '')
      linksPatch.tiktok_verified = true
      if (!row.tiktok_url || mode === 'full') {
        artistPatch.tiktok_url = wikidataTikTokUrl
        updatedFields.push('tiktok_url')
      }
    }

    if (effectiveFocus.platforms && wikidataAppleMusicUrl && !artistPatch.apple_music_url) {
      linksPatch.apple_music_url = wikidataAppleMusicUrl
      if (wikidata.apple_music_id) linksPatch.apple_music_id = wikidata.apple_music_id
      linksPatch.apple_verified = true
      if (!row.apple_music_url || mode === 'full') {
        artistPatch.apple_music_url = wikidataAppleMusicUrl
        updatedFields.push('apple_music_url')
      }
    }
  }

  const officialPages = toUniqueUrls([
    officialWebsite,
    spotify.artist_url,
    youtube.video_url,
    appleMusic.artist_url,
    genius.song_url,
    wikiUrl,
    wikidataUrl,
    row.spotify_url,
    row.youtube_url,
    row.apple_music_url,
    row.instagram_url,
    row.tiktok_url,
    row.genius_url,
    ...(config.additionalOfficialSources ?? []),
  ])

  const officialSourcesMap = {
    website: officialWebsite,
    spotify: (artistPatch.spotify_url as string | undefined) ?? row.spotify_url ?? spotify.artist_url ?? null,
    youtube: (artistPatch.youtube_url as string | undefined) ?? row.youtube_url ?? youtube.video_url ?? null,
    apple_music: (artistPatch.apple_music_url as string | undefined) ?? row.apple_music_url ?? appleMusic.artist_url ?? null,
    genius: (artistPatch.genius_url as string | undefined) ?? row.genius_url ?? genius.song_url ?? null,
    instagram: (artistPatch.instagram_url as string | undefined) ?? row.instagram_url ?? null,
    tiktok: (artistPatch.tiktok_url as string | undefined) ?? row.tiktok_url ?? null,
    wikipedia: wikiUrl,
    wikidata: wikidataUrl,
  }

  let relevanceInvalidUrls: string[] = []
  let relevanceCheckedUrls = 0
  if (shouldRefreshRelevance && effectiveFocus.official) {
    options.onProgress?.({ artistName: row.name, currentStep: `Checking source relevance for ${row.name}` })
    const relevanceTargets = officialPages.slice(0, config.rules.maxRelevanceChecks)
    const checks = await runWithWorkers(relevanceTargets, config.rules.relevanceWorkers, async (url) => ({
      url,
      ok: await isUrlRelevant(url),
    }))
    relevanceInvalidUrls = checks.filter((item) => !item.ok).map((item) => item.url)
    relevanceCheckedUrls = checks.length
  }

  options.onProgress?.({
    artistName: row.name,
    currentStep: `Resolving official sources first for ${row.name}`,
    sourcesUsed: sources,
    findings: officialPages.map((value) => ({
      label: 'Resolved official page',
      value,
      source: detectSourceFromUrl(value),
    })),
    updatedFields,
    confidence: artistPatch.ai_confidence as number,
  })

  const profileImage = wikidata?.image_url ?? spotify.image_url ?? appleMusic.artwork_url ?? youtube.thumbnail_url ?? null
  if (effectiveFocus.pictures && profileImage && (!row.profile_image_url || mode === 'full')) {
    artistPatch.profile_image_url = profileImage
    updatedFields.push('profile_image_url')
  }

  if (effectiveFocus.description && (!row.description || mode === 'full')) {
    options.onProgress?.({ artistName: row.name, currentStep: `Building artist description for ${row.name}` })
    const description = formatArtistDescription({
      name: row.name,
      country: row.country,
      genre: row.genre,
      wiki: wiki ?? (wikidata
        ? {
            title: wikidata.label ?? row.name,
            description: wikidata.description,
            extract: wikidata.description,
            content_url: `https://www.wikidata.org/wiki/${wikidata.qid}`,
          }
        : null),
    })
    artistPatch.description = description
    updatedFields.push('description')
  }

  artistPatch.ai_fetched_at = new Date().toISOString()
  artistPatch.ai_confidence = toConfidence(sources)

  options.onProgress?.({
    artistName: row.name,
    currentStep: `Prepared ${updatedFields.length} profile fields for ${row.name}`,
    sourcesUsed: sources,
    updatedFields,
    confidence: artistPatch.ai_confidence as number,
  })

  if (Object.keys(artistPatch).length > 0) {
    options.onProgress?.({ artistName: row.name, currentStep: `Saving profile data for ${row.name}` })
    await db.from('artists').update(artistPatch).eq('id', row.id)
  }

  if (Object.keys(linksPatch).length > 0) {
    options.onProgress?.({ artistName: row.name, currentStep: `Updating platform links for ${row.name}` })
    await upsertArtistLinks(db, row.id, linksPatch)
  }

  const metadataPatch: Record<string, unknown> = {}
  metadataPatch.sources = sources
  metadataPatch.official_website = officialWebsite
  metadataPatch.official_pages = officialPages
  metadataPatch.official_sources = officialSourcesMap
  metadataPatch.official_sources_count = officialPages.length
  metadataPatch.relevance_checked_at = new Date().toISOString()
  metadataPatch.relevance_checked_urls = relevanceCheckedUrls
  metadataPatch.relevance_invalid_urls = relevanceInvalidUrls
  metadataPatch.relevance_ok = relevanceInvalidUrls.length === 0

  if (wikidata) {
    options.onProgress?.({ artistName: row.name, currentStep: `Saving metadata evidence for ${row.name}` })
    metadataPatch.wikidata_qid = wikidata.qid
    metadataPatch.wikidata_label = wikidata.label
    metadataPatch.wikidata_description = wikidata.description
  }

  await updateArtistMetadata(db, row, metadataPatch)

  if (officialSourcesOnly) {
    options.onProgress?.({
      artistName: row.name,
      currentStep: `Official sources resolved for ${row.name}`,
      sourcesUsed: sources,
      completedActions: ['Resolved official sources', 'Updated platform links', 'Saved official source map'],
      updatedFields,
      confidence: artistPatch.ai_confidence as number,
    })

    return {
      id: row.id,
      name: row.name,
      processed: true,
      updated: updatedFields.length > 0,
      updated_fields: updatedFields,
      sources,
      confidence: artistPatch.ai_confidence as number,
      website_url: officialWebsite,
      profile_image_url: row.profile_image_url,
      gallery_image_urls: [],
      official_pages: officialPages,
      release_links_count: 0,
      release_titles: [],
    }
  }

  let galleryImageUrls: string[] = []
  if (effectiveFocus.gallery || effectiveFocus.pictures) {
    options.onProgress?.({ artistName: row.name, currentStep: `Refreshing image assets for ${row.name}` })
    if (effectiveFocus.pictures) {
      await ensureProfileImage(db, row.id, profileImage)
    }
    if (effectiveFocus.gallery) {
      galleryImageUrls = await ensureGalleryImages(db, row, spotify.image_url, youtube.thumbnail_url, { ...options, config })
      if (galleryImageUrls.length > 0) {
        updatedFields.push('gallery_images')
      }
    }

    if (effectiveFocus.pictures && !profileImage && galleryImageUrls.length > 0 && (!row.profile_image_url || mode === 'full')) {
      await db.from('artists').update({ profile_image_url: galleryImageUrls[0] }).eq('id', row.id)
      updatedFields.push('profile_image_url')
    }
  }

  let releaseLinks: { updatedCount: number; titles: string[] } = { updatedCount: 0, titles: [] }
  if (effectiveFocus.releases) {
    options.onProgress?.({ artistName: row.name, currentStep: `Refreshing release links for ${row.name}` })
    releaseLinks = await ensureReleaseLinks(db, row, { workers: config.rules.releaseWorkers })
    if (releaseLinks.updatedCount > 0) {
      updatedFields.push('release_links')
    }
  }

  const completeness = computeCompleteness({
    description: (artistPatch.description as string | undefined) ?? row.description,
    profileImage: (artistPatch.profile_image_url as string | undefined) ?? row.profile_image_url ?? galleryImageUrls[0] ?? null,
    spotifyUrl: (artistPatch.spotify_url as string | undefined) ?? row.spotify_url ?? null,
    appleMusicUrl: (artistPatch.apple_music_url as string | undefined) ?? row.apple_music_url ?? null,
    youtubeUrl: (artistPatch.youtube_url as string | undefined) ?? row.youtube_url ?? null,
    instagramUrl: (artistPatch.instagram_url as string | undefined) ?? row.instagram_url ?? null,
    tiktokUrl: (artistPatch.tiktok_url as string | undefined) ?? row.tiktok_url ?? null,
    geniusUrl: (artistPatch.genius_url as string | undefined) ?? row.genius_url ?? null,
    galleryCount: galleryImageUrls.length,
    requiredHqImages: config.rules.minHqImages,
    requiredCorePlatforms: config.rules.minCorePlatforms,
  })

  metadataPatch.profile_completeness_score = completeness.score
  metadataPatch.missing_profile_fields = completeness.missing
  metadataPatch.core_platforms_connected = completeness.corePlatformsConnected
  metadataPatch.required_core_platforms = config.rules.minCorePlatforms
  metadataPatch.hq_gallery_images = galleryImageUrls.length
  metadataPatch.required_hq_gallery_images = config.rules.minHqImages
  metadataPatch.minimum_standard_complete = completeness.minimumStandardComplete
  metadataPatch.minimum_standard_reason = completeness.minimumStandardComplete
    ? 'Profile meets minimum standard.'
    : `Profile requires at least ${config.rules.minHqImages} HQ gallery photos and ${config.rules.minCorePlatforms} core platforms (Spotify, Apple Music, YouTube).`

  await updateArtistMetadata(db, row, metadataPatch)

  options.onProgress?.({
    artistName: row.name,
    currentStep: `Completed Get Intel for ${row.name}`,
    sourcesUsed: sources,
    completedActions: [
      'Collected source data',
      'Updated profile fields',
      'Updated platform links',
      'Saved metadata evidence',
      'Refreshed image assets',
      'Refreshed release links',
    ],
    updatedFields,
    confidence: artistPatch.ai_confidence as number,
  })

  return {
    id: row.id,
    name: row.name,
    processed: true,
    updated: updatedFields.length > 0,
    updated_fields: updatedFields,
    sources,
    confidence: artistPatch.ai_confidence as number,
    website_url: officialWebsite,
    profile_image_url: profileImage,
    gallery_image_urls: galleryImageUrls,
    official_pages: officialPages,
    completeness_score: completeness.score,
    missing_fields: completeness.missing,
    release_links_count: releaseLinks.updatedCount,
    release_titles: releaseLinks.titles,
  }
}

export async function runArtistIntelBulk(
  db: AdminDb,
  options: {
    limit?: number
    mode?: EnrichMode
    config?: Partial<ArtistIntelAgentConfig> | null
    shouldStop?: () => boolean
    onProgress?: (update: {
      artistName?: string
      currentStep: string
      processed?: number
      total?: number
      sourcesUsed?: string[]
      findings?: Array<{ label: string; value: string; source: string }>
      completedActions?: string[]
      updatedFields?: string[]
      confidence?: number | null
    }) => void
  } = {}
): Promise<{
  total: number
  processed: number
  updated: number
  skipped: number
  results: ArtistIntelResult[]
  stopped_early: boolean
  stop_reason: string | null
  duration_ms: number
}> {
  const startedAt = Date.now()
  const limit = Math.min(options.limit ?? 100, MAX_BULK_LIMIT)
  const mode = options.mode ?? 'full'
  const shouldStop = options.shouldStop
  const config = resolveAgentConfig(options.config)

  let query = db
    .from('artists')
    .select('id,name')
    .eq('is_active', true)
    .order('base_score', { ascending: false })
    .limit(limit)

  if (mode === 'missing') {
    query = query.or('spotify_url.is.null,youtube_url.is.null,genius_url.is.null,profile_image_url.is.null')
  } else if (mode === 'update') {
    query = query.not('id', 'is', null)
  }

  const { data, error } = await query
  if (error || !data) {
    return {
      total: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      results: [],
      stopped_early: false,
      stop_reason: null,
      duration_ms: Date.now() - startedAt,
    }
  }

  const results: ArtistIntelResult[] = []
  let stoppedEarly = false
  let stopReason: string | null = null
  let consecutiveFailures = 0
  const artists = data as Array<{ id: string; name: string }>

  options.onProgress?.({
    currentStep: 'Phase 1/2: Resolving official sources for all artists first',
    processed: 0,
    total: artists.length,
  })

  for (const item of artists) {
    if (shouldStop?.()) {
      stoppedEarly = true
      stopReason = 'Stopped by user'
      break
    }

    if (Date.now() - startedAt >= MAX_BULK_RUNTIME_MS) {
      stoppedEarly = true
      stopReason = `Bulk timeout reached (${MAX_BULK_RUNTIME_MS}ms)`
      break
    }

    const timeoutResult: ArtistIntelResult = {
      id: item.id,
      name: item.name,
      processed: false,
      updated: false,
      updated_fields: [],
      sources: [],
      confidence: 0,
      website_url: null,
      profile_image_url: null,
      gallery_image_urls: [],
      official_pages: [],
      error: `Artist timeout (${PER_ARTIST_TIMEOUT_MS}ms)`,
    }

    await Promise.race<ArtistIntelResult>([
      runArtistIntelForArtist(db, item.id, 'missing', {
        config,
        officialSourcesOnly: true,
        onProgress: ({ artistName, currentStep, sourcesUsed, completedActions, updatedFields, confidence }) => {
          options.onProgress?.({
            artistName,
            currentStep,
            processed: Math.max(0, results.length),
            total: artists.length,
            sourcesUsed,
            completedActions,
            updatedFields,
            confidence,
          })
        },
      }),
      new Promise<ArtistIntelResult>((resolve) => {
        setTimeout(() => resolve(timeoutResult), PER_ARTIST_TIMEOUT_MS)
      }),
    ])
  }

  if (stoppedEarly) {
    return {
      total: artists.length,
      processed: results.filter((result) => result.processed).length,
      updated: results.filter((result) => result.updated).length,
      skipped: artists.length - results.filter((result) => result.updated).length,
      results,
      stopped_early: true,
      stop_reason: stopReason,
      duration_ms: Date.now() - startedAt,
    }
  }

  options.onProgress?.({
    currentStep: 'Phase 2/2: Completing full Get Intel enrichment',
    processed: 0,
    total: artists.length,
  })

  for (const item of artists) {
    if (shouldStop?.()) {
      stoppedEarly = true
      stopReason = 'Stopped by user'
      break
    }

    if (Date.now() - startedAt >= MAX_BULK_RUNTIME_MS) {
      stoppedEarly = true
      stopReason = `Bulk timeout reached (${MAX_BULK_RUNTIME_MS}ms)`
      break
    }

    const timeoutResult: ArtistIntelResult = {
      id: item.id,
      name: item.name,
      processed: false,
      updated: false,
      updated_fields: [],
      sources: [],
      confidence: 0,
      website_url: null,
      profile_image_url: null,
      gallery_image_urls: [],
      official_pages: [],
      error: `Artist timeout (${PER_ARTIST_TIMEOUT_MS}ms)`,
    }

    const result = await Promise.race<ArtistIntelResult>([
      runArtistIntelForArtist(db, item.id, mode, {
        config,
        onProgress: ({ artistName, currentStep, sourcesUsed, completedActions, updatedFields, confidence }) => {
          options.onProgress?.({
            artistName,
            currentStep,
            processed: results.length,
            total: data.length,
            sourcesUsed,
            completedActions,
            updatedFields,
            confidence,
          })
        },
      }),
      new Promise<ArtistIntelResult>((resolve) => {
        setTimeout(() => resolve(timeoutResult), PER_ARTIST_TIMEOUT_MS)
      }),
    ])

    results.push(result)
    options.onProgress?.({
      artistName: result.name,
      currentStep: result.processed
        ? `Completed ${result.name}`
        : `Failed ${result.name}: ${result.error ?? 'Unknown error'}`,
      processed: results.length,
      total: data.length,
    })
    if (!result.processed) {
      consecutiveFailures += 1
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        stoppedEarly = true
        stopReason = `Stopped after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
        break
      }
    } else {
      consecutiveFailures = 0
    }

    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  const processed = results.filter((result) => result.processed).length
  const updated = results.filter((result) => result.updated).length
  return {
    total: data.length,
    processed,
    updated,
    skipped: data.length - updated,
    results,
    stopped_early: stoppedEarly,
    stop_reason: stopReason,
    duration_ms: Date.now() - startedAt,
  }
}
