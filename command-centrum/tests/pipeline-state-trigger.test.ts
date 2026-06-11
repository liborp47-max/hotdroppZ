import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  appendHistoryEntry,
  readHistoryTail,
  parseHistoryLine,
} from '../lib/hd-central/history-log.ts'
import { getActiveRuns } from '../lib/hd-central/active-runs.ts'

// Use a temp root so we don't write into real SYSTEM/INFO state.
let TMP_ROOT: string

before(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-trigger-test-'))
})

after(() => {
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

test('appendHistoryEntry writes TSV with meta and creates parent dir', () => {
  const dir = path.join(TMP_ROOT, 'PIPELINE_STAGES', 'scout')
  const ok = appendHistoryEntry(dir, 'pipeline-stage', 'scout', 'manual_trigger', {
    actor: 'ceo@hotdroppz.com',
    corr: 'abc-correlation-id',
  })
  assert.equal(ok, true)

  const file = path.join(dir, 'history.log')
  assert.ok(fs.existsSync(file), 'history.log should exist')
  const content = fs.readFileSync(file, 'utf-8')
  assert.match(content, /manual_trigger/)
  assert.match(content, /actor=ceo@hotdroppz\.com/)
  assert.match(content, /corr=abc-correlation-id/)
})

test('readHistoryTail returns parsed rows in order', () => {
  const dir = path.join(TMP_ROOT, 'PIPELINE_STAGES', 'curator')
  appendHistoryEntry(dir, 'pipeline-stage', 'curator', 'sync', {})
  appendHistoryEntry(dir, 'pipeline-stage', 'curator', 'manual_trigger', { corr: 'x1' })
  appendHistoryEntry(dir, 'pipeline-stage', 'curator', 'run_complete', { corr: 'x1' })

  const rows = readHistoryTail(path.join(dir, 'history.log'), 50)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].event, 'sync')
  assert.equal(rows[1].event, 'manual_trigger')
  assert.equal(rows[2].event, 'run_complete')
  assert.equal(rows[1].meta.corr, 'x1')
})

test('readHistoryTail returns empty array when file missing', () => {
  const rows = readHistoryTail(path.join(TMP_ROOT, 'never-existed', 'history.log'), 50)
  assert.deepEqual(rows, [])
})

test('getActiveRuns reports recent triggers without terminal entry', () => {
  // Fresh stage with one in-flight trigger.
  const dir = path.join(TMP_ROOT, 'PIPELINE_STAGES', 'filter')
  fs.mkdirSync(dir, { recursive: true })
  const now = new Date().toISOString()
  const line = `${now}\tpipeline-stage\tfilter\tmanual_trigger\tcorr=live-1\n`
  fs.writeFileSync(path.join(dir, 'history.log'), line, 'utf-8')

  const runs = getActiveRuns(TMP_ROOT)
  const filterRun = runs.find((r) => r.stage === 'filter')
  assert.ok(filterRun, 'should report filter as active')
  assert.equal(filterRun!.runId, 'live-1')
})

test('getActiveRuns ignores runs with matching run_complete', () => {
  const dir = path.join(TMP_ROOT, 'PIPELINE_STAGES', 'cluster')
  fs.mkdirSync(dir, { recursive: true })
  const now = new Date().toISOString()
  const lines =
    `${now}\tpipeline-stage\tcluster\tmanual_trigger\tcorr=done-1\n` +
    `${now}\tpipeline-stage\tcluster\trun_complete\tcorr=done-1\n`
  fs.writeFileSync(path.join(dir, 'history.log'), lines, 'utf-8')

  const runs = getActiveRuns(TMP_ROOT)
  const clusterRun = runs.find((r) => r.stage === 'cluster')
  assert.equal(clusterRun, undefined, 'completed runs must not appear in active list')
})

test('getActiveRuns ignores triggers older than 60s', () => {
  // Use an active stage ('scout'); 'monetizer' is a retired stage that
  // getActiveRuns no longer scans, which would make this assertion vacuous.
  const dir = path.join(TMP_ROOT, 'PIPELINE_STAGES', 'scout')
  fs.mkdirSync(dir, { recursive: true })
  const oldTs = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const line = `${oldTs}\tpipeline-stage\tscout\tmanual_trigger\tcorr=stale-1\n`
  fs.writeFileSync(path.join(dir, 'history.log'), line, 'utf-8')

  const runs = getActiveRuns(TMP_ROOT)
  const staleRun = runs.find((r) => r.stage === 'scout')
  assert.equal(staleRun, undefined, 'stale triggers must not appear')
})

test('parseHistoryLine handles values with = signs (e.g. URL meta)', () => {
  const row = parseHistoryLine(
    '2026-05-18T10:00:00.000Z\tpipeline-stage\tscout\tnote\turl=https://x.com/?a=1'
  )
  assert.ok(row)
  assert.equal(row!.meta.url, 'https://x.com/?a=1')
})
