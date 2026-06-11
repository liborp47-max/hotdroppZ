// ── Image Enrichment Engine Core ──────────────────────────────────────────────
// Priority-based selection from Spotify, YouTube, Wikimedia, Unsplash, Pexels, Pixabay
// ───────────────────────────────────────────────────────────────────────────────

import { searchSpotify } from '../spotify'
import { searchYouTube } from '../youtube'
import { searchWikimedia } from './wikimedia'
import { searchUnsplash, getUnsplashRandom } from './unsplash'
import { searchPexels, getPexelsRandom } from './pexels'
import { searchPixabay } from './pixabay'

export type ImageCandidate = {
  image_url: string
  source: 'spotify' | 'youtube' | 'wikimedia' | 'unsplash' | 'pexels' | 'pixabay'
  author?: string
  license: string
  relevance_score: number // 0-1
}

export type EnrichmentInput = {
  main_entity?: string | null
  title: string
  category: string
  platforms?: string[]
  content?: string | null
}

export type EnrichmentResult = {
  image_url: string | null
  source: 'unsplash' | 'pexels' | 'pixabay' | 'spotify' | 'youtube' | 'wikimedia' | null
  author: string | null
  license: string | null
  relevance_score: number
  alternatives: ImageCandidate[]
}

// Words that look like entity names but are NOT music artists.
// Prevents enrichment from blindly Spotify-searching place names, brands, etc.
const NON_ARTIST_BLOCKLIST = new Set([
  // Tech companies / brands
  'google','apple','amazon','netflix','spotify','youtube','facebook','instagram','tiktok',
  'twitter','microsoft','openai','meta','samsung','sony','tesla','uber','airbnb',
  // Countries / regions
  'china','usa','russia','europe','africa','asia','uk','france','germany','italy',
  'spain','poland','brazil','india','japan','korea','mexico','canada','australia',
  // Cities / places
  'tenerife','london','paris','berlin','madrid','rome','amsterdam','barcelona',
  'new york','los angeles','chicago','miami','atlanta','houston','toronto',
  'dubai','istanbul','moscow','beijing','shanghai','tokyo','seoul',
  // Common words that slip through entity extraction
  'these','this','that','they','their','there','those','here','when','where',
  'people','family','families','woman','man','boy','girl','mother','father',
  'police','government','president','minister','court','judge','trial',
  // Health / science
  'coronavirus','covid','alzheimer','cancer','vaccine','virus','disease',
  // Finance
  'bitcoin','crypto','stock','market','bank','fund','investment',
])

const MUSIC_CONTENT_SIGNALS = [
  'album','single','ep','track','song','drops','drop','release','out now','available now',
  'music video','official video','mv','visualizer','lyric video',
  'tour','concert','festival','collab','feat','featuring','remix',
  'record deal','signed','label','grammy','award','billboard','chart',
  'streaming','debut','new music','freestyle','diss','beef','rap','hip hop',
  'rapper','producer','beat','banger','bop','anthem',
]

/**
 * Returns true only when the article is genuinely about the artist
 * doing something in music — not a general news article that mentions a name.
 */
export function isArtistMusicContent(mainEntity: string, title: string): boolean {
  const e = mainEntity.toLowerCase().trim()

  // Blocked terms are never artists
  if (NON_ARTIST_BLOCKLIST.has(e)) return false

  // Very short / generic tokens are never artists
  if (e.length < 3 || /^\d+$/.test(e)) return false

  const t = title.toLowerCase()

  // Artist name must appear in the title
  if (!t.includes(e)) return false

  // Title must also contain at least one music signal
  return MUSIC_CONTENT_SIGNALS.some((s) => t.includes(s))
}

/**
 * Cross-checks that the Spotify-returned artist name actually corresponds
 * to what we searched for. Prevents Spotify fuzzy matches from pulling
 * unrelated artists (e.g. "tenerife" → Ed Sheeran).
 */
export function spotifyArtistMatches(returnedName: string | null, searchedEntity: string): boolean {
  if (!returnedName) return false
  const r = returnedName.toLowerCase()
  const s = searchedEntity.toLowerCase()
  // Allow partial match both ways (handles abbreviations, "Lil X" vs "X")
  return r.includes(s) || s.includes(r) || r.split(' ').some((w) => w.length > 3 && s.includes(w))
}

export async function enrichImage(input: EnrichmentInput): Promise<EnrichmentResult> {
  const { main_entity, title, category, platforms = [] } = input
  const alternatives: ImageCandidate[] = []

  // ── 1. Spotify — only when the article is genuinely ABOUT the artist ──────
  if (main_entity && isArtistMusicContent(main_entity, title)) {
    const spotifyResult = await searchSpotify(main_entity)
    if (
      spotifyResult.image_url &&
      spotifyArtistMatches(spotifyResult.artist_name, main_entity)
    ) {
      return {
        image_url: spotifyResult.image_url,
        source: 'spotify',
        author: spotifyResult.artist_name || main_entity,
        license: 'Spotify — Platform-specific license',
        relevance_score: 0.95,
        alternatives: [],
      }
    }
    // Spotify returned something but name doesn't match → keep as low-confidence alternative
    if (spotifyResult.image_url) {
      alternatives.push({
        image_url: spotifyResult.image_url,
        source: 'spotify',
        license: 'Spotify — Platform-specific license',
        relevance_score: 0.40,
      })
    }
  }

  // ── 2. YouTube thumbnail — only for confirmed music content ───────────────
  const isVideoCategory = ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap', 'fun'].includes(category)
  const hasVideoPlatform = platforms.some((p) => p.toLowerCase().includes('youtube') || p.toLowerCase().includes('video'))
  const isMusicArticle = main_entity ? isArtistMusicContent(main_entity, title) : false

  if ((isVideoCategory && isMusicArticle) || hasVideoPlatform) {
    const query = main_entity ? `${main_entity} ${title.replace(new RegExp(main_entity, 'gi'), '').trim()}` : title
    const youtubeResult = await searchYouTube(query)
    if (youtubeResult.thumbnail_url) {
      alternatives.push({
        image_url: youtubeResult.thumbnail_url,
        source: 'youtube',
        license: 'YouTube — Fair use / thumbnail',
        relevance_score: 0.85,
      })
    }
  }

  // ── 3. Wikimedia — use ONLY when entity is confirmed artist ───────────────
  if (main_entity && isMusicArticle) {
    const wikimediaResult = await searchWikimedia(main_entity, 5)
    if (wikimediaResult.images.length > 0) {
      alternatives.push({
        ...wikimediaResult.images[0],
        relevance_score: 0.75,
      })
    }
  }

  // ── 4–6. Stock photo search — always built from TITLE keywords (not entity) ─
  // This ensures non-music/non-artist articles get contextually correct images.
  const keywords = extractKeywords(title)
  // For music articles use entity+keywords; for others use keywords only (avoids artist pollution)
  const query = (main_entity && isMusicArticle)
    ? `${main_entity} ${keywords.join(' ')}`
    : keywords.join(' ')

  if (query.trim()) {
    const unsplashResult = await searchUnsplash(query, 10)
    if (unsplashResult.images.length > 0) {
      alternatives.push({
        ...unsplashResult.images[0],
        relevance_score: 0.70,
      })
    }
  }

  if (alternatives.length === 0 && query.trim()) {
    const pexelsResult = await searchPexels(query, 10)
    if (pexelsResult.images.length > 0) {
      alternatives.push({
        ...pexelsResult.images[0],
        relevance_score: 0.65,
      })
    }
  }

  if (alternatives.length === 0 && query.trim()) {
    const pixabayResult = await searchPixabay(query, 10)
    if (pixabayResult.images.length > 0) {
      alternatives.push({
        ...pixabayResult.images[0],
        relevance_score: 0.60,
      })
    }
  }

  // Random fallback — use title keywords NOT main_entity to stay contextually relevant
  const fallbackQuery = keywords.length > 0 ? keywords[0] : undefined
  let attempts = 0
  while (alternatives.length < 3 && attempts < 6) {
    attempts++
    const randomUnsplash = await getUnsplashRandom(fallbackQuery, 1)
    if (randomUnsplash.length > 0) {
      alternatives.push({
        ...randomUnsplash[0],
        relevance_score: 0.30,
      })
    } else {
      const randomPexels = await getPexelsRandom(fallbackQuery, 1)
      if (randomPexels.length > 0) {
        alternatives.push({
          ...randomPexels[0],
          relevance_score: 0.30,
        })
      } else {
        break
      }
    }
  }
  if (attempts >= 6 && alternatives.length < 3) {
    console.warn(`IMAGE ENGINE: fallback exhausted after 6 attempts (found=${alternatives.length}), continuing without full alternatives`)
  }

  const best = alternatives[0]
  return {
    image_url: best?.image_url ?? null,
    source: best?.source ?? null,
    author: best?.author ?? null,
    license: best?.license ?? null,
    relevance_score: best?.relevance_score ?? 0,
    alternatives: alternatives.slice(0, 3),
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'ft','feat','featuring','remix','mix','edit','version','official','video','lyrics',
    'audio','stream','release','drop','new','latest','premiere','is','are','was','were'
  ])
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g,' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0,5)
}

export function isLicenseFree(license: string): boolean {
  const lower = license.toLowerCase()
  if (lower.includes('unsplash') || lower.includes('pexels') || lower.includes('pixabay')) return true
  if (lower.includes('public domain') || lower.includes('cc0') || lower.includes('cc-by')) return true
  if (lower.includes('spotify') || lower.includes('youtube')) return true
  return false
}
