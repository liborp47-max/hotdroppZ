import type { Embed as EmbedData } from '@/lib/embeds'

/**
 * Native fallback for inline embeds. Without a WebView dependency there is no
 * inline player on device yet, so we render nothing — the source pills/buttons
 * already provide the deep link to Spotify/YouTube. The web build uses
 * Embed.web.tsx (real iframe player). A WebView-based native player is a later
 * refinement (HDUA-04/HDUA-08).
 */
export function EmbedPlayer(_props: { embed: EmbedData }) {
  return null
}
