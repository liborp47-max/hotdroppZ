import { test } from 'node:test'
import assert from 'node:assert/strict'

// Cross-app import: verifies the real frontend-web PostHog event wrapper (P0-004).
import { capture, track, isAnalyticsEnabled } from '../../frontend-web/lib/analytics/posthog.ts'

const setWindow = (win: unknown) => {
  ;(globalThis as { window?: unknown }).window = win
}

test('capture no-ops without window (SSR-safe)', () => {
  ;(globalThis as { window?: unknown }).window = undefined
  assert.doesNotThrow(() => capture('app_open'))
})

test('track.* forwards to window.posthog.capture with event + props', () => {
  const calls: Array<[string, Record<string, unknown>]> = []
  setWindow({ posthog: { capture: (e: string, p: Record<string, unknown>) => calls.push([e, p]) } })
  ;(globalThis as { location?: unknown }).location = { pathname: '/feed' }

  track.appOpen()
  track.articleOpen('a1', 'Title')
  track.articleShare('a1', 'twitter')
  track.userSignup('google')

  assert.deepEqual(calls.map((c) => c[0]), ['app_open', 'article_open', 'article_share', 'user_signup'])
  assert.equal(calls[1][1].article_id, 'a1')
  assert.equal(calls[1][1].title, 'Title')
  assert.equal(calls[2][1].channel, 'twitter')
  assert.equal(calls[3][1].method, 'google')
})

test('capture swallows errors from posthog (never breaks the app)', () => {
  setWindow({ posthog: { capture: () => { throw new Error('boom') } } })
  assert.doesNotThrow(() => capture('app_open'))
})

test('window present but posthog not loaded -> no-op', () => {
  setWindow({})
  assert.doesNotThrow(() => capture('article_open', { article_id: 'x' }))
})

test('isAnalyticsEnabled is false without a key', () => {
  setWindow({})
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  assert.equal(isAnalyticsEnabled(), false)
})
