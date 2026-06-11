/**
 * Feed published-archive helpers (UM-FEED_UI / #06).
 *
 * Pure helpers for filtering, searching, sorting and exporting published
 * feed posts. No I/O, no framework imports — unit-testable in isolation.
 */

export interface ArchivableFeedPost {
  id: string
  headline: string
  artist_name: string
  content: string
  platforms: string[]
  languages: string[]
  status?: string
  created_at: string
  published_at?: string | null
  source?: 'writer' | 'creator' | string
}

/** Keeps only posts with `status === 'published'`. */
export function filterPublished<T extends ArchivableFeedPost>(posts: T[]): T[] {
  return posts.filter((p) => p.status === 'published')
}

/**
 * Case-insensitive search across headline, artist and content. Empty/blank
 * query returns the input unchanged.
 */
export function searchPosts<T extends ArchivableFeedPost>(posts: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return posts
  return posts.filter((p) => {
    const headline = p.headline?.toLowerCase() ?? ''
    const artist = p.artist_name?.toLowerCase() ?? ''
    const content = p.content?.toLowerCase() ?? ''
    return headline.includes(q) || artist.includes(q) || content.includes(q)
  })
}

/** Sorts newest-first by `published_at` (falling back to `created_at`). */
export function sortByPublishedDesc<T extends ArchivableFeedPost>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    const aMs = Date.parse(a.published_at ?? a.created_at)
    const bMs = Date.parse(b.published_at ?? b.created_at)
    if (Number.isNaN(aMs) && Number.isNaN(bMs)) return 0
    if (Number.isNaN(aMs)) return 1
    if (Number.isNaN(bMs)) return -1
    return bMs - aMs
  })
}

/**
 * Serializes published posts to CSV (RFC 4180 — fields containing `,`, `"`,
 * `\n` or `\r` are wrapped in `"` with internal `"` doubled).
 */
export function postsToCsv(posts: ArchivableFeedPost[]): string {
  const header = ['id', 'headline', 'artist', 'platforms', 'languages', 'source', 'published_at', 'created_at']
  const rows = [header.join(',')]
  for (const p of posts) {
    rows.push(
      [
        csvField(p.id),
        csvField(p.headline ?? ''),
        csvField(p.artist_name ?? ''),
        csvField((p.platforms ?? []).join('|')),
        csvField((p.languages ?? []).join('|')),
        csvField(p.source ?? ''),
        csvField(p.published_at ?? ''),
        csvField(p.created_at ?? ''),
      ].join(','),
    )
  }
  return rows.join('\n')
}

function csvField(value: string): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
