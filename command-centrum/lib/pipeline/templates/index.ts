/**
 * Template System - Main Exports
 */

export * from './base'
export * from './templates'
export * from './picker'
export * from './binder'

// Re-export for convenience
export { TEMPLATES, TEMPLATE_MAP } from './templates'
export { pickTemplate, createTemplateInstance, getFieldsForModule } from './picker'
export { bindWriterFields, bindEnricherFields, bindCreatorFields, exportToFeedPost } from './binder'
