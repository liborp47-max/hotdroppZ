const SEARCH_URL = 'https://api.pexels.com/v1/search'
const TIMEOUT_MS = 6_000

export type PexelsImage = {
  image_url: string
  source: 'pexels'
  author: string
  license: string
  width: number
  height: number
}

export type PexelsSearchResult = {
  images: PexelsImage[]
  total: number
}

export async function searchPexels(
  query: string,
  limit: number = 10
): Promise<PexelsSearchResult> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return { images: [], total: 0 }

  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', limit.toString())
    url.searchParams.set('orientation', 'landscape')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Authorization': apiKey,
      },
    })

    if (!res.ok) {
      console.warn('PEXELS: HTTP', res.status, res.statusText)
      return { images: [], total: 0 }
    }

    const data = await res.json() as {
      photos: Array<{
        src: { large: string; original: string }
        photographer: string
        photographer_url: string
        width: number
        height: number
      }>
      total_results: number
    }

    const images: PexelsImage[] = data.photos.map((item) => ({
      image_url: item.src.large,
      source: 'pexels' as const,
      author: item.photographer,
      license: 'Pexels License — Free to use, no attribution required',
      width: item.width,
      height: item.height,
    }))

    return { images, total: data.total_results }
  } catch (err) {
    console.warn('PEXELS: search failed for', query, err)
    return { images: [], total: 0 }
  }
}

export async function getPexelsRandom(
  query: string | null = null,
  limit: number = 5
): Promise<PexelsImage[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  try {
    const url = new URL('https://api.pexels.com/v1/curated')
    url.searchParams.set('per_page', limit.toString())

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Authorization': apiKey,
      },
    })

    if (!res.ok) return []

    const data = await res.json() as {
      photos: Array<{
        src: { large: string }
        photographer: string
        width: number
        height: number
      }>
    }

    return data.photos.map((item) => ({
      image_url: item.src.large,
      source: 'pexels' as const,
      author: item.photographer,
      license: 'Pexels License — Free to use, no attribution required',
      width: item.width,
      height: item.height,
    }))
  } catch {
    return []
  }
}

// License filter: Pexels images are free for commercial use, no attribution required
export function isPexelsLicenseFree(_license: string): boolean {
  return true // All Pexels images under Pexels License are free to use
}
