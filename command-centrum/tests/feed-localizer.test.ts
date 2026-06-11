/**
 * SM-4 — Localizer tests (with mocked AI dispatcher).
 *
 * Run: node --experimental-strip-types --test tests/feed-localizer.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  localizeFeedPost,
  parseMultilangResponse,
  type LocalizerAi,
} from '../lib/pipeline/feed/localizer.ts'
import { contentHash } from '../lib/pipeline/feed/localization-cache.ts'

const NOW = new Date('2026-05-27T12:00:00Z')
const ENGLISH = { title: 'Drake drops surprise album', summary: 'Out at midnight.' }
const FAKE_PROMPT = 'multilang-system'

function makeAiResponse(targets: string[]): string {
  const obj: Record<string, { title: string; summary: string; body: string }> = {}
  for (const t of targets) {
    obj[t] = { title: `${t}-title`, summary: `${t}-summary`, body: '' }
  }
  return JSON.stringify(obj)
}

// ─── full miss → 1 AI call, all 4 langs generated ───────────────────────────

test('localize: all 4 langs missed → single AI call generates all', async () => {
  let aiCalls = 0
  const ai: LocalizerAi = async () => {
    aiCalls += 1
    return makeAiResponse(['cs', 'de', 'fr', 'pl'])
  }

  const { result, patch } = await localizeFeedPost(
    { feedPostId: 'p1', englishMaster: ENGLISH },
    { metadata: null, localizedVersions: null },
    { ai, systemPrompt: FAKE_PROMPT, now: () => NOW },
  )

  assert.equal(aiCalls, 1)
  assert.equal(result.generated, 4)
  assert.equal(result.cacheHits, 0)
  assert.equal(Object.keys(patch.localizedVersions).length, 4)
  assert.equal(patch.localizedVersions.cs!.title, 'cs-title')
  assert.equal(Object.keys(patch.cardMetadata.localizationCache!).length, 4)
})

// ─── full hit → 0 AI calls ──────────────────────────────────────────────────

test('localize: all 4 langs cached → zero AI calls', async () => {
  const hash = contentHash(ENGLISH)
  const expiresAt = new Date(NOW.getTime() + 60_000).toISOString()
  const cache = {
    cs: { hash, expiresAt },
    de: { hash, expiresAt },
    fr: { hash, expiresAt },
    pl: { hash, expiresAt },
  }
  const versions = {
    cs: { title: 'cs-x', summary: 'cs-y' },
    de: { title: 'de-x', summary: 'de-y' },
    fr: { title: 'fr-x', summary: 'fr-y' },
    pl: { title: 'pl-x', summary: 'pl-y' },
  }

  let aiCalls = 0
  const ai: LocalizerAi = async () => {
    aiCalls += 1
    return makeAiResponse(['cs', 'de', 'fr', 'pl'])
  }

  const { result } = await localizeFeedPost(
    { feedPostId: 'p1', englishMaster: ENGLISH },
    { metadata: { localizationCache: cache }, localizedVersions: versions },
    { ai, systemPrompt: FAKE_PROMPT, now: () => NOW },
  )

  assert.equal(aiCalls, 0)
  assert.equal(result.cacheHits, 4)
  assert.equal(result.generated, 0)
})

// ─── partial: 2 cached, 2 missing → 1 batched AI call ──────────────────────

test('localize: partial cache → 1 batched AI call for misses only', async () => {
  const hash = contentHash(ENGLISH)
  const expiresAt = new Date(NOW.getTime() + 60_000).toISOString()
  let receivedPayload = ''

  const ai: LocalizerAi = async (_step, _system, user) => {
    receivedPayload = user
    return makeAiResponse(['fr', 'pl'])
  }

  const { result, patch } = await localizeFeedPost(
    { feedPostId: 'p1', englishMaster: ENGLISH },
    {
      metadata: { localizationCache: { cs: { hash, expiresAt }, de: { hash, expiresAt } } },
      localizedVersions: {
        cs: { title: 'cs-x', summary: 'cs-y' },
        de: { title: 'de-x', summary: 'de-y' },
      },
    },
    { ai, systemPrompt: FAKE_PROMPT, now: () => NOW },
  )

  assert.equal(result.cacheHits, 2)
  assert.equal(result.generated, 2)
  // AI was asked for fr+pl only (NOT cs/de which were cached)
  const parsedPayload = JSON.parse(receivedPayload)
  assert.deepEqual(parsedPayload.targets.sort(), ['fr', 'pl'])
  // Cached versions preserved
  assert.equal(patch.localizedVersions.cs!.title, 'cs-x')
  assert.equal(patch.localizedVersions.fr!.title, 'fr-title')
})

// ─── content_changed invalidates cache ─────────────────────────────────────

test('localize: content_changed → miss + regenerate', async () => {
  const oldHash = contentHash({ title: 'OLD title', summary: 'old' })
  const expiresAt = new Date(NOW.getTime() + 60_000).toISOString()

  let aiCalls = 0
  const ai: LocalizerAi = async () => {
    aiCalls += 1
    return makeAiResponse(['cs', 'de', 'fr', 'pl'])
  }

  await localizeFeedPost(
    { feedPostId: 'p1', englishMaster: ENGLISH },
    {
      metadata: { localizationCache: { cs: { hash: oldHash, expiresAt } } },
      localizedVersions: { cs: { title: 'stale', summary: 'stale' } },
    },
    { ai, systemPrompt: FAKE_PROMPT, now: () => NOW },
  )
  assert.equal(aiCalls, 1)
})

// ─── ai failure → graceful empty result (no crash) ──────────────────────────

test('localize: AI throws → returns empty patch, no exception', async () => {
  const ai: LocalizerAi = async () => {
    throw new Error('AI provider unavailable')
  }
  const { result } = await localizeFeedPost(
    { feedPostId: 'p1', englishMaster: ENGLISH },
    { metadata: null, localizedVersions: null },
    { ai, systemPrompt: FAKE_PROMPT, now: () => NOW },
  )
  assert.equal(result.generated, 0)
  assert.equal(result.cacheHits, 0)
})

// ─── parseMultilangResponse ─────────────────────────────────────────────────

test('parseMultilang: handles raw JSON with extra prose', () => {
  const raw = 'Here you go: {"cs":{"title":"x","summary":"y","body":""}} -- enjoy!'
  const out = parseMultilangResponse(raw, ['cs'])
  assert.equal(out.cs!.title, 'x')
  assert.equal(out.cs!.summary, 'y')
})

test('parseMultilang: skips invalid entries', () => {
  const raw = '{"cs":{"title":"x"},"de":{"title":"y","summary":"z","body":""}}'
  const out = parseMultilangResponse(raw, ['cs', 'de'])
  assert.equal(out.cs, undefined) // missing summary
  assert.equal(out.de!.title, 'y')
})

test('parseMultilang: empty/garbage → empty map', () => {
  assert.deepEqual(parseMultilangResponse('', ['cs']), {})
  assert.deepEqual(parseMultilangResponse('not json at all', ['cs']), {})
})
