/**
 * SM-1 — Card template picker.
 *
 * Pure function: maps `content_type + media signals` to one of the 4 templates.
 *
 *   Mission spec:
 *     "Podle content_type (release/interview/feature) + media (spotify/youtube/image)
 *      vybrat MusicCard/VideoCard/AlbumCard/FeatureCard."
 *
 * Priority order (first match wins):
 *   1. Explicit contentHint = 'interview' | 'feature' → FeatureCard
 *   2. content_type direct map (album → AlbumCard, video_release → VideoCard,
 *      track → MusicCard, event → FeatureCard)
 *   3. Media fallback when type is ambiguous (e.g. type missing or unrecognized):
 *        - youtube_url and NO spotify    → VideoCard
 *        - spotify_url present           → MusicCard
 *        - image_url only                → FeatureCard
 *        - nothing                       → FeatureCard (safe default)
 */

import type {
  ContentType,
  MediaSignal,
  TemplateId,
  TemplatePickInput,
  TemplatePickResult,
} from './types.ts'

export function pickTemplate(input: TemplatePickInput): TemplatePickResult {
  if (input.contentHint === 'interview' || input.contentHint === 'feature') {
    return { templateId: 'FeatureCard', reason: `contentHint=${input.contentHint}` }
  }

  const directMatch = mapTypeToTemplate(input.type)
  if (directMatch) {
    return { templateId: directMatch, reason: `type=${input.type}` }
  }

  const media = detectMediaSignals(input)
  if (media.includes('youtube') && !media.includes('spotify')) {
    return { templateId: 'VideoCard', reason: 'media=youtube-only' }
  }
  if (media.includes('spotify')) {
    return { templateId: 'MusicCard', reason: 'media=spotify' }
  }
  if (media.includes('image') && media.length === 1) {
    return { templateId: 'FeatureCard', reason: 'media=image-only' }
  }
  return { templateId: 'FeatureCard', reason: 'fallback' }
}

export function detectMediaSignals(input: TemplatePickInput): MediaSignal[] {
  const out: MediaSignal[] = []
  if (input.spotifyUrl) out.push('spotify')
  if (input.youtubeUrl) out.push('youtube')
  if (input.imageUrl) out.push('image')
  if (out.length === 0) out.push('none')
  return out
}

function mapTypeToTemplate(type: ContentType | string | undefined): TemplateId | null {
  switch (type) {
    case 'track':
      return 'MusicCard'
    case 'album':
      return 'AlbumCard'
    case 'video_release':
      return 'VideoCard'
    case 'event':
      return 'FeatureCard'
    default:
      return null
  }
}
