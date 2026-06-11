const SEARCH_URL = 'https://commons.wikimedia.org/w/api.php'
const TIMEOUT_MS = 6_000

export type WikimediaImage = {
  image_url: string
  source: 'wikimedia'
  author: string
  license: string
  width: number
  height: number
  title: string
  snippet: string | null
}

export type WikimediaSearchResult = {
  images: WikimediaImage[]
  total: number
}

export async function searchWikimedia(
  query: string,
  limit: number = 10
): Promise<WikimediaSearchResult> {
  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('list', 'search')
    url.searchParams.set('srnamespace', '6') // File namespace
    url.searchParams.set('srsearch', query)
    url.searchParams.set('srlimit', limit.toString())

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.warn('WIKIMEDIA: HTTP', res.status, res.statusText)
      return { images: [], total: 0 }
    }

    const data = await res.json() as {
      query: {
        searchinfo: { totalhits: number }
        search: Array<{
          title: string
          snippet: string
        }>
      }
    }

    const searchResults = data.query?.search || []
    const images: WikimediaImage[] = []

    // Fetch image info for each result (parallel)
    const imagePromises = searchResults.map(async (item) => {
      try {
        const imageInfoUrl = new URL(SEARCH_URL)
        imageInfoUrl.searchParams.set('action', 'query')
        imageInfoUrl.searchParams.set('format', 'json')
        imageInfoUrl.searchParams.set('prop', 'imageinfo')
        imageInfoUrl.searchParams.set('iiprop', 'url|size|extmetadata')
        imageInfoUrl.searchParams.set('titles', item.title)

        const imageRes = await fetch(imageInfoUrl.toString(), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!imageRes.ok) return null

        const imageData = await imageRes.json() as {
          query: {
            pages: Record<string, {
              imageinfo: Array<{
                url: string
                width: number
                height: number
                extmetadata?: Record<string, { value?: string }>
              }>
            }>
          }
        }

        const page = Object.values(imageData.query?.pages || {})[0]
        const info = page?.imageinfo?.[0]

        if (!info) return null

        const artist = info.extmetadata?.Artist?.value || 'Wikimedia Commons user'
        const license = info.extmetadata?.LicenseShortName?.value || 'CC BY-SA 4.0'

        return {
          image_url: info.url,
          source: 'wikimedia' as const,
          author: artist,
          license: `${license} — Check attribution requirements`,
          width: info.width,
          height: info.height,
          title: item.title,
          snippet: item.snippet ?? null,
        }
      } catch {
        return null
      }
    })

    const results = await Promise.all(imagePromises)
    results.forEach((img) => {
      if (img) images.push(img)
    })

    return {
      images,
      total: data.query?.searchinfo?.totalhits || 0,
    }
  } catch (err) {
    console.warn('WIKIMEDIA: search failed for', query, err)
    return { images: [], total: 0 }
  }
}

// License filter: Only allow free licenses
export function isWikimediaLicenseFree(license: string): boolean {
  const freeLicenses = [
    'public domain',
    'cc0',
    'cc-by',
    'cc-by-sa',
    'cc-by-nd',
    'cc-by-nc',
    'cc-by-nc-sa',
    'cc-by-nc-nd',
  ]

  const lower = license.toLowerCase()
  return freeLicenses.some((l) => lower.includes(l))
}
