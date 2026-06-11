/**
 * POST /api/distributor/dispatch
 * 
 * Distributor Pipeline (next step after Feed):
 * 1. Receive LocalizedFeedVariants from Feed
 * 2. Apply rules (future: scheduling, user preferences, content rules)
 * 3. Send to HDUA
 * 
 * Future features:
 * - User preference filtering (which languages to show)
 * - Scheduling (when to publish)
 * - Content rules (boost, bury, priority)
 * - A/B testing variants
 * - Rate limiting per user
 */

import { createClient } from '@/lib/supabase/server';
import { distributeVariantsToHdua } from '@/lib/pipeline/distributor';
import type { LocalizedFeedVariant } from '@/lib/pipeline/feed/legacy-translator';

export const runtime = 'nodejs';

interface DistributorDispatchRequest {
  variants: LocalizedFeedVariant[];
  userId: string;
  rules?: {
    languages?: string[];
    schedule?: string;
    priority?: number;
    boost?: boolean;
  };
}

export async function POST(request: Request) {
  try {
    const db = await createClient();
    const body = (await request.json()) as DistributorDispatchRequest;

    const { variants, userId, rules } = body;

    // Validate user
    const { data: user } = await db.auth.getUser();
    if (!user?.user || user.user.id !== userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Future: Apply distribution rules
    // - Language filtering based on user preferences
    // - Scheduling (publish now, or schedule for later)
    // - Content rules (priority, boost flags)
    // - Rate limiting

    console.log(`[Distributor] Dispatching ${variants.length} variants for user ${userId}...`);

    // For now: send all variants to HDUA
    const results = await distributeVariantsToHdua(variants, userId);

    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return Response.json({
      status: successful > 0 ? (failed > 0 ? 'partial_success' : 'success') : 'failed',
      dispatch: {
        variants_count: variants.length,
        successful,
        failed,
        results: results.map((r) => ({
          language: r.language,
          status: r.status,
          hdua_post_id: r.hdua_post_id,
          message: r.message
        }))
      },
      timestamp: new Date().toISOString(),
      future_features: {
        note: 'Rules, scheduling, and user preferences coming soon',
        planned: [
          'User language preferences',
          'Content scheduling',
          'Distribution rules (boost, bury, priority)',
          'A/B testing',
          'Rate limiting'
        ]
      }
    });
  } catch (error) {
    console.error('[Distributor] Error:', error);
    return Response.json(
      { error: 'Distributor dispatch failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    message: 'Distributor Dispatch API',
    pipeline: 'Feed → Distributor → HDUA',
    status: 'Distributor decides what and when users see content',
    input: 'LocalizedFeedVariants (from Feed)',
    current_behavior: 'Sends all variants to HDUA',
    future_features: {
      rules: 'Apply content distribution rules',
      scheduling: 'Delay or schedule publication',
      user_preferences: 'Respect user language/content preferences',
      ab_testing: 'A/B test different variants',
      rate_limiting: 'Throttle publications per user'
    },
    endpoints: {
      POST: {
        path: '/api/distributor/dispatch',
        description: 'Dispatch feed variants to HDUA with rules',
        request: {
          variants: 'LocalizedFeedVariant[] from Feed',
          userId: 'User ID',
          rules: '(optional) Distribution rules'
        }
      }
    }
  });
}
