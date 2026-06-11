const WIKIDATA_SEARCH_URL = 'https://www.wikidata.org/w/api.php'
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql'
const TIMEOUT_MS = 7_000
const USER_AGENT = 'HotDroppZ/1.0 (Artist Intel)'

export type WikidataArtistDetails = {
  qid: string
  label: string | null
  description: string | null
  image_url: string | null
  official_website: string | null
  spotify_id: string | null
  youtube_channel_id: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  apple_music_id: string | null
}

function normalize(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().trim()
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...headers,
      },
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

export async function searchWikidataArtist(name: string): Promise<string | null> {
  const url = new URL(WIKIDATA_SEARCH_URL)
  url.searchParams.set('action', 'wbsearchentities')
  url.searchParams.set('search', name)
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '5')

  const data = await fetchJson<{
    search?: Array<{ id?: string; label?: string; description?: string }>
  }>(url.toString())
  if (!data?.search?.length) return null

  const exact = data.search.find((item) => {
    const description = normalize(item.description)
    return normalize(item.label) === normalize(name)
      && /(rapper|musician|singer|record producer|producer|hip hop|hip-hop|musical artist|band|music group|dj|beatmaker)/i.test(description)
  })

  const fallback = data.search.find((item) => {
    const description = normalize(item.description)
    return (normalize(item.label).includes(normalize(name)) || normalize(name).includes(normalize(item.label)))
      && /(rapper|musician|singer|record producer|producer|hip hop|hip-hop|musical artist|band|music group|dj|beatmaker)/i.test(description)
  })

  return exact?.id ?? fallback?.id ?? null
}

export async function getWikidataArtistDetails(qid: string): Promise<WikidataArtistDetails | null> {
  const query = `
    SELECT ?itemLabel ?itemDescription ?image ?spotify ?youtube ?instagram ?tiktok ?appleMusic ?website WHERE {
      BIND(wd:${qid} AS ?item)
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P856 ?website. }
      OPTIONAL { ?item wdt:P1902 ?spotify. }
      OPTIONAL { ?item wdt:P2397 ?youtube. }
      OPTIONAL { ?item wdt:P2003 ?instagram. }
      OPTIONAL { ?item wdt:P7085 ?tiktok. }
      OPTIONAL { ?item wdt:P2850 ?appleMusic. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1
  `

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`
  const data = await fetchJson<{
    results?: {
      bindings?: Array<Record<string, { value?: string }>>
    }
  }>(url, { Accept: 'application/sparql-results+json' })

  const row = data?.results?.bindings?.[0]
  if (!row) return null

  return {
    qid,
    label: row.itemLabel?.value ?? null,
    description: row.itemDescription?.value ?? null,
    image_url: row.image?.value ?? null,
    official_website: row.website?.value ?? null,
    spotify_id: row.spotify?.value ?? null,
    youtube_channel_id: row.youtube?.value ?? null,
    instagram_handle: row.instagram?.value ?? null,
    tiktok_handle: row.tiktok?.value ?? null,
    apple_music_id: row.appleMusic?.value ?? null,
  }
}
