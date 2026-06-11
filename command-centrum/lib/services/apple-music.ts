import { withRetryAndTimeout } from '../utils/resilience'
import { getProviderPolicy } from '../config/provider-policies'

// Apple Music via iTunes Search API — public, no auth required
const SEARCH_URL = 'https://itunes.apple.com/search'

export type AppleMusicResult = {
  song_url: string | null
  artist_url: string | null
  artist_id: string | null
  artwork_url: string | null
  track_name: string | null
  artist_name: string | null
}

function normalizeArtistName(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().trim()
}

export async function searchAppleMusicArtist(artist: string): Promise<AppleMusicResult> {
  const empty: AppleMusicResult = {
    song_url: null,
    artist_url: null,
    artist_id: null,
    artwork_url: null,
    track_name: null,
    artist_name: null,
  }

  const policy = getProviderPolicy('apple_music')

  try {
    const result = await withRetryAndTimeout(
      async () => {
        const url = `${SEARCH_URL}?term=${encodeURIComponent(artist)}&media=music&entity=musicArtist&limit=5&country=us`

        const res = await fetch(url, {
          headers: { 'User-Agent': 'HotDroppZ/1.0' },
        })

        if (!res.ok) throw new Error(`Apple Music search error: ${res.status}`)

        return res.json() as Promise<{
          results?: Array<{
            artistName?: string
            artistId?: number | string
            artistLinkUrl?: string
          }>
        }>
      },
      policy,
      'apple_music'
    )

    const artistLower = normalizeArtistName(artist)
    const best = result.results?.find((item) => normalizeArtistName(item.artistName) === artistLower)
      ?? result.results?.find((item) => normalizeArtistName(item.artistName).includes(artistLower) || artistLower.includes(normalizeArtistName(item.artistName)))

    if (!best?.artistLinkUrl) return empty

    return {
      song_url: null,
      artist_url: best.artistLinkUrl,
      artist_id: best.artistId ? String(best.artistId) : null,
      artwork_url: null,
      track_name: null,
      artist_name: best.artistName ?? null,
    }
  } catch {
    return empty
  }
}

export async function searchAppleMusic(
  artist: string,
  track?: string
): Promise<AppleMusicResult> {
  const artistResult = await searchAppleMusicArtist(artist)
  if (artistResult.artist_url) return artistResult

  const empty: AppleMusicResult = {
    song_url: null,
    artist_url: null,
    artist_id: null,
    artwork_url: null,
    track_name: null,
    artist_name: null,
  }

  const policy = getProviderPolicy('apple_music')

  try {
    const term = track ? `${artist} ${track}` : artist
    const result = await withRetryAndTimeout(
      async () => {
        const url = `${SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=3&country=us`

        const res = await fetch(url, {
          headers: { 'User-Agent': 'HotDroppZ/1.0' },
        })

        if (!res.ok) throw new Error(`Apple Music track search error: ${res.status}`)

        return res.json() as Promise<{
          resultCount: number
          results: Array<{
            kind: string
            trackViewUrl?: string
            artistViewUrl?: string
            artworkUrl100?: string
            trackName?: string
            artistName?: string
          }>
        }>
      },
      policy,
      'apple_music'
    )

    if (!result.results?.length) return empty

    // Prefer a result where artist name matches
    const artistLower = artist.toLowerCase()
    const best = result.results.find(
      (r) => r.kind === 'song' && r.artistName?.toLowerCase().includes(artistLower)
    ) ?? result.results.find((r) => r.kind === 'song') ?? result.results[0]

    return {
      song_url:    best.trackViewUrl  ?? null,
      artist_url:  best.artistViewUrl ?? null,
      artist_id:   null,
      artwork_url: best.artworkUrl100 ? best.artworkUrl100.replace('100x100', '400x400') : null,
      track_name:  best.trackName     ?? null,
      artist_name: best.artistName    ?? null,
    }
  } catch {
    return empty
  }
}
