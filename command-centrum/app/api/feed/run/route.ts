import { randomUUID } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { runFeedEnginePipeline } from '@/lib/pipeline/feed-engine'
import { runFeedBuilderPipeline } from '@/lib/pipeline/feed-builder'
import {
  errorResponse,
  degradedResponse,
  pipelineRunErrorResponse,
  pipelineRunSuccessResponse,
} from '@/lib/types/api-response'
import { getStageStatus } from '@/lib/config/stage-registry'

export async function POST() {
  const endpoint = '/api/feed/run'
  const stage = 'feed'
  const correlationId = randomUUID()
  const startedAt = Date.now()

  logger.info('pipeline_run_start', {
    endpoint,
    stage,
    correlation_id: correlationId,
    result: 'started',
    duration_ms: 0,
  })

  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    const durationMs = Date.now() - startedAt
    logger.warn('pipeline_run_unauthorized', {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'unauthorized',
      duration_ms: durationMs,
    })
    return errorResponse('Unauthorized', endpoint, 401)
  }

  // Check stage registry status
  const stageInfo = getStageStatus(stage)
  if (stageInfo.status === 'degraded') {
    const durationMs = Date.now() - startedAt
    logger.warn('pipeline_run_degraded', {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'degraded',
      reason: stageInfo.reason,
      duration_ms: durationMs,
    })
    return degradedResponse(
      {
        stage,
        not_implemented: stageInfo.notes?.includes('not_implemented') ?? false,
        stage_status: 'degraded',
        reason: stageInfo.reason ?? 'Stage is degraded',
        trigger_blocked: true,
      },
      endpoint,
      503
    )
  }

  const db = createAdminClient() ?? authClient

  try {
    // Build feed cards from enriched clusters first, then process them.
    const built = await runFeedBuilderPipeline(db)
    const engine = await runFeedEnginePipeline(db)
    const result = { cardsBuilt: built.created, ...engine }
    const durationMs = Date.now() - startedAt

    logger.info('pipeline_run_success', {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'success',
      duration_ms: durationMs,
    })

    return pipelineRunSuccessResponse(endpoint, stage, correlationId, result)
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : 'Feed engine run failed'

    logger.error('pipeline_run_error', error as Error, {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'error',
      duration_ms: durationMs,
    })

    return pipelineRunErrorResponse(endpoint, stage, correlationId, message, 500)
  }
}
