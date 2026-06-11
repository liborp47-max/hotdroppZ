/**
 * POST /api/feed/distribute
 * 
 * Feed Pipeline:
 * 1. Validator: Validate FeedContent from Factory
 * 2. Translator: Translate to all languages
 * Output: LocalizedFeedVariants → ready for Distributor
 * 
 * Request:
 * {
 *   "feedContent": {...},  // From Factory exportToFeedPost()
 *   "userId": "uuid",
 *   "languages": ["en", "fr", "de"]  // Optional, defaults to all
 * }
 * 
 * Response:
 * {
 *   "status": "success" | "partial_success" | "failed",
 *   "validation": { score, completeness, valid, issues },
 *   "translation": { languages, total, variants },
 *   "next": { step: "distributor", endpoint: "/api/distributor/dispatch" }
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { validateWithConfig, getValidationReport } from '@/lib/pipeline/feed/legacy-validator';
import { translateFeedContent, SUPPORTED_LANGUAGES, type Language, type FeedContent } from '@/lib/pipeline/feed/legacy-translator';

export const runtime = 'nodejs';

interface FeedDistributeRequest {
  feedContent: FeedContent;
  userId: string;
  languages?: Language[];
  validationConfig?: any;
}

export async function POST(request: Request) {
  try {
    const db = await createClient();
    const body = (await request.json()) as FeedDistributeRequest;

    const { feedContent, userId, languages: targetLangs, validationConfig } = body;

    // Validate user
    const { data: user } = await db.auth.getUser();
    if (!user?.user || user.user.id !== userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 1: Validate (Feed Validator module)
    console.log(`[Feed] Validating content...`);
    const validation = validateWithConfig(feedContent, validationConfig);

    // If validation fails critically, reject
    if (!validation.valid && validation.completeness < 50) {
      return Response.json(
        {
          status: 'failed',
          error: 'Validation failed - completeness too low',
          validation,
          report: getValidationReport(validation)
        },
        { status: 400 }
      );
    }

    // Step 2: Translate (Feed Translator module)
    const langs = targetLangs && targetLangs.length > 0 
      ? targetLangs 
      : SUPPORTED_LANGUAGES;

    console.log(`[Feed] Translating to ${langs.length} language(s)...`);
    const translationResult = await translateFeedContent(feedContent, langs);

    return Response.json({
      status: 'success',
      validation: {
        score: validation.score,
        completeness: validation.completeness,
        valid: validation.valid,
        issueCount: validation.issues.length,
        issues: validation.issues.slice(0, 5)  // First 5 issues
      },
      translation: {
        languages: translationResult.variants.map((v) => v.language),
        total: translationResult.totalLanguages,
        variants: translationResult.variants.length
      },
      data: {
        variants: translationResult.variants  // Pass to Distributor
      },
      next: {
        step: 'distributor',
        endpoint: '/api/distributor/dispatch',
        note: 'Distributor will handle user preferences, rules, and scheduling'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Feed] Error:', error);
    return Response.json(
      { error: 'Feed pipeline failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    message: 'Feed Pipeline API',
    pipeline: 'Factory → Feed: [Validator + Translator] → Distributor',
    status: 'Feed processes and translates content',
    modules: {
      validator: 'Validates completeness, quality, required fields',
      translator: 'Translates content to all languages'
    },
    output: 'LocalizedFeedVariants (all languages)',
    next: 'Distributor will handle delivery rules',
    endpoints: {
      POST: {
        path: '/api/feed/distribute',
        description: 'Run Feed pipeline (Validator + Translator)',
        request: {
          feedContent: 'FeedContent from Factory (all data)',
          userId: 'User ID',
          languages: '(optional) Target languages',
          validationConfig: '(optional) Custom validation rules'
        }
      }
    }
  });
}


