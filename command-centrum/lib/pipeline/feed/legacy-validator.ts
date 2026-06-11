/**
 * LEGACY Feed Validator (pre UM-FEED_ENGINE, 2026-05-12).
 *
 * Operates on the abstract FeedContent shape produced by the "Factory" flow.
 * Consumed by /api/feed/distribute. New mission code (DB-row based) lives in
 * validator.ts — see schema-feed-engine.sql and run-20260527-um-feed-engine.
 *
 * Validates:
 * - Required fields present
 * - Content quality
 * - Image quality
 * - Metadata completeness
 * - Link integrity
 */

import { validateFeedContent, isReadyForDistribution, type FeedContent, type ValidationResult } from './legacy-structure';

export interface ValidatorConfig {
  minHeadlineLength: number;
  minBodyLength: number;
  minImageQuality: number;
  minCompleteness: number;
  requireImages: boolean;
  requireLinks: number;
}

export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  minHeadlineLength: 10,
  minBodyLength: 50,
  minImageQuality: 60,
  minCompleteness: 70,
  requireImages: false,
  requireLinks: 0
};

/**
 * Validate FeedContent with custom config
 */
export function validateWithConfig(
  content: FeedContent,
  config: Partial<ValidatorConfig> = {}
): ValidationResult {
  const finalConfig = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
  const baseValidation = validateFeedContent(content);

  // Additional validations
  const customIssues = [];

  // Check headline length
  if (content.headline && content.headline.length < finalConfig.minHeadlineLength) {
    customIssues.push({
      level: 'warning' as const,
      field: 'headline',
      message: `Headline too short (${content.headline.length}/${finalConfig.minHeadlineLength} chars)`,
      severity: 4
    });
  }

  // Check body length
  if (content.body && content.body.length < finalConfig.minBodyLength) {
    customIssues.push({
      level: 'warning' as const,
      field: 'body',
      message: `Body too short (${content.body.length}/${finalConfig.minBodyLength} chars)`,
      severity: 4
    });
  }

  // Check image quality
  if (content.quality?.image_quality && content.quality.image_quality < finalConfig.minImageQuality) {
    customIssues.push({
      level: 'warning' as const,
      field: 'images',
      message: `Image quality low (${content.quality.image_quality}/${finalConfig.minImageQuality})`,
      severity: 5
    });
  }

  // Check required images
  if (finalConfig.requireImages && !content.images?.main) {
    customIssues.push({
      level: 'error' as const,
      field: 'images',
      message: 'Images are required',
      severity: 10
    });
  }

  // Check required links count
  if (finalConfig.requireLinks > 0) {
    const linkCount = Object.values(content.links || {}).filter(
      (v) => v && (typeof v === 'string' || (Array.isArray(v) && v.length > 0))
    ).length;

    if (linkCount < finalConfig.requireLinks) {
      customIssues.push({
        level: 'error' as const,
        field: 'links',
        message: `Need at least ${finalConfig.requireLinks} links, got ${linkCount}`,
        severity: 8
      });
    }
  }

  // Merge validations
  const allIssues = [...baseValidation.issues, ...customIssues];
  const errorCount = allIssues.filter((i) => i.level === 'error').length;

  return {
    ...baseValidation,
    issues: allIssues,
    valid: errorCount === 0 && baseValidation.completeness >= finalConfig.minCompleteness,
    score: Math.max(0, baseValidation.score - customIssues.length * 3)
  };
}

/**
 * Validate multiple FeedContents
 */
export function validateBatch(
  contents: FeedContent[],
  config?: Partial<ValidatorConfig>
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  contents.forEach((content, index) => {
    const key = content.metadata?.cluster_id || `content-${index}`;
    results.set(key, validateWithConfig(content, config));
  });

  return results;
}

/**
 * Get validation report
 */
export function getValidationReport(result: ValidationResult): string {
  const lines = [
    `Validation Report`,
    `================`,
    `Status: ${result.valid ? '✓ VALID' : '✗ INVALID'}`,
    `Score: ${result.score}/100`,
    `Completeness: ${result.completeness}%`,
    ``
  ];

  if (result.issues.length > 0) {
    lines.push(`Issues (${result.issues.length}):`);
    result.issues.forEach((issue) => {
      const icon = issue.level === 'error' ? '✗' : issue.level === 'warning' ? '⚠' : 'ℹ';
      lines.push(`  ${icon} ${issue.field}: ${issue.message}`);
    });
    lines.push(``);
  }

  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => lines.push(`  • ${w}`));
  }

  return lines.join('\n');
}
