const SEARCH_URL = 'https://pixabay.com/api/'
const TIMEOUT_MS = 6_000

export type PixabayImage = {
  image_url: string
  source: 'pixabay'
  author: string
  license: string
  width: number
  height: number
}

export type PixabaySearchResult = {
  images: PixabayImage[]
  total: number
}

export async function searchPixabay(
  query: string,
  limit: number = 10
): Promise<PixabaySearchResult> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return { images: [], total: 0 }

  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('per_page', limit.toString())
    url.searchParams.set('image_type', 'photo')
    url.searchParams.set('orientation', 'horizontal')
    url.searchParams.set('safesearch', 'true')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.warn('PIXABAY: HTTP', res.status, res.statusText)
      return { images: [], total: 0 }
    }

    const data = await res.json() as {
      hits: Array<{
        webformatURL: string
        user: string
        previewURL: string
        webformatWidth: number
        webformatHeight: number
      }>
      totalHits: number
    }

    const images: PixabayImage[] = data.hits.map((item) => ({
      image_url: item.webformatURL,
      source: 'pixabay' as const,
      author: item.user,
      license: 'Pixabay License — Free for commercial use, no attribution required',
      width: item.webformatWidth,
      height: item.webformatHeight,
    }))

    return { images, total: data.totalHits }
    } catch (err) {
    console.warn('PIXABAY: search failed for', query, err)
    return { images: [], total: 0 }
  }
}

// License filter: Pixabay images under Pixabay License are free for commercial use
export function isPixabayLicenseFree(license: string): boolean {
  return license.includes('Pixabay License') || license.includes('Creative Commons')
}

// Helper to extract keywords from title for search queries
export function extractKeywordsFromTitle(title: string): string[] {
  // Remove common stop words and special characters
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'ft', 'feat', 'featuring', 'remix', 'mix', 'edit', 'version', 'official', 'video', 'lyrics',
    'audio', 'stream', 'release', 'drop', 'new', 'latest', 'premiere'
  ])

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5)
}
