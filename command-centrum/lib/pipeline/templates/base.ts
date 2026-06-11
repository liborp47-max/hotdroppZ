/**
 * Template System - Base types and interfaces
 * Defines structure for content templates across different post types
 */

export type TemplateType =
  | 'video_drop'
  | 'single_drop'
  | 'album_drop'
  | 'global_news'
  | 'artist_interview'
  | 'event_announcement'
  | 'cultural_moment'

export type FieldType = 'text' | 'image' | 'link' | 'links' | 'metadata' | 'gallery'

export interface TemplateField {
  name: string
  type: FieldType
  required: boolean
  maxLength?: number
  description: string
  writer?: {
    generate: boolean // Writer should fill this
    prompt?: string
  }
  enricher?: {
    collect: boolean // Enricher should fill this
    sources?: ('spotify' | 'youtube' | 'genius' | 'apple_music' | 'tiktok')[]
  }
  creator?: {
    generate: boolean // Creator should fill this
    format?: 'image' | 'gallery' | 'video_preview'
  }
}

export interface Template {
  id: string
  name: string
  type: TemplateType
  description: string
  category: string // 'droppz', 'news', 'culture', etc
  applicableContentTypes: string[]
  priority: number // Higher = preferred first
  fields: TemplateField[]
  metadata?: {
    minClusterSize?: number
    requiresImage?: boolean
    requiresAudio?: boolean
    requiresLinks?: number
  }
}

export interface TemplateInstance {
  templateId: string
  templateType: TemplateType
  clusterId: string
  data: Record<string, any>
  filledBy: {
    writer: boolean
    enricher: boolean
    creator: boolean
  }
  status: 'empty' | 'partial' | 'complete'
  createdAt: string
  updatedAt: string
}

/**
 * Helper: Check if template is suitable for cluster
 */
export function isTemplateApplicable(
  template: Template,
  cluster: {
    category?: string | null
    main_entity?: string
    title?: string
    source_links?: Record<string, string[]>
    images?: Record<string, string>
  }
): boolean {
  // Check category match
  if (template.category && cluster.category) {
    if (!template.applicableContentTypes.includes(cluster.category)) {
      return false
    }
  }

  // Check metadata requirements
  if (template.metadata) {
    if (template.metadata.requiresImage && !cluster.images?.cover) {
      return false
    }
    if (template.metadata.requiresAudio && !cluster.source_links?.spotify) {
      return false
    }
    if (template.metadata.requiresLinks) {
      const linkCount = Object.values(cluster.source_links || {}).flat().length
      if (linkCount < template.metadata.requiresLinks) {
        return false
      }
    }
  }

  return true
}

/**
 * Helper: Calculate template match score
 */
export function scoreTemplate(
  template: Template,
  cluster: {
    category?: string | null
    source_links?: Record<string, string[]>
    images?: Record<string, string>
  }
): number {
  let score = 0

  // Category match
  if (template.category && cluster.category === template.category) {
    score += 50
  }

  // Priority bonus
  score += template.priority * 5

  // Data richness bonus
  const linkCount = Object.values(cluster.source_links || {}).flat().length
  if (linkCount > 0) score += linkCount * 2

  if (cluster.images?.cover) score += 10
  if (cluster.images?.gallery) score += 5

  return score
}
