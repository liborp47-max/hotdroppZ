import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  STAGE_TABLE,
  ALL_STAGE_IDS,
  getStageMeta,
} from '../lib/hd-central/stage-table.ts'
import { nextCronFire } from '../lib/hd-central/cron-next.ts'
import {
  parseHistoryLine,
  toHistoryEntry,
} from '../lib/hd-central/history-log.ts'
import { zeroKpi } from '../lib/hd-central/kpi-hydrator.ts'

test('STAGE_TABLE covers all 11 canonical stages in order', () => {
  assert.equal(STAGE_TABLE.length, 11, 'should have 11 stages')
  for (let i = 0; i < STAGE_TABLE.length; i++) {
    assert.equal(STAGE_TABLE[i].index, i + 1, `stage ${i} index mismatch`)
  }
  const ids = STAGE_TABLE.map((s) => s.id).sort().join(',')
  assert.equal(
    ids,
    'cluster,curator,droppz-detector,enrichment,feed-engine,filter,monetizer,multilang,scout,translator,writer'
  )
})

test('ALL_STAGE_IDS is derived from STAGE_TABLE', () => {
  assert.equal(ALL_STAGE_IDS.length, STAGE_TABLE.length)
})

test('getStageMeta returns meta for known stage and null for unknown', () => {
  assert.ok(getStageMeta('scout'))
  assert.equal(getStageMeta('not-a-stage'), null)
})

test('translator stage has no manualTriggerEndpoint (retired)', () => {
  const translator = STAGE_TABLE.find((s) => s.id === 'translator')
  assert.ok(translator, 'translator missing')
  assert.equal(translator!.manualTriggerEndpoint, null)
  assert.equal(translator!.statusHint, 'retired')
})

test('droppz-detector has no manualTriggerEndpoint (auto-only)', () => {
  const det = STAGE_TABLE.find((s) => s.id === 'droppz-detector')
  assert.ok(det, 'detector missing')
  assert.equal(det!.manualTriggerEndpoint, null)
})

test('feed-engine maps to /api/feed/run not /api/feed-engine/run', () => {
  const feed = STAGE_TABLE.find((s) => s.id === 'feed-engine')
  assert.equal(feed!.manualTriggerEndpoint, '/api/feed/run')
})

test('every non-retired/non-detector stage has a manual trigger endpoint', () => {
  for (const s of STAGE_TABLE) {
    if (s.id === 'translator' || s.id === 'droppz-detector') continue
    assert.match(s.manualTriggerEndpoint ?? '', /^\/api\//, `${s.id} should have /api/* endpoint`)
  }
})

test('zeroKpi returns valid 7-bucket spark', () => {
  const k = zeroKpi()
  assert.equal(k.itemsToday, 0)
  assert.equal(k.spark7d.length, 7)
})

test('nextCronFire returns null for missing schedule', () => {
  assert.equal(nextCronFire(null), null)
  assert.equal(nextCronFire(''), null)
  assert.equal(nextCronFire(undefined), null)
})

test('nextCronFire returns ISO string for valid expression', () => {
  const out = nextCronFire('0 */4 * * *')
  assert.ok(out, 'should return string')
  assert.ok(!Number.isNaN(Date.parse(out!)), 'should parse as date')
})

test('nextCronFire returns null on invalid cron', () => {
  assert.equal(nextCronFire('not a cron'), null)
})

test('parseHistoryLine reads TSV with meta', () => {
  const row = parseHistoryLine(
    '2026-05-18T10:00:00.000Z\tpipeline-stage\tscout\tmanual_trigger\tactor=admin@x.com\tcorr=abc-123'
  )
  assert.ok(row)
  assert.equal(row!.event, 'manual_trigger')
  assert.equal(row!.meta.actor, 'admin@x.com')
  assert.equal(row!.meta.corr, 'abc-123')
})

test('parseHistoryLine returns null for malformed line', () => {
  assert.equal(parseHistoryLine('too\tfew'), null)
})

test('toHistoryEntry preserves event and renders meta as note', () => {
  const row = parseHistoryLine(
    '2026-05-18T10:00:00.000Z\tpipeline-stage\tscout\tsync\tactor=system'
  )!
  const e = toHistoryEntry(row)
  assert.equal(e.event, 'sync')
  assert.match(e.note!, /actor=system/)
})

test('toHistoryEntry handles row without meta', () => {
  const row = parseHistoryLine('2026-05-18T10:00:00.000Z\tpipeline-stage\tscout\tsync')!
  const e = toHistoryEntry(row)
  assert.equal(e.note, undefined)
})
