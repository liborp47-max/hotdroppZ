export type StageName = 'scout' | 'writer'

export type StageDegradedPayload = {
  stage: StageName
  not_implemented: true
  stage_status: 'degraded'
  reason: string
  trigger_blocked: boolean
}

export function buildDegradedStagePayload(
  stage: StageName,
  reason: string,
  triggerBlocked: boolean
): StageDegradedPayload {
  return {
    stage,
    not_implemented: true,
    stage_status: 'degraded',
    reason,
    trigger_blocked: triggerBlocked,
  }
}

export function isStageResultDegraded(result: {
  notImplemented?: boolean
  stageStatus?: string
}): boolean {
  return result.notImplemented === true || result.stageStatus === 'degraded'
}
