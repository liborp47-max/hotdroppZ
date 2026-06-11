import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { errorResponse, retiredStageResponse } from '@/lib/types/api-response'
import { getStageStatus } from '@/lib/config/stage-registry'

export async function POST() {
  const endpoint = '/api/final-check/run'
  const stage = 'final-check'
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
    error,
  } = await authClient.auth.getUser()

  if (error || !user) {
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

  // Check stage registry status FIRST
  const stageInfo = getStageStatus(stage)
  const durationMs = Date.now() - startedAt

  if (stageInfo.status === 'retired') {
    logger.warn('pipeline_run_retired', {
      endpoint,
      stage,
      correlation_id: correlationId,
      result: 'retired',
      reason: stageInfo.reason,
      retired_at: stageInfo.retired_at,
      duration_ms: durationMs,
    })
    return retiredStageResponse(stage, stageInfo.reason ?? 'Stage retired', endpoint, stageInfo.retired_at)
  }

  // Should not reach here for retired stage, but fallback
  return retiredStageResponse(stage, 'Final check pipeline is retired.', endpoint)
}
