import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  detectCzSk,
  scoreTranslationConfidence,
  TtlCache,
  translationCacheKey,
} from '../lib/pipeline/translation-quality.ts'

// ─── detectCzSk (#3) ─────────────────────────────────────────────────────────

test('detectCzSk: Czech text -> cs', () => {
  assert.equal(detectCzSk('Nový track je venku a je to bomba pro celou scénu'), 'cs')
})

test('detectCzSk: Slovak text -> sk', () => {
  assert.equal(detectCzSk('Toto je veľký deň pre slovenský rap, ľudia sa tešia'), 'sk')
})

test('detectCzSk: English text -> null', () => {
  assert.equal(detectCzSk('The new track is out and it is fire for the whole scene'), null)
})

test('detectCzSk: English with one accented proper noun -> null (no stopwords)', () => {
  assert.equal(detectCzSk('Beyoncé dropped a surprise album last night'), null)
})

test('detectCzSk: empty -> null', () => {
  assert.equal(detectCzSk(''), null)
})

// ─── scoreTranslationConfidence (#4) ─────────────────────────────────────────

test('confidence: clean English translation scores high', () => {
  const c = scoreTranslationConfidence(
    'Le nouveau morceau est sorti hier soir et la scène est en feu',
    'The new track dropped last night and the scene is on fire right now',
    'fr',
  )
  assert.ok(c >= 0.9, `expected >=0.9, got ${c}`)
})

test('confidence: untranslated foreign output scores 0.2', () => {
  const src = 'Le nouveau morceau est sorti hier soir'
  assert.equal(scoreTranslationConfidence(src, src, 'fr'), 0.2)
})

test('confidence: empty output scores 0', () => {
  assert.equal(scoreTranslationConfidence('some source', '', 'de'), 0)
})

test('confidence: placeholder leftovers penalised', () => {
  const c = scoreTranslationConfidence('quelque chose', 'TODO translate this content', 'fr')
  assert.ok(c <= 0.5, `expected <=0.5, got ${c}`)
})

test('confidence: residual non-ASCII penalised for foreign source', () => {
  // Output still mostly Cyrillic (>12% non-ASCII) => clearly not translated.
  const c = scoreTranslationConfidence(
    'Новый трек вышел вчера вечером и вся сцена горит прямо сейчас',
    'Новый трек дропнулся и это полный огонь для всей сцены сегодня',
    'ru',
  )
  assert.ok(c < 1, `expected <1, got ${c}`)
})

test('confidence: English source pass-through stays high', () => {
  const t = 'The album is out now'
  assert.equal(scoreTranslationConfidence(t, t, 'en'), 1)
})

// ─── TtlCache + key (#5) ─────────────────────────────────────────────────────

test('TtlCache: set/get round-trip', () => {
  const c = new TtlCache<string>(1000)
  c.set('k', 'v')
  assert.equal(c.get('k'), 'v')
})

test('TtlCache: expired entry returns undefined', () => {
  const c = new TtlCache<string>(-1) // already expired
  c.set('k', 'v')
  assert.equal(c.get('k'), undefined)
})

test('TtlCache: respects max size (evicts oldest)', () => {
  const c = new TtlCache<number>(10_000, 2)
  c.set('a', 1)
  c.set('b', 2)
  c.set('c', 3)
  assert.equal(c.size, 2)
  assert.equal(c.get('a'), undefined)
  assert.equal(c.get('c'), 3)
})

test('translationCacheKey: deterministic + content-sensitive', () => {
  assert.equal(translationCacheKey('t', 'c'), translationCacheKey('t', 'c'))
  assert.notEqual(translationCacheKey('t', 'c'), translationCacheKey('t', 'c2'))
})
