import { randomUUID } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { runWriterPipeline } from '@/lib/pipeline/writer'
import { buildDegradedStagePayload, isStageResultDegraded } from '@/lib/pipeline/stage-degraded'
import { logger } from '@/lib/logger'
import {
  degradedResponse,
  errorResponse,
  pipelineRunErrorResponse,
  pipelineRunSuccessResponse,
} from '@/lib/types/api-response'
import { getStageStatus } from '@/lib/config/stage-registry'

export async function POST() {
  const endpoint = '/api/writer/run'
  const stage = 'writer'
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
  if (stageInfo.status === 'retired') {
    const durationMs = Date.now() - startedAt
    logger.warn('pipeline_run_retired', {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'retired',
      reason: stageInfo.reason,
      duration_ms: durationMs,
    })
    // Should not reach here for writer (degraded), but handle if registry changes
    return degradedResponse(
      buildDegradedStagePayload(stage, stageInfo.reason ?? 'Stage is retired', true),
      endpoint,
      503
    )
  }

  const db = createAdminClient() ?? authClient
  const isProduction = process.env.NODE_ENV === 'production'

  try {
    if (isProduction) {
      const durationMs = Date.now() - startedAt
      const degradedPayload = buildDegradedStagePayload(
        'writer',
        'Writer stage trigger is blocked in production until full generation/persistence implementation.',
        true
      )

      logger.warn('pipeline_run_degraded', {
        endpoint,
        stage,
        correlation_id: correlationId,
        result: 'degraded',
        duration_ms: durationMs,
      })

      return degradedResponse(degradedPayload, endpoint, 503)
    }

    const result = await runWriterPipeline(db)

    if (isStageResultDegraded(result)) {
      const durationMs = Date.now() - startedAt
      const degradedPayload = buildDegradedStagePayload(
        'writer',
        result.reason ?? 'Writer stage is degraded and not fully implemented.',
        false
      )

      logger.warn('pipeline_run_degraded', {
        endpoint,
        stage,
        correlation_id: correlationId,
        result: 'degraded',
        duration_ms: durationMs,
      })

      return degradedResponse(degradedPayload, endpoint, 503)
    }

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
    const message = error instanceof Error ? error.message : 'Writer run failed'

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
