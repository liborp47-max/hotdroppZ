/**
 * HDUA-20 #01 — text helper tests (decodeEntities / timeAgo / compact).
 * Pure: no DB, no RN. Run: tsx --test tests/text.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeEntities, timeAgo, compact } from '../src/utils/text.ts'

test('decodeEntities: named, numeric (dec) and hex entities', () => {
  assert.equal(decodeEntities('a &amp; b'), 'a & b')
  assert.equal(decodeEntities('5 &lt; 10 &gt; 2'), '5 < 10 > 2')
  assert.equal(decodeEntities('caf&eacute;'), 'café')
  assert.equal(decodeEntities('&#65;&#66;'), 'AB')
  assert.equal(decodeEntities('&#x41;&#x42;'), 'AB')
})

test('decodeEntities: unknown entity left intact, null/empty → ""', () => {
  assert.equal(decodeEntities('&bogus;'), '&bogus;')
  assert.equal(decodeEntities(null), '')
  assert.equal(decodeEntities(undefined), '')
  assert.equal(decodeEntities(''), '')
})

test('compact: thousands and millions formatting', () => {
  assert.equal(compact(0), '0')
  assert.equal(compact(999), '999')
  assert.equal(compact(1200), '1.2K')
  assert.equal(compact(12400), '12K')      // >=10k drops the decimal
  assert.equal(compact(1_500_000), '1.5M')
  assert.equal(compact(null), '0')
  assert.equal(compact(undefined), '0')
})

test('timeAgo: second/minute/hour/day/week buckets', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
  assert.equal(timeAgo(ago(5_000)), '5s')
  assert.equal(timeAgo(ago(5 * 60_000)), '5m')
  assert.equal(timeAgo(ago(3 * 3_600_000)), '3h')
  assert.equal(timeAgo(ago(2 * 86_400_000)), '2d')
  assert.equal(timeAgo(ago(14 * 86_400_000)), '2w')
})

test('timeAgo: invalid / empty → ""', () => {
  assert.equal(timeAgo('not-a-date'), '')
  assert.equal(timeAgo(null), '')
  assert.equal(timeAgo(undefined), '')
})
