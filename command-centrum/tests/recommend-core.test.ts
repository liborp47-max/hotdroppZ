import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickRecommendation, type RankedProvider } from '../lib/ai/recommend-core.ts'

const r = (id: string, score: number, available = true, isFree = true): RankedProvider => ({
  providerId: id,
  displayName: id,
  status: available ? 'active' : 'not-configured',
  score,
  isFree,
  available,
})

test('recommends the top available provider; flags a change vs current', () => {
  const ranked = [r('gemini_flash', 9), r('groq_fast', 7), r('rules', 3)]
  const out = pickRecommendation('translation', 'Translation', 'groq_fast', 'rules', ranked)
  assert.equal(out.recommended, 'gemini_flash')
  assert.equal(out.changeSuggested, true)
  assert.equal(out.currentScore, 7)
  assert.equal(out.recommendedScore, 9)
  assert.equal(out.delta, 2)
})

test('current already optimal -> no change suggested', () => {
  const ranked = [r('claude_haiku', 8.5), r('groq_fast', 7)]
  const out = pickRecommendation('curator', 'Curator', 'claude_haiku', 'groq_fast', ranked)
  assert.equal(out.changeSuggested, false)
  assert.match(out.reason, /optimální/)
})

test('skips unavailable providers — recommends best AVAILABLE', () => {
  // openai_full scores highest but is not configured -> recommend the best active.
  const ranked = [r('openai_full', 10, false), r('claude_haiku', 8), r('groq', 7)]
  const out = pickRecommendation('writer', 'Writer', 'groq', 'groq', ranked)
  assert.equal(out.recommended, 'claude_haiku')
  assert.equal(out.changeSuggested, true)
})

test('current provider unavailable -> recommend an available one, reason explains', () => {
  const ranked = [r('claude_haiku', 8), r('gemini_flash', 7.5), r('openai_mini', 9, false)]
  const out = pickRecommendation('writer', 'Writer', 'openai_mini', 'groq', ranked)
  assert.equal(out.recommended, 'claude_haiku')
  assert.match(out.reason, /není dostupný/)
})

test('no available providers -> falls back to configured fallback', () => {
  const ranked = [r('gemini_flash', 9, false), r('openai_mini', 8, false)]
  const out = pickRecommendation('filter', 'Filter', 'gemini_flash', 'rules', ranked)
  assert.equal(out.recommended, 'rules')
  assert.equal(out.recommendedScore, 0)
})

test('current provider not in ranked list is treated as unavailable', () => {
  const ranked = [r('groq_fast', 7)]
  const out = pickRecommendation('translation', 'Translation', 'deepl_free', 'groq_fast', ranked)
  assert.equal(out.currentScore, null)
  assert.equal(out.recommended, 'groq_fast')
  assert.equal(out.changeSuggested, true)
})
