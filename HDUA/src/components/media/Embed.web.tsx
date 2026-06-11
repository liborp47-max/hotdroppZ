import React from 'react'

import { radius } from '@/styles/theme'
import type { Embed as EmbedData } from '@/lib/embeds'

/**
 * Inline Spotify/YouTube player on web — a real iframe so users play the full
 * track/video without leaving the feed (HDUA-04). Native uses Embed.tsx (link
 * fallback) since there is no WebView dependency.
 */
export function EmbedPlayer({ embed }: { embed: EmbedData }) {
  return React.createElement('iframe', {
    src: embed.embedUrl,
    style: {
      border: 0,
      width: '100%',
      height: embed.height,
      borderRadius: radius.md,
      display: 'block',
      colorScheme: 'normal',
    },
    allow: 'encrypted-media; clipboard-write; autoplay; fullscreen; picture-in-picture',
    allowFullScreen: true,
    loading: 'lazy',
  })
}
