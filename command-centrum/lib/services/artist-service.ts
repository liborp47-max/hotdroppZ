// ─── Artist Service ────────────────────────────────────────────────────────────
// Handles artist lookup, enrichment, release tracking, and feed score boosting
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, createAdminClient } from '../supabase/server'
import { searchSpotify } from '../services/spotify'
import { searchYouTube } from '../services/youtube'
import { searchGenius } from '../services/genius'
import type {
  Artist,
  ArtistCountry,
  ArtistRelease,
  ArtistWithStats,
  ArtistPriorityMap,
} from '../types/artists'

const CZ_ARTIST_NAMES = [
  'Atlantida','Basi & DJ Wich','Bizzy','CDK','D Feet','Denis','Drizzly','H16',
  'HAVEL','Hubert','Jasyo','KVN','Lvcas Dope','Majk Spirit','Mikro','Nemilek',
  'Nik Tendo','Onsuch','Osa','Rest','Ryl','Sadist','Sayuw','Separace','Sergej',
  'Sigor','Slime','Victor','W&W','Yami','Yungblud','Zakky'
]

const UK_ARTIST_NAMES = [
  'Central Cee','Dave','Stormzy','Skepta','J Hus','Slowthai','Kano','Ghetts',
  'Loyle Carner','AJ Tracey','M Huncho','Nines','Wiley','D Double E','Chip','Sampa the Great'
]

const US_ARTIST_NAMES = [
  'Travis Scott','Drake','Kendrick Lamar','J. Cole','Future','Metro Boomin','21 Savage',
  'Offset','Takeoff','Quavo','Lil Uzi Vert','Playboi Carti','Young Thug','Gunna',
  'Lil Baby','Roddy Ricch','Tyler, The Creator','A$AP Rocky','A$AP Ferg','Megan Thee Stallion'
]

// Combine all priority artists for quick lookup
const PRIORITY_ARTISTS = new Set([
  ...CZ_ARTIST_NAMES,
  ...UK_ARTIST_NAMES,
  ...US_ARTIST_NAMES,
])

// Country → primary market mapping for source routing
const COUNTRY_SOURCES: Record<string, string[]> = {
  cz:   ['Refresher CZ', 'Rap Revue', 'HipHop.cz', 'iRadio Beat CZ', 'Rapzname CZ'],
  uk:   ['GRM Daily', 'NME Music', 'The Fader'],
  us:   ['XXL', 'Complex Music', 'Vibe', 'AllHipHop', 'The Source', 'HipHopDX'],
  de:   ['Backspin DE', 'HipHop.de', 'Juice Magazine DE', '16BARS.de', 'Rap.de'],
  fr:   ['Booska-P', 'Abcdr du Son', 'Raplume FR'],
  pl:   ['Popkiller PL', 'WhiteHouse PL', 'HipHop Centrum PL'],
  it:   ['HiphopTV IT', 'Rapologia IT'],
  es:   ['HipHop.es', 'HHGroups ES'],
  nl:   ['FunX NL', 'Puna NL'],
  sk:   ['Refresher SK', 'Flow SK', 'Raps.sk'],
}

// ─── ARTIST LOOKUP & ENRICHMENT ───────────────────────────────────────────────

export async function findOrCreateArtist(
  name: string,
  country: string,
  genre: string = 'rap'
): Promise<Artist | null> {
  const db = createAdminClient()
  if (!db) return null

  const normalized = name.toLowerCase().trim()

  // Try to find existing
  const { data: existing, error } = await db
    .from('artists')
    .select('*')
    .eq('normalized_name', normalized)
    .eq('country', country)
    .single()

  if (!error && existing) {
    return existing as Artist
  }

  // Create new artist with default score based on priority
  const isPriority = PRIORITY_ARTISTS.has(name)
  const baseScore = isPriority ? 85.0 : 50.0
  const priority: 'low' | 'medium' | 'high' | 'critical' =
    isPriority ? (['Travis Scott','Drake','Kendrick Lamar','Playboi Carti','Central Cee'].includes(name) ? 'critical' : 'high')
               : 'medium'

  const { data: newArtist, error: insertErr } = await db
    .from('artists')
    .insert({
      name,
      normalized_name: normalized,
      country: country as any,
      genre: genre as any,
      base_score: baseScore,
      priority_level: priority,
      boost_multiplier: 1.0,
      tags: isPriority ? [name.split(' ')[0].toLowerCase()] : [],
    })
    .select()
    .single()

  if (insertErr) {
    console.error('ARTIST: failed to create', name, insertErr.message)
    return null
  }

  return newArtist as Artist
}

// Enrich artist with external API data (Spotify/YouTube/Genius)
export async function enrichArtistProfile(
  artistId: string,
  options: { fetchSpotify?: boolean; fetchYouTube?: boolean; fetchGenius?: boolean } = {}
): Promise<void> {
  const db = createAdminClient()
  if (!db) return

  const { data: artist, error } = await db
    .from('artists')
    .select('*')
    .eq('id', artistId)
    .single()

  if (error || !artist) return

  const updates: Record<string, any> = { ai_fetched_at: new Date().toISOString() }

  if (options.fetchSpotify && !artist.spotify_url) {
    const result = await searchSpotify(artist.name)
    if (result.artist_url) {
      updates.spotify_url = result.artist_url
    }
    if (result.track_url && !artist.spotify_url) {
      // Also could store latest track
    }
  }

  if (options.fetchYouTube && !artist.youtube_url) {
    // YouTube search for official artist channel
    // This would require a separate YouTube service call
  }

  if (options.fetchGenius && !artist.genius_url) {
    const result = await searchGenius(artist.name)
    if (result.song_url) {
      updates.genius_url = result.song_url
    }
  }

  if (Object.keys(updates).length > 1) {
    await db
      .from('artists')
      .update(updates)
      .eq('id', artistId)
  }
}

// ─── RELEASE TRACKING ─────────────────────────────────────────────────────────

export async function trackArtistRelease(
  artistId: string,
  releaseData: {
    title: string
    type: 'album' | 'track' | 'ep' | 'single' | 'video' | 'mixtape'
    release_date: string
    spotify_url?: string | null
    apple_music_url?: string | null
    youtube_url?: string | null
    genius_url?: string | null
  }
): Promise<ArtistRelease | null> {
  const db = createAdminClient()
  if (!db) return null

  // Insert release
  const { data: release, error } = await db
    .from('artist_releases')
    .insert({
      artist_id: artistId,
      title: releaseData.title,
      type: releaseData.type,
      release_date: releaseData.release_date,
      spotify_url: releaseData.spotify_url ?? null,
      apple_music_url: releaseData.apple_music_url ?? null,
      youtube_url: releaseData.youtube_url ?? null,
      genius_url: releaseData.genius_url ?? null,
      is_new_release: releaseData.release_date >= new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
      is_hot_trend: false, // will be set by mark_trending_artists()
    })
    .select()
    .single()

  if (error) {
    console.error('ARTIST: failed to track release', error.message)
    return null
  }

  // Trigger boost calculation
  await db
    .rpc('boost_artist_on_release', {
      p_artist_id: artistId,
      p_release_date: releaseData.release_date,
    })

  return release as ArtistRelease
}

// ─── ARTIST PRIORITY MAP FOR FEED RANKING ─────────────────────────────────────

export async function getArtistPriorityMap(
  artistNames: string[],
  country?: string
): Promise<ArtistPriorityMap> {
  const db = createAdminClient()
  if (!db) return {}

  const normalizedNames = artistNames.map(n => n.toLowerCase().trim())

  const { data: artists, error } = await db
    .from('artists')
    .select('*')
    .in('normalized_name', normalizedNames)
    .eq('country', country ?? 'global')
    .or('country.is.null,country.eq.global')

  if (error || !artists) return {}

  const result: ArtistPriorityMap = {}

  // Build lookups
  const artistMap = new Map<string, Artist>()
  for (const a of artists as Artist[]) {
    artistMap.set(a.normalized_name, a)
  }

  for (const rawName of artistNames) {
    const norm = rawName.toLowerCase().trim()
    const artist = artistMap.get(norm)

    if (artist) {
      const daysAgo = artist.last_release_at
        ? Math.floor((Date.now() - new Date(artist.last_release_at).getTime()) / (24*60*60*1000))
        : null

      result[rawName] = {
        boost: artist.boost_multiplier,
        priority: artist.priority_level,
        isTrending: artist.trending_boost,
        lastReleaseDaysAgo: daysAgo,
      }
    } else {
      // Unknown artist — minimal boost
      result[rawName] = {
        boost: 1.0,
        priority: 'low',
        isTrending: false,
        lastReleaseDaysAgo: null,
      }
    }
  }

  return result
}

// ─── TRENDING ARTIST DETECTION ────────────────────────────────────────────────

export async function updateTrendingFlags(): Promise<number> {
  const db = createAdminClient()
  if (!db) return 0

  const { data, error } = await db
    .rpc('mark_trending_artists')

  if (error) {
    console.error('ARTIST: failed to update trending flags', error.message)
    return 0
  }

  return data as number || 0
}

// ─── ARTIST SEARCH / DISCOVERY ────────────────────────────────────────────────

export async function searchArtists(
  query: string,
  country?: string,
  genre?: string,
  page = 1,
  pageSize = 20
): Promise<{ artists: Artist[]; total: number }> {
  const db = createAdminClient()
  if (!db) return { artists: [], total: 0 }

  const q = `%${query.toLowerCase()}%`
  const offset = (page - 1) * pageSize

  let q2 = db
    .from('artists')
    .select('*', { count: 'exact' })
    .ilike('normalized_name', q)
  if (country) q2 = q2.eq('country', country)
  if (genre) q2 = q2.eq('genre', genre)
  const { data, error, count } = await q2
    .order('base_score', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error('ARTIST: search error', error.message)
    return { artists: [], total: 0 }
  }

  return {
    artists: (data as Artist[]) || [],
    total: count || 0,
  }
}

// ─── FEED BOOST INTEGRATION ───────────────────────────────────────────────────

export function applyArtistBoostToPosts(
  posts: Array<{
    id: string
    artist?: string | null
    ai_score: number
    category: string
    published_at?: string | null
  }>,
  artistBoostMap?: ArtistPriorityMap
): Array<{
  id: string
  boosted_score: number
  artist_boost_factor: number
}> {
  // Lazy-load priority map if not provided
  const boostCache = new Map<string, { boost: number; priority: string }>()

  return posts.map(post => {
    const artistName = post.artist
    if (!artistName) {
      return { id: post.id, boosted_score: post.ai_score, artist_boost_factor: 1.0 }
    }

    const norm = artistName.toLowerCase().trim()

    // Check if we have pre-fetched boost data
    if (artistBoostMap && artistBoostMap[artistName]) {
      const boostInfo = artistBoostMap[artistName]
      return {
        id: post.id,
        boosted_score: Math.round(post.ai_score * boostInfo.boost * 100) / 100,
        artist_boost_factor: boostInfo.boost,
      }
    }

    // Fallback: check if artist is in priority list (simple heuristic)
    const isPriority = PRIORITY_ARTISTS.has(artistName)
    const boost = isPriority ? 1.3 : 1.0

    return {
      id: post.id,
      boosted_score: Math.round(post.ai_score * boost * 100) / 100,
      artist_boost_factor: boost,
    }
  })
}

// ─── AUTOMATED SOURCE-TO-ARTIST MAPPING ───────────────────────────────────────

export function getPrimarySourcesForCountry(country: string): string[] {
  return COUNTRY_SOURCES[country] || COUNTRY_SOURCES['us'] || []
}

export function detectArtistCountry(name: string): ArtistCountry {
  // Simple heuristic: if name matches Czech artist list → cz
  if (CZ_ARTIST_NAMES.includes(name as any)) return 'cz'
  if (UK_ARTIST_NAMES.includes(name as any)) return 'uk'
  // Default to US for known US artists
  if (US_ARTIST_NAMES.includes(name as any)) return 'us'
  return 'us' // fallback
}
