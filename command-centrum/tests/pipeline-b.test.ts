import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PIPELINE_B_STAGES,
  summarizePipelineB,
  buildPipelineAlert,
  type StageOutcome,
  type PipelineBSummary,
} from '../lib/pipeline/pipeline-b-summary.ts'
import { formatOpsAlert, alertEmoji } from '../lib/alerts/ops-alert.ts'

const ok = (stage: StageOutcome['stage'], result = { processed: 3 }): StageOutcome => ({
  stage,
  status: 'ok',
  durationMs: 10,
  result,
})
const err = (stage: StageOutcome['stage'], error = 'boom'): StageOutcome => ({
  stage,
  status: 'error',
  durationMs: 5,
  error,
})
const skip = (stage: StageOutcome['stage'], reason = 'stage degraded'): StageOutcome => ({
  stage,
  status: 'skipped',
  durationMs: 0,
  reason,
})

test('PIPELINE_B_STAGES is the fixed post-scout chain in order', () => {
  assert.deepEqual([...PIPELINE_B_STAGES], ['curator', 'enrichment', 'writer', 'publish', 'feed'])
})

test('summarizePipelineB: all-ok run is ok with no failed/skipped', () => {
  const s = summarizePipelineB(
    'run-1',
    'cron',
    1000,
    1250,
    [ok('curator'), ok('enrichment'), ok('writer'), ok('feed')],
  )
  assert.equal(s.ok, true)
  assert.equal(s.durationMs, 250)
  assert.deepEqual(s.failedStages, [])
  assert.deepEqual(s.skippedStages, [])
  assert.equal(s.startedAt, new Date(1000).toISOString())
  assert.equal(s.finishedAt, new Date(1250).toISOString())
})

test('summarizePipelineB: any error flips ok=false and lists failed stages', () => {
  const s = summarizePipelineB(
    'run-2',
    'cron',
    0,
    100,
    [ok('curator'), err('enrichment'), skip('writer'), ok('feed')],
  )
  assert.equal(s.ok, false)
  assert.deepEqual(s.failedStages, ['enrichment'])
  assert.deepEqual(s.skippedStages, ['writer'])
})

test('summarizePipelineB: skip alone does NOT fail the run', () => {
  const s = summarizePipelineB('run-3', 'manual', 0, 1, [ok('curator'), skip('writer')])
  assert.equal(s.ok, true)
  assert.deepEqual(s.failedStages, [])
})

test('buildPipelineAlert: returns null for a healthy run', () => {
  const s: PipelineBSummary = summarizePipelineB('run-4', 'cron', 0, 1, [ok('curator')])
  assert.equal(buildPipelineAlert(s), null)
})

test('buildPipelineAlert: error run yields an error alert naming the stage', () => {
  const s = summarizePipelineB('run-5', 'cron', 0, 1, [err('writer', 'groq overloaded')])
  const alert = buildPipelineAlert(s)
  assert.ok(alert)
  assert.equal(alert.severity, 'error')
  assert.match(alert.title, /1 stage failed/)
  assert.match(alert.text, /writer: groq overloaded/)
  assert.equal(alert.context?.runId, 'run-5')
  assert.equal(alert.context?.failed, 'writer')
})

test('buildPipelineAlert: pluralizes multiple failures', () => {
  const s = summarizePipelineB('run-6', 'cron', 0, 1, [err('curator'), err('feed')])
  const alert = buildPipelineAlert(s)
  assert.match(alert!.title, /2 stages failed/)
})

test('formatOpsAlert: renders emoji, bold title, body and context line', () => {
  const text = formatOpsAlert({
    title: 'Pipeline B — 1 stage failed',
    severity: 'error',
    text: '• writer: boom',
    context: { runId: 'run-7', failed: 'writer' },
  })
  assert.ok(text.startsWith(alertEmoji('error')))
  assert.match(text, /\*Pipeline B — 1 stage failed\*/)
  assert.match(text, /• writer: boom/)
  assert.match(text, /runId=run-7/)
})
