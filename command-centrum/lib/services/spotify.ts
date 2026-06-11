import { withRetryAndTimeout } from '../utils/resilience'
import { getProviderPolicy } from '../config/provider-policies'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SEARCH_URL = 'https://api.spotify.com/v1/search'

type SpotifyResult = {
  track_url: string | null
  artist_url: string | null
  image_url: string | null
  artist_name: string | null
}

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const policy = getProviderPolicy('spotify')

  try {
    const result = await withRetryAndTimeout(
      async () => {
        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: 'grant_type=client_credentials',
        })

        if (!res.ok) throw new Error(`Spotify token error: ${res.status}`)

        const data = await res.json() as { access_token: string; expires_in: number }
        return data
      },
      policy,
      'spotify_token'
    )

    cachedToken = result.access_token
    tokenExpiresAt = Date.now() + (result.expires_in - 60) * 1000
    return cachedToken
  } catch {
    return null
  }
}

export async function searchSpotify(artist: string, track?: string): Promise<SpotifyResult> {
  const empty: SpotifyResult = { track_url: null, artist_url: null, image_url: null, artist_name: null }

  const token = await getToken()
  if (!token) return empty

  const q = track ? `${artist} ${track}` : artist
  const types = track ? 'track,artist' : 'artist'
  const policy = getProviderPolicy('spotify')

  try {
    const result = await withRetryAndTimeout(
      async () => {
        const url = new URL(SEARCH_URL)
        url.searchParams.set('q', q)
        url.searchParams.set('type', types)
        url.searchParams.set('limit', '5')

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) throw new Error(`Spotify search error: ${res.status}`)

        return res.json() as Promise<{
          tracks?: { items: Array<{ external_urls: { spotify: string }; album: { images: Array<{ url: string }> }; artists: Array<{ name: string; external_urls: { spotify: string } }> }> }
          artists?: { items: Array<{ name: string; external_urls: { spotify: string }; images: Array<{ url: string }> }> }
        }>
      },
      policy,
      'spotify'
    )

    const trackItem = result.tracks?.items?.[0]
    const artistItem = result.artists?.items?.[0]

    return {
      track_url: trackItem?.external_urls?.spotify ?? null,
      artist_url: artistItem?.external_urls?.spotify ?? null,
      image_url: trackItem?.album?.images?.[0]?.url ?? artistItem?.images?.[0]?.url ?? null,
      artist_name: trackItem?.artists?.[0]?.name ?? artistItem?.name ?? null,
    }
  } catch {
    return empty
  }
}
