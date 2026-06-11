import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveScheduledAt,
  isPublishDue,
  selectDuePosts,
  type ScheduleData,
  type PublishablePost,
} from '../lib/feed/calendar.ts'

// ─── deriveScheduledAt — earliest per-platform ISO ───────────────────────────

test('deriveScheduledAt returns null on empty / null input', () => {
  assert.equal(deriveScheduledAt(null), null)
  assert.equal(deriveScheduledAt(undefined), null)
  assert.equal(deriveScheduledAt({}), null)
})

test('deriveScheduledAt picks the earliest valid date+time across platforms', () => {
  const schedule: ScheduleData = {
    instagram: { date: '2026-06-01', time: '14:00' },
    twitter:   { date: '2026-06-01', time: '09:30' },
    blog:      { date: '2026-06-05', time: '08:00' },
  }
  const got = deriveScheduledAt(schedule)
  assert.equal(got, new Date('2026-06-01T09:30:00').toISOString())
})

test('deriveScheduledAt defaults missing time to 00:00', () => {
  const got = deriveScheduledAt({ blog: { date: '2026-06-10' } })
  assert.equal(got, new Date('2026-06-10T00:00:00').toISOString())
})

test('deriveScheduledAt skips entries with no date or unparseable time', () => {
  const schedule: ScheduleData = {
    a: { date: '', time: '10:00' },        // no date — skipped
    b: { time: '11:00' },                  // no date — skipped
    c: { date: 'not-a-date' },             // unparseable — skipped
    d: { date: '2026-06-15', time: 'xx' }, // bad time → falls back to 00:00, valid
  }
  assert.equal(deriveScheduledAt(schedule), new Date('2026-06-15T00:00:00').toISOString())
})

// ─── isPublishDue — cron predicate ───────────────────────────────────────────

const NOW = new Date('2026-06-01T12:00:00.000Z')

test('isPublishDue: only scheduled posts with past scheduled_at are due', () => {
  const past = '2026-06-01T10:00:00.000Z'
  const future = '2026-06-02T10:00:00.000Z'

  // due: scheduled, past time, not yet published
  assert.equal(isPublishDue({ status: 'scheduled', scheduled_at: past }, NOW), true)
  // not due: status not scheduled
  assert.equal(isPublishDue({ status: 'draft', scheduled_at: past }, NOW), false)
  // not due: scheduled but future
  assert.equal(isPublishDue({ status: 'scheduled', scheduled_at: future }, NOW), false)
  // not due: missing scheduled_at
  assert.equal(isPublishDue({ status: 'scheduled' }, NOW), false)
  // not due: already published (defensive — cron must not double-publish)
  assert.equal(
    isPublishDue({ status: 'scheduled', scheduled_at: past, published_at: past }, NOW),
    false,
  )
})

test('selectDuePosts filters only due posts', () => {
  const posts: PublishablePost[] = [
    { status: 'scheduled', scheduled_at: '2026-06-01T10:00:00.000Z' }, // due
    { status: 'scheduled', scheduled_at: '2026-06-02T10:00:00.000Z' }, // future
    { status: 'draft',     scheduled_at: '2026-06-01T10:00:00.000Z' }, // not scheduled
    { status: 'published', scheduled_at: '2026-06-01T10:00:00.000Z' }, // already published
  ]
  assert.equal(selectDuePosts(posts, NOW).length, 1)
})
