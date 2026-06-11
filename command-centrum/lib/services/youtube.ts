import { withRetryAndTimeout } from '../utils/resilience'
import { getProviderPolicy } from '../config/provider-policies'

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'

type YouTubeResult = {
  video_url: string | null
  thumbnail_url: string | null
  video_id: string | null
}

export async function searchYouTube(query: string): Promise<YouTubeResult> {
  const empty: YouTubeResult = { video_url: null, thumbnail_url: null, video_id: null }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return empty

  const policy = getProviderPolicy('youtube')

  try {
    const result = await withRetryAndTimeout(
      async () => {
        const url = new URL(SEARCH_URL)
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('q', query)
        url.searchParams.set('type', 'video')
        url.searchParams.set('maxResults', '5')
        url.searchParams.set('key', apiKey)

        const res = await fetch(url.toString())

        if (!res.ok) throw new Error(`YouTube search error: ${res.status}`)

        return res.json() as Promise<{
          items?: Array<{
            id: { videoId: string }
            snippet: { thumbnails: { high?: { url: string }; default?: { url: string } } }
          }>
        }>
      },
      policy,
      'youtube'
    )

    const item = result.items?.[0]
    if (!item) return empty

    const videoId = item.id?.videoId
    if (!videoId) return empty

    return {
      video_id: videoId,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_url: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    }
  } catch {
    return empty
  }
}
