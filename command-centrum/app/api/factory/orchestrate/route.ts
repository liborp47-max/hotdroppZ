import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runFactoryV2 } from '@/lib/pipeline/factory-coordinator-v2'

/**
 * POST /api/factory/orchestrate
 *
 * Symbiotic Factory orchestration
 * Template-driven, integrates all modules (Enricher, Writer, Creator)
 *
 * Request:
 * {
 *   "clusterId": "uuid",
 *   "skipEnrichment": false,
 *   "skipCreator": false
 * }
 *
 * Response:
 * {
 *   "id": "factory-v2-xxxxx",
 *   "clusterId": "uuid",
 *   "templateType": "video_drop",
 *   "templateId": "video_drop_v1",
 *   "status": "success|partial|error",
 *   "stages": {
 *     "analysis": {...},
 *     "enrichment": {...},
 *     "writer": {...},
 *     "creator": {...},
 *     "binding": {...}
 *   },
 *   "instance": TemplateInstance,
 *   "feedContent": {...},
 *   "totalProcessingMs": 5847
 * }
 */
export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { clusterId, skipEnrichment = false, skipCreator = false } = body

    if (!clusterId) {
      return NextResponse.json(
        { error: 'clusterId is required' },
        { status: 400 }
      )
    }

    const result = await runFactoryV2({
      clusterId,
      skipEnrichment,
      skipCreator,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[factory-orchestrate] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Orchestration failed',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/factory/orchestrate
 * Returns documentation
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: 'Factory V2 - Symbiotic Orchestrator',
    description:
      'Template-driven orchestration integrating Enricher, Writer, Creator',
    version: '2.0',
    features: [
      'Smart template selection',
      'Pre-filled template instances',
      'Field-based module routing',
      'Symbiotic data flow',
      'Progressive field filling',
      'Complete validation',
    ],
    templates: [
      {
        id: 'video_drop_v1',
        name: 'Video Drop',
        type: 'video_drop',
        description: 'For official videos, music videos, visual releases',
        priority: 100,
        fields: 10,
      },
      {
        id: 'single_drop_v1',
        name: 'Single Drop',
        type: 'single_drop',
        description: 'For single track releases',
        priority: 90,
        fields: 11,
      },
      {
        id: 'album_drop_v1',
        name: 'Album Drop',
        type: 'album_drop',
        description: 'For album/EP releases',
        priority: 95,
        fields: 13,
      },
      {
        id: 'global_news_v1',
        name: 'Global News',
        type: 'global_news',
        description: 'For industry news, events, interviews',
        priority: 80,
        fields: 9,
      },
    ],
    workflow: [
      'Fetch cluster data from DB',
      'Detect content type (rule-based)',
      'Select best template (by score)',
      'Create template instance (pre-filled)',
      'Run Enricher (collects links/data)',
      'Run Writer (generates narrative)',
      'Run Creator (generates images)',
      'Bind all fields to instance',
      'Validate completeness',
      'Export to feed format',
    ],
    example: {
      method: 'POST',
      url: '/api/factory/orchestrate',
      body: {
        clusterId: '550e8400-e29b-41d4-a716-446655440000',
        skipEnrichment: false,
        skipCreator: false,
      },
      response: {
        id: 'factory-v2-1715512335-abc123',
        status: 'success',
        templateType: 'video_drop',
        stages: {
          analysis: { status: 'success', completeness: 100 },
          enrichment: { status: 'success', fieldsRecovered: 3 },
          writer: { status: 'success', fieldsFilled: 4 },
          creator: { status: 'success', fieldsFilled: 2 },
          binding: { status: 'complete', completeness: 100 },
        },
        totalProcessingMs: 5847,
      },
    },
  })
}
