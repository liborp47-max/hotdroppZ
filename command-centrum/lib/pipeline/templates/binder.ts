/**
 * Field Binder - Manages template field filling
 * Handles Writer, Enricher, Creator field injections
 */

import type { TemplateInstance } from './base'

export interface FieldFillRequest {
  instanceId: string
  templateId: string
  clusterId: string
  module: 'writer' | 'enricher' | 'creator'
  fields: Record<string, any>
}

export interface FieldFillResult {
  instanceId: string
  filled: number
  failed: number
  warnings: string[]
  updatedAt: string
}

/**
 * Bind fields to template instance (Writer fills text fields)
 */
export async function bindWriterFields(
  instance: TemplateInstance,
  writerOutput: {
    headline?: string
    hook?: string
    body?: string
    cta_text?: string
    tags?: string[]
    [key: string]: any
  }
): Promise<FieldFillResult> {
  const filled: string[] = []
  const warnings: string[] = []

  // Map writer output to template fields
  for (const [key, value] of Object.entries(writerOutput)) {
    if (key in instance.data) {
      instance.data[key] = value
      filled.push(key)
    } else {
      warnings.push(`Writer provided unexpected field: ${key}`)
    }
  }

  instance.filledBy.writer = true
  instance.updatedAt = new Date().toISOString()

  // Update status
  const allFilled = Object.values(instance.data).every((v) => v !== null && v !== undefined)
  instance.status = allFilled ? 'complete' : 'partial'

  return {
    instanceId: instance.clusterId, // Using clusterId as identifier
    filled: filled.length,
    failed: 0,
    warnings,
    updatedAt: instance.updatedAt,
  }
}

/**
 * Bind fields to template instance (Enricher fills link/metadata fields)
 */
export async function bindEnricherFields(
  instance: TemplateInstance,
  enricherOutput: {
    youtube_url?: string
    spotify_url?: string
    apple_music_url?: string
    genius_url?: string
    other_platforms?: string[]
    featured_artists?: string
    producer_info?: string
    [key: string]: any
  }
): Promise<FieldFillResult> {
  const filled: string[] = []
  const warnings: string[] = []

  // Map enricher output to template fields
  for (const [key, value] of Object.entries(enricherOutput)) {
    if (key in instance.data && value) {
      instance.data[key] = value
      filled.push(key)
    }
  }

  instance.filledBy.enricher = true
  instance.updatedAt = new Date().toISOString()

  // Update status
  const allFilled = Object.values(instance.data).every((v) => v !== null && v !== undefined)
  instance.status = allFilled ? 'complete' : 'partial'

  return {
    instanceId: instance.clusterId,
    filled: filled.length,
    failed: 0,
    warnings,
    updatedAt: instance.updatedAt,
  }
}

/**
 * Bind fields to template instance (Creator fills image/gallery fields)
 */
export async function bindCreatorFields(
  instance: TemplateInstance,
  creatorOutput: {
    main_image?: string
    gallery_images?: string[]
    featured_image?: string
    supporting_images?: string[]
    album_art?: string
    track_cover?: string
    tracklist_visual?: string[]
    thumbnail?: string
    [key: string]: any
  }
): Promise<FieldFillResult> {
  const filled: string[] = []
  const warnings: string[] = []

  // Map creator output to template fields
  for (const [key, value] of Object.entries(creatorOutput)) {
    if (key in instance.data && value) {
      instance.data[key] = value
      filled.push(key)
    }
  }

  instance.filledBy.creator = true
  instance.updatedAt = new Date().toISOString()

  // Update status
  const allFilled = Object.values(instance.data).every((v) => v !== null && v !== undefined)
  instance.status = allFilled ? 'complete' : 'partial'

  return {
    instanceId: instance.clusterId,
    filled: filled.length,
    failed: 0,
    warnings,
    updatedAt: instance.updatedAt,
  }
}

/**
 * Get current state of template instance (what's filled, what's missing)
 */
export function getInstanceState(instance: TemplateInstance): {
  filled: Record<string, any>
  empty: string[]
  completeness: number
} {
  const filled: Record<string, any> = {}
  const empty: string[] = []

  for (const [key, value] of Object.entries(instance.data)) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      empty.push(key)
    } else {
      filled[key] = value
    }
  }

  const completeness = Object.keys(filled).length / Object.keys(instance.data).length

  return { filled, empty, completeness: Math.round(completeness * 100) }
}

/**
 * Export template instance as feed-ready content
 */
export function exportToFeedPost(instance: TemplateInstance): {
  title: string
  body: string
  summary: string
  tags: string[]
  images: Record<string, string>
  links: Record<string, string | string[]>
  metadata: Record<string, any>
} {
  const { filled } = getInstanceState(instance)

  return {
    title: filled.headline || filled.title || 'Untitled',
    body: filled.body || '',
    summary: filled.hook || filled.summary || '',
    tags: filled.tags || [],
    images: {
      main: filled.main_image || filled.album_art || filled.featured_image,
      secondary: filled.gallery_images?.length > 0 ? filled.gallery_images[0] : undefined,
    },
    links: {
      youtube: filled.youtube_url,
      spotify: filled.spotify_url,
      apple_music: filled.apple_music_url,
      genius: filled.genius_url,
      other: filled.other_platforms || [],
    },
    metadata: {
      artist: filled.artist_name,
      featured_artists: filled.featured_artists,
      producer: filled.producer_info,
      template_type: instance.templateType,
      cluster_id: instance.clusterId,
    },
  }
}
