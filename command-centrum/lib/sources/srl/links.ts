/**
 * SRL handle → platform URL mapping (PR-S4).
 *
 * Single source of truth for turning an SRL handle bag (`PlatformLinks.links`
 * or a `CrossPlatformProfile.handles` map) into canonical platform URLs.
 * Consumed by every SRL consumer that needs URLs (Enrichment, Artist Service)
 * so the conversion logic is never duplicated across the pipeline.
 *
 * Conservative by design: we only emit a URL we can produce CORRECTLY.
 *  - Spotify artist IDs have a canonical URL shape, so a bare id is upgraded.
 *  - Every other platform is adopted ONLY when the stored handle is already an
 *    absolute URL — bare ids are never guessed into URLs.
 */

export interface SrlPlatformUrls {
  spotify_url?: string
  youtube_url?: string
  genius_url?: string
  apple_music_url?: string
}

const isAbsoluteUrl = (v?: string): v is string => Boolean(v) && /^https?:\/\//i.test(v!)

export function srlHandlesToUrls(links: Partial<Record<string, string>>): SrlPlatformUrls {
  const out: SrlPlatformUrls = {}

  const sp = links.spotify_artists
  if (sp) out.spotify_url = isAbsoluteUrl(sp) ? sp : `https://open.spotify.com/artist/${sp}`

  if (isAbsoluteUrl(links.youtube)) out.youtube_url = links.youtube
  if (isAbsoluteUrl(links.genius)) out.genius_url = links.genius
  if (isAbsoluteUrl(links.apple_music)) out.apple_music_url = links.apple_music

  return out
}
