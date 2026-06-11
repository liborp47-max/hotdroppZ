import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runFactoryV2 } from '@/lib/pipeline/factory-coordinator-v2'

/**
 * POST /api/factory/coordinate
 *
 * Entry point for Factory orchestration
 * Analyzes content type and runs appropriate module sequence
 *
 * Request body:
 * {
 *   "clusterId": "uuid",           // Single cluster
 *   "clusterIds": ["uuid", ...],   // Multiple clusters
 *   "contentTypeHint": "music_release|artist_news|cultural|visual_first",
 *   "skipEnrichment": false,
 *   "skipCreator": false
 * }
 *
 * Response:
 * {
 *   "id": "factory-xxxxx",
 *   "contentType": "music_release",
 *   "moduleSequence": ["enrichment", "writer", "creator"],
 *   "steps": [
 *     {
 *       "step": "analyze",
 *       "status": "success",
 *       "message": "Content analysis...",
 *       "itemCount": 1
 *     },
 *     ...
 *   ],
 *   "summary": {
 *     "articlesGenerated": 2,
 *     "clustersEnriched": 5,
 *     "graphicsCreated": 3
 *   },
 *   "outputUrls": {
 *     "articles": "/api/writer/articles",
 *     "graphics": "/api/creator/posts",
 *     "enrichedData": "/api/enrichment/data"
 *   },
 *   "completedAt": "2026-05-12T...",
 *   "totalProcessingMs": 2843
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

    const {
      clusterId,
      clusterIds,
      skipEnrichment = false,
      skipCreator = false,
    } = body

    const result = await runFactoryV2({
      clusterId,
      clusterIds,
      skipEnrichment,
      skipCreator,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[factory-coordinator] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Factory coordination failed',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/factory/coordinate
 * Returns Factory status/documentation
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Factory Coordinator - Orchestrates Writer + Enrichment + Creator',
    modules: [
      {
        name: 'enrichment',
        description: 'Adds Spotify, YouTube, Genius, Apple Music links to clusters',
        applicable_to: ['music_release', 'artist_news'],
      },
      {
        name: 'writer',
        description: 'Generates high-quality articles from cluster data',
        applicable_to: ['all'],
      },
      {
        name: 'creator',
        description: 'Generates graphics, thumbnails, social media visuals',
        applicable_to: ['all'],
      },
    ],
    contentTypes: [
      {
        type: 'music_release',
        sequence: ['enrichment', 'writer', 'creator'],
        description: 'Music releases: enriched links + article + graphics',
      },
      {
        type: 'artist_news',
        sequence: ['writer', 'enrichment', 'creator'],
        description: 'Artist news: article + context links + graphics',
      },
      {
        type: 'cultural',
        sequence: ['writer', 'creator'],
        description: 'Cultural/fun content: article + graphics (no enrichment)',
      },
      {
        type: 'visual_first',
        sequence: ['creator', 'writer'],
        description: 'Visual-focused: graphics first, then caption/article',
      },
    ],
    example: {
      method: 'POST',
      url: '/api/factory/coordinate',
      body: {
        clusterId: '550e8400-e29b-41d4-a716-446655440000',
        contentTypeHint: 'music_release',
        skipEnrichment: false,
        skipCreator: false,
      },
    },
  })
}
