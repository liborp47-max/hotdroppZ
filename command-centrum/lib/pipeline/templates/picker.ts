/**
 * Template Picker - Selects optimal template for cluster
 * Uses content-type detection + data richness scoring
 */

import { TEMPLATES, TEMPLATE_MAP } from './templates'
import type { Template, TemplateInstance } from './base'
import { isTemplateApplicable, scoreTemplate } from './base'
import { detectContentType } from '@/lib/services/content-type-detector'

export interface ClusterDataForPicker {
  id: string
  category?: string | null
  title?: string
  main_entity?: string
  merged_context?: string[]
  source_links?: Record<string, string[]> // { youtube: [...], spotify: [...] }
  images?: Record<string, string> // { cover, thumbnail, gallery }
  metadata?: Record<string, any>
}

export interface TemplatePickResult {
  selectedTemplate: Template
  candidates: Array<{ template: Template; score: number; applicable: boolean }>
  reasoning: string
  confidence: number // 0.0 - 1.0
}

/**
 * Pick best template for cluster
 * Strategy: content-type detection → filter applicable → score & rank → pick top
 */
export function pickTemplate(cluster: ClusterDataForPicker): TemplatePickResult {
  // Step 1: Detect content type
  const contentAnalysis = detectContentType({
    category: cluster.category,
    title: cluster.title,
    main_entity: cluster.main_entity,
    merged_context: cluster.merged_context,
  })

  const reasoning: string[] = []
  reasoning.push(`Content type detected: ${contentAnalysis.contentType}`)

  // Step 2: Filter templates by content type + applicability
  const candidates: Array<{ template: Template; score: number; applicable: boolean }> = []

  for (const template of TEMPLATES) {
    const isApplicable = isTemplateApplicable(template, cluster)
    const score = scoreTemplate(template, cluster)

    candidates.push({
      template,
      score,
      applicable: isApplicable,
    })
  }

  // Step 3: Rank candidates
  // Prefer applicable templates, then by score (higher is better)
  candidates.sort((a, b) => {
    // Applicable templates rank higher
    if (a.applicable && !b.applicable) return -1
    if (!a.applicable && b.applicable) return 1

    // Then by score
    return b.score - a.score
  })

  // Step 4: Select top candidate
  const selected = candidates[0]

  if (!selected) {
    throw new Error(`No applicable template found for cluster ${cluster.id}`)
  }

  const maxScore = Math.max(...candidates.map((c) => c.score))
  const confidence = selected.score / Math.max(maxScore, 1)

  reasoning.push(
    `Template "${selected.template.name}" selected (score: ${selected.score}, applicable: ${selected.applicable})`
  )

  if (!selected.applicable) {
    reasoning.push(
      `⚠️ Selected template is not strictly applicable - some fields may be empty`
    )
  }

  reasoning.push(`Confidence: ${(confidence * 100).toFixed(0)}%`)

  return {
    selectedTemplate: selected.template,
    candidates: candidates.slice(0, 5), // Top 5 for transparency
    reasoning: reasoning.join('; '),
    confidence,
  }
}

/**
 * Create template instance from cluster
 * Binds cluster data to template fields
 */
export function createTemplateInstance(
  cluster: ClusterDataForPicker,
  templateId: string
): TemplateInstance {
  const template = TEMPLATE_MAP[templateId]
  if (!template) {
    throw new Error(`Template ${templateId} not found`)
  }

  // Initialize data object with field names (values will be filled by modules)
  const data: Record<string, any> = {}

  for (const field of template.fields) {
    // Pre-fill metadata fields from cluster if available
    if (field.type === 'metadata') {
      if (field.name === 'artist_name' && cluster.main_entity) {
        data[field.name] = cluster.main_entity
      } else if (field.name === 'featured_artists' && cluster.metadata?.artists) {
        data[field.name] = cluster.metadata.artists
      }
    }

    // Pre-fill image fields
    if (field.type === 'image' || field.type === 'gallery') {
      if (field.name === 'main_image' && cluster.images?.cover) {
        data[field.name] = cluster.images.cover
      } else if (field.name === 'album_art' && cluster.images?.cover) {
        data[field.name] = cluster.images.cover
      } else if (field.name === 'track_cover' && cluster.images?.cover) {
        data[field.name] = cluster.images.cover
      } else if (field.name === 'gallery_images' && cluster.images?.gallery) {
        data[field.name] = cluster.images.gallery
      } else if (field.name === 'featured_image' && cluster.images?.featured) {
        data[field.name] = cluster.images.featured
      } else if (field.name === 'supporting_images' && cluster.images?.supporting) {
        data[field.name] = cluster.images.supporting
      }
    }

    // Pre-fill link fields from source_links
    if (field.type === 'link' || field.type === 'links') {
      if (field.enricher?.sources) {
        const collected: string[] = []
        for (const source of field.enricher.sources) {
          const links = cluster.source_links?.[source] || []
          collected.push(...links)
        }
        if (field.type === 'link' && collected.length > 0) {
          data[field.name] = collected[0]
        } else if (field.type === 'links') {
          data[field.name] = collected
        }
      }
    }

    // Initialize empty fields for writer/creator to fill
    if (!data[field.name]) {
      data[field.name] = null
    }
  }

  return {
    templateId,
    templateType: template.type,
    clusterId: cluster.id,
    data,
    filledBy: {
      writer: false,
      enricher: false,
      creator: false,
    },
    status: 'empty',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Validate template instance - check required fields
 */
export function validateTemplateInstance(
  instance: TemplateInstance,
  template: Template
): { valid: boolean; missingFields: string[]; warnings: string[] } {
  const missingFields: string[] = []
  const warnings: string[] = []

  for (const field of template.fields) {
    const value = instance.data[field.name]

    if (field.required && (value === null || value === undefined || value === '')) {
      missingFields.push(field.name)
    }

    // Warn if field has a max length but wasn't set by writer
    if (field.type === 'text' && field.maxLength && value && value.length > field.maxLength) {
      warnings.push(`Field "${field.name}" exceeds max length (${value.length}/${field.maxLength})`)
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  }
}

/**
 * Get fields for specific module to fill
 */
export function getFieldsForModule(
  template: Template,
  module: 'writer' | 'enricher' | 'creator'
): Template['fields'] {
  return template.fields.filter((field) => {
    if (module === 'writer') return field.writer?.generate
    if (module === 'enricher') return field.enricher?.collect
    if (module === 'creator') return field.creator?.generate
    return false
  })
}

/**
 * Get field fill instructions for module
 */
export function getModuleInstructions(
  template: Template,
  module: 'writer' | 'enricher' | 'creator'
): Array<{ fieldName: string; description: string; instructions?: string }> {
  const fields = getFieldsForModule(template, module)

  return fields.map((field) => {
    let instructions = ''

    if (module === 'writer' && field.writer?.prompt) {
      instructions = field.writer.prompt
    } else if (module === 'enricher' && field.enricher?.sources) {
      instructions = `Collect from: ${field.enricher.sources.join(', ')}`
    } else if (module === 'creator' && field.creator?.format) {
      instructions = `Generate as: ${field.creator.format}`
    }

    return {
      fieldName: field.name,
      description: field.description,
      instructions,
    }
  })
}
