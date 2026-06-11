// Minimal RSS 2.0 + Atom 1.0 parser for Node.js — no dependencies

export interface FeedItem {
  title: string
  url: string
  content: string
  pubDate: string | null
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function unescapeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function extractTag(xml: string, tag: string): string {
  // CDATA first
  const cdataRe = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    'i'
  )
  const cdataM = cdataRe.exec(xml)
  if (cdataM) return stripHtml(cdataM[1]).trim()

  // Normal text
  const normalRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const normalM = normalRe.exec(xml)
  if (normalM) return unescapeEntities(stripHtml(normalM[1])).trim()

  return ''
}

// WordPress / RSS 2.0 extensions: <content:encoded> carries the full article HTML
function extractContentEncoded(xml: string): string {
  const cdataM = /<content:encoded[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content:encoded>/i.exec(xml)
  if (cdataM) return stripHtml(cdataM[1]).trim()

  const plainM = /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i.exec(xml)
  if (plainM) return unescapeEntities(stripHtml(plainM[1])).trim()

  return ''
}

function extractLinkHref(itemXml: string): string {
  // Atom: prefer rel="alternate" (the canonical article URL)
  // Try both attribute orders
  const altM =
    /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i.exec(itemXml) ??
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["'][^>]*\/?>/i.exec(itemXml)
  if (altM) return altM[1]

  // Fallback: any <link href="..."> that is NOT rel=self/related/hub/via
  for (const match of itemXml.matchAll(/<link([^>]+)>/gi)) {
    const attrs = match[1]
    if (/rel=["'](self|related|hub|via)["']/i.test(attrs)) continue
    const hrefM = /href=["']([^"']+)["']/i.exec(attrs)
    if (hrefM) return hrefM[1]
  }

  return ''
}

function parseJsonFeed(json: Record<string, unknown>): FeedItem[] {
  const rawItems = json.items as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .slice(0, 25)
    .filter((item) => item.title && (item.url || item.id))
    .map((item) => ({
      title: String(item.title ?? ''),
      url: String(item.url ?? item.id ?? ''),
      content: stripHtml(String(item.content_html ?? item.content_text ?? item.summary ?? '')).slice(0, 1000),
      pubDate: String(item.date_published ?? item.date_modified ?? '') || null,
    }))
}

export function parseFeed(raw: string): FeedItem[] {
  // JSON Feed (https://www.jsonfeed.org/)
  if (raw.trimStart().startsWith('{')) {
    try {
      return parseJsonFeed(JSON.parse(raw) as Record<string, unknown>)
    } catch {
      return []
    }
  }

  // RSS 2.0: <item> / Atom 1.0: <entry>
  const rssItems = [...raw.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g)].map((m) => m[0])
  const atomItems = [...raw.matchAll(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/g)].map((m) => m[0])
  const rawItems = rssItems.length > 0 ? rssItems : atomItems

  const items: FeedItem[] = []

  for (const xml of rawItems.slice(0, 25)) {
    const title = extractTag(xml, 'title')
    if (!title || title.length < 5) continue

    // URL: <link> text content (RSS) or href attr (Atom, prefers rel="alternate")
    const linkText = extractTag(xml, 'link')
    const linkHref = extractLinkHref(xml)
    const url = linkText?.startsWith('http') ? linkText : linkHref
    if (!url) continue

    // Content: prefer content:encoded (WordPress full text) > description > content > summary
    const contentEncoded = extractContentEncoded(xml)
    const content = (
      contentEncoded ||
      extractTag(xml, 'description') ||
      extractTag(xml, 'content') ||
      extractTag(xml, 'summary') ||
      ''
    ).slice(0, 1000)

    const pubDate =
      extractTag(xml, 'pubDate') ||
      extractTag(xml, 'published') ||
      extractTag(xml, 'updated') ||
      null

    items.push({ title, url, content, pubDate: pubDate || null })
  }

  return items
}
