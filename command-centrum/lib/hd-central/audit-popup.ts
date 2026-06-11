import type { MissionAuditReport } from '@/lib/hd-central/types'

export function buildAuditPopupText(report: MissionAuditReport): string {
  return [
    `missionId: ${report.missionId}`,
    `runId: ${report.runId}`,
    `stepIndex: ${report.stepIndex}`,
    ...(typeof report.totalSteps === 'number' ? [`totalSteps: ${report.totalSteps}`] : []),
    `verdict: ${report.verdict}`,
    `timestamp: ${report.timestamp}`,
    `summary: ${report.summary}`,
  ].join('\n')
}

export function closeAuditPopup(): null {
  return null
}
