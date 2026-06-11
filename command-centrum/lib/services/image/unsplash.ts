const SEARCH_URL = 'https://api.unsplash.com/search/photos'
const TIMEOUT_MS = 6_000

export type UnsplashImage = {
  image_url: string
  source: 'unsplash'
  author: string
  license: string
  width: number
  height: number
}

export type UnsplashSearchResult = {
  images: UnsplashImage[]
  total: number
}

export async function searchUnsplash(
  query: string,
  limit: number = 10
): Promise<UnsplashSearchResult> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) return { images: [], total: 0 }

  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', limit.toString())
    url.searchParams.set('orientation', 'landscape')
    url.searchParams.set('content_filter', 'high')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1',
      },
    })

    if (!res.ok) {
      console.warn('UNSPLASH: HTTP', res.status, res.statusText)
      return { images: [], total: 0 }
    }

    const data = await res.json() as {
      results: Array<{
        urls: { regular: string; full: string; raw: string }
        user: { name: string; username: string }
        links: { html: string }
        width: number
        height: number
      }>
      total: number
    }

    const images: UnsplashImage[] = data.results.map((item) => ({
      image_url: item.urls.regular,
      source: 'unsplash' as const,
      author: item.user.name,
      license: 'Unsplash License — Free to use, no attribution required',
      width: item.width,
      height: item.height,
    }))

    return { images, total: data.total }
  } catch (err) {
    console.warn('UNSPLASH: search failed for', query, err)
    return { images: [], total: 0 }
  }
}

export async function getUnsplashRandom(
  query: string | null = null,
  limit: number = 5
): Promise<UnsplashImage[]> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) return []

  try {
    const url = new URL('https://api.unsplash.com/photos/random')
    if (query) url.searchParams.set('query', query)
    url.searchParams.set('count', limit.toString())

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1',
      },
    })

    if (!res.ok) return []

    const data = await res.json() as Array<{
      urls: { regular: string }
      user: { name: string }
      width: number
      height: number
    }>

    return data.map((item) => ({
      image_url: item.urls.regular,
      source: 'unsplash' as const,
      author: item.user.name,
      license: 'Unsplash License — Free to use, no attribution required',
      width: item.width,
      height: item.height,
    }))
  } catch {
    return []
  }
}

// License filter: Unsplash images are free for commercial use, no attribution required
export function isUnsplashLicenseFree(_license: string): boolean {
  return true // All Unsplash images under Unsplash License are free to use
}
