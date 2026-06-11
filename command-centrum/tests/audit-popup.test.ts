import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAuditPopupText, closeAuditPopup } from '../lib/hd-central/audit-popup'

test('buildAuditPopupText creates copy-ready report payload', () => {
  const text = buildAuditPopupText({
    missionId: 'M1',
    runId: 'run-abc',
    stepIndex: 1,
    verdict: 'PASS',
    timestamp: '2026-05-14T12:00:00.000Z',
    summary: 'Everything is green',
  })

  assert.match(text, /missionId: M1/)
  assert.match(text, /runId: run-abc/)
  assert.match(text, /verdict: PASS/)
  assert.match(text, /summary: Everything is green/)
})

test('closeAuditPopup returns null state for close action', () => {
  assert.equal(closeAuditPopup(), null)
})
