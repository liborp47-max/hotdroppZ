/**
 * Feed Structure - Complete Data Container
 * Contains ALL data from Factory
 * Includes Validator, Translator, Distributor modules
 */

/**
 * Language type for Feed translations
 */
export type Language = 'en' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'nl' | 'pl';

/**
 * Complete Feed Content - from Factory
 * All fields that Factory can produce
 */
export interface FeedContent {
  // Text content
  headline: string;
  body: string;
  summary: string;
  
  // Visual content
  images: {
    main?: string;
    secondary?: string;
    gallery?: string[];
  };
  
  // Metadata & tags
  tags: string[];
  metadata: {
    artist?: string;
    featured_artists?: string[];
    producer?: string;
    genre?: string;
    region?: string;
    type?: string;
    template_type?: string;
    cluster_id?: string;
    translated_language?: Language;
  };
  
  // Links & platforms
  links: {
    youtube?: string;
    spotify?: string;
    apple_music?: string;
    genius?: string;
    tiktok?: string;
    instagram?: string;
    other?: string[];
  };
  
  // Quality metrics
  quality?: {
    image_quality?: number;
    completeness?: number;
    confidence?: number;
  };
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

/**
 * Feed Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  score: number;  // 0-100
  completeness: number;  // % of fields filled
  issues: ValidationIssue[];
  warnings: string[];
}

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  severity: number;  // 0-10
}

/**
 * Validate FeedContent
 * Checks completeness, required fields, quality
 */
export function validateFeedContent(content: FeedContent): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  
  let filledFields = 0;
  let totalFields = 0;

  // Check required fields
  if (!content.headline || content.headline.trim().length === 0) {
    issues.push({
      level: 'error',
      field: 'headline',
      message: 'Headline is required and cannot be empty',
      severity: 10
    });
  } else {
    filledFields++;
  }
  totalFields++;

  if (!content.body || content.body.trim().length === 0) {
    issues.push({
      level: 'error',
      field: 'body',
      message: 'Body content is required',
      severity: 10
    });
  } else {
    filledFields++;
  }
  totalFields++;

  // Check images (important but not mandatory)
  if (!content.images?.main) {
    warnings.push('No main image provided');
    issues.push({
      level: 'warning',
      field: 'images.main',
      message: 'Main image recommended',
      severity: 7
    });
  } else {
    filledFields++;
  }
  totalFields++;

  // Check metadata
  if (!content.metadata?.artist) {
    warnings.push('Artist metadata missing');
  } else {
    filledFields++;
  }
  totalFields++;

  // Check links (optional but valuable)
  const linkCount = Object.values(content.links || {}).filter(
    (v) => v && (typeof v === 'string' || (Array.isArray(v) && v.length > 0))
  ).length;

  if (linkCount === 0) {
    warnings.push('No platform links provided');
    issues.push({
      level: 'info',
      field: 'links',
      message: 'Consider adding platform links',
      severity: 3
    });
  } else {
    filledFields += Math.min(linkCount, 3);  // Cap contribution
  }
  totalFields += 3;

  // Check tags
  if (!content.tags || content.tags.length === 0) {
    issues.push({
      level: 'warning',
      field: 'tags',
      message: 'No tags provided',
      severity: 5
    });
  } else {
    filledFields++;
  }
  totalFields++;

  // Calculate completeness
  const completeness = Math.round((filledFields / totalFields) * 100);

  // Calculate score (0-100)
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;
  
  let score = 100;
  score -= errorCount * 20;  // Each error: -20
  score -= warningCount * 5;  // Each warning: -5
  score = Math.max(0, Math.min(100, score));

  return {
    valid: errorCount === 0 && completeness >= 70,
    score,
    completeness,
    issues,
    warnings
  };
}

/**
 * Check if FeedContent is ready for distribution
 */
export function isReadyForDistribution(content: FeedContent): boolean {
  const validation = validateFeedContent(content);
  return validation.valid && validation.completeness >= 70;
}

/**
 * Get validation summary
 */
export function getValidationSummary(result: ValidationResult): string {
  const errorCount = result.issues.filter((i) => i.level === 'error').length;
  const warningCount = result.issues.filter((i) => i.level === 'warning').length;

  return `Score: ${result.score}/100 | Completeness: ${result.completeness}% | Errors: ${errorCount} | Warnings: ${warningCount}`;
}

/**
 * Localized Feed Variant (per language)
 */
export interface LocalizedFeedVariant {
  language: Language;
  content: FeedContent;
  validation: ValidationResult;
  translated_at: string;
}

/**
 * Distribution Status
 */
export interface DistributionStatus {
  language: Language;
  hdua_post_id?: string;
  status: 'pending' | 'success' | 'failed';
  posted_at?: string;
  message: string;
}
