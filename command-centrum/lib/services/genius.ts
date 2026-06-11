import { withRetryAndTimeout } from '../utils/resilience'
import { getProviderPolicy } from '../config/provider-policies'

const SEARCH_URL = 'https://api.genius.com/search'

type GeniusResult = {
  song_url: string | null
  title: string | null
}

export async function searchGenius(query: string): Promise<GeniusResult> {
  const empty: GeniusResult = { song_url: null, title: null }

  const token = process.env.GENIUS_ACCESS_TOKEN
  if (!token) return empty

  const policy = getProviderPolicy('genius')

  try {
    const result = await withRetryAndTimeout(
      async () => {
        const url = new URL(SEARCH_URL)
        url.searchParams.set('q', query)

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) throw new Error(`Genius search error: ${res.status}`)

        return res.json() as Promise<{
          response?: {
            hits?: Array<{
              result?: { url?: string; full_title?: string }
            }>
          }
        }>
      },
      policy,
      'genius'
    )

    const hit = result.response?.hits?.[0]?.result
    if (!hit) return empty

    return {
      song_url: hit.url ?? null,
      title: hit.full_title ?? null,
    }
  } catch {
    return empty
  }
}
