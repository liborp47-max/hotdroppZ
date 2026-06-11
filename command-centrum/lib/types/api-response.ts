/**
 * Standardní API Response Format pro všechny HDCC endpoints
 * Zajišťuje konzistenci a usnadňuje frontend zpracování
 */

export type ApiResponseMeta = {
  timestamp: string
  version: string
  endpoint: string
}

export type ApiResponse<T = any> = {
  success: boolean
  data: T | null
  error: string | null
  meta: ApiResponseMeta
}

export type DegradedStagePayload = {
  stage: string
  not_implemented: boolean
  stage_status: 'degraded'
  reason: string
  trigger_blocked: boolean
}

export type PipelineRunResponse<T = unknown> = {
  stage: string
  correlation_id: string
  result: T
  legacy_payload: T
  transition: {
    contract: 'run_v2'
    legacy_data_path: 'data.legacy_payload'
    note: string
  }
}

/**
 * Helper pro vytvoření úspěšné response
 */
export function apiSuccess<T>(
  data: T,
  endpoint: string,
  version: string = '1.0'
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      version,
      endpoint,
    },
  }
}

/**
 * Helper pro vytvoření chybové response
 */
export function apiError(
  error: string | Error,
  endpoint: string,
  version: string = '1.0'
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: error instanceof Error ? error.message : error,
    meta: {
      timestamp: new Date().toISOString(),
      version,
      endpoint,
    },
  }
}

/**
 * Standard HTTP response helper
 */
export function apiResponseJson<T>(response: ApiResponse<T>, status: number = 200) {
  return Response.json(response, { status })
}

/**
 * Success wrapper
 */
export function successResponse<T>(data: T, endpoint: string) {
  return apiResponseJson(apiSuccess(data, endpoint), 200)
}

/**
 * Error wrapper
 */
export function errorResponse(error: string | Error, endpoint: string, status: number = 500) {
  return apiResponseJson(apiError(error, endpoint), status)
}

/**
 * Degraded wrapper pro stage, ktere jsou zamerne short-circuited
 */
export function degradedResponse(
  payload: DegradedStagePayload,
  endpoint: string,
  status: number = 503
) {
  return apiResponseJson(
    {
      success: false,
      data: payload,
      error: payload.reason,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        endpoint,
      },
    },
    status
  )
}

export function pipelineRunSuccessResponse<T>(
  endpoint: string,
  stage: string,
  correlationId: string,
  result: T
) {
  const payload: PipelineRunResponse<T> = {
    stage,
    correlation_id: correlationId,
    result,
    legacy_payload: result,
    transition: {
      contract: 'run_v2',
      legacy_data_path: 'data.legacy_payload',
      note: 'Pouzijte jednotny kontrakt success/data/error/meta; legacy payload je docasne v data.legacy_payload.',
    },
  }

  return successResponse(payload, endpoint)
}

export function pipelineRunErrorResponse(
  endpoint: string,
  stage: string,
  correlationId: string,
  error: string | Error,
  status: number = 500
) {
  const message = error instanceof Error ? error.message : error
  return apiResponseJson(
    {
      success: false,
      data: {
        stage,
        correlation_id: correlationId,
        result: 'failed',
        legacy_payload: { error: message },
        transition: {
          contract: 'run_v2',
          legacy_data_path: 'data.legacy_payload',
          note: 'Legacy error shape je dostupny v data.legacy_payload.error.',
        },
      },
      error: message,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        endpoint,
      },
    },
    status
  )
}

/**
 * Retired stage response — consistent 410 Gone with metadata
 */
export function retiredStageResponse(
  stage: string,
  reason: string,
  endpoint: string,
  retiredAt?: string
) {
  return apiResponseJson(
    {
      success: false,
      data: {
        stage,
        status: 'retired',
        reason,
        retired_at: retiredAt,
      },
      error: `Stage "${stage}" is retired`,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        endpoint,
      },
    },
    410 // HTTP Gone
  )
}

// Type for common Scout/Filter/Curator/Cluster response
export type PipelineStepResponse = {
  stepName: string
  status: 'running' | 'completed' | 'failed'
  itemsProcessed: number
  itemsFiltered?: number
  itemsEmitted: number
  durationMs?: number
  errors?: string[]
  nextStep?: string
}

// Type for common Scout items
export type ScoutItem = {
  id: string
  title: string
  source: string
  url: string
  category: string
  content: string
  contentTruncated?: string
  attentionScore: number
  createdAt: string
  status: 'raw' | 'scouted' | 'filtered' | 'curated' | 'clustered'
}

// Type for common Cluster
export type ClusterData = {
  id: string
  mainEntity: string
  title: string
  category: string
  itemCount: number
  totalRelationships: number
  enrichmentStatus: 'pending' | 'in_progress' | 'completed'
}
