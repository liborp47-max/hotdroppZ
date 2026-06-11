/** Build inline-player embed URLs from a post's source links (HDUA-04). */
import type { FeedItem } from '@/types'

export interface Embed {
  platform: 'spotify' | 'youtube'
  embedUrl: string
  height: number
}

/** open.spotify.com/track/ID → open.spotify.com/embed/track/ID */
function spotifyEmbed(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|artist)\/([a-zA-Z0-9]+)/)
  if (!m) return null
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
}

/** Various YouTube URL shapes → youtube.com/embed/ID */
function youtubeEmbed(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

/** Pick the best inline embed for a feed item, if any. Prefers Spotify (audio). */
export function pickEmbed(item: Pick<FeedItem, 'sources'>): Embed | null {
  const sources = item.sources ?? []
  const spotify = sources.find((s) => s.platform === 'spotify')
  if (spotify) {
    const url = spotifyEmbed(spotify.url)
    if (url) return { platform: 'spotify', embedUrl: url, height: 152 }
  }
  const yt = sources.find((s) => s.platform === 'youtube')
  if (yt) {
    const url = youtubeEmbed(yt.url)
    if (url) return { platform: 'youtube', embedUrl: url, height: 200 }
  }
  return null
}
