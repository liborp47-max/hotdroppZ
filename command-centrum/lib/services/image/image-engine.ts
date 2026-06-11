const FETCH_TIMEOUT_MS = 4_000

const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
]

async function scrapeOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'HotDroppZ/1.0 (OG scraper)',
        Accept: 'text/html',
      },
    })

    if (!res.ok) return null

    // Read only first 20KB — og:image is always in <head>
    const reader = res.body?.getReader()
    if (!reader) return null

    let html = ''
    let totalBytes = 0
    const maxBytes = 20_000

    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
      totalBytes += value?.length ?? 0
      if (html.toLowerCase().includes('</head>')) break
    }
    reader.cancel().catch(() => null)

    for (const re of OG_IMAGE_RE) {
      const match = html.match(re)
      if (match?.[1]) return match[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Resolves the best available image for a post.
 *
 * Priority:
 *  1. OG image scraped from articleUrl
 *  2. First non-null entry in fallbacks[]
 *  3. null
 *
 * Never throws — always returns string | null.
 */
export async function resolveImage(
  articleUrl: string | null,
  fallbacks?: (string | null | undefined)[],
): Promise<string | null> {
  // 1. Try OG scraping
  if (articleUrl) {
    const og = await scrapeOgImage(articleUrl)
    if (og) return og
  }

  // 2. First valid fallback
  for (const fb of fallbacks ?? []) {
    if (fb) return fb
  }

  return null
}
