/**
 * PR-S4 #02 — Enrichment platform-link resolution via SRL.
 *
 * Proves enrichment gap-fills artist_id + platform URLs from an SRL
 * cross-platform lookup, while staying fully backwards-compatible: a null /
 * 0-confidence lookup leaves the externally-enriched fields untouched, and SRL
 * never overwrites a value the external APIs already produced.
 *
 * Pure-function level: no DB, no external APIs.
 * Run: tsx --test tests/enrichment-srl-links.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applySrlLinks, srlLinksToUrls, type EnrichedFields } from '../lib/pipeline/enrichment.ts'
import type { PlatformLinks } from '../lib/sources/srl/index.ts'

const empty: EnrichedFields = {
  artist_name: null,
  spotify_url: null,
  youtube_url: null,
  genius_url: null,
  apple_music_url: null,
  image_url: null,
  artist_id: null,
}

test('srlLinksToUrls: builds canonical Spotify URL from a bare artist id', () => {
  const urls = srlLinksToUrls({ spotify_artists: '5H4yInM5zmHqpKIoMNAx4r' })
  assert.equal(urls.spotify_url, 'https://open.spotify.com/artist/5H4yInM5zmHqpKIoMNAx4r')
})

test('srlLinksToUrls: passes through an already-absolute Spotify URL unchanged', () => {
  const url = 'https://open.spotify.com/artist/abc'
  assert.equal(srlLinksToUrls({ spotify_artists: url }).spotify_url, url)
})

test('srlLinksToUrls: adopts youtube/genius/apple only when already absolute URLs', () => {
  // bare ids for non-spotify platforms are NOT guessed into URLs
  assert.deepEqual(srlLinksToUrls({ youtube: 'UCxxx', genius: '12345', apple_music: '999' }), {})
  const urls = srlLinksToUrls({
    youtube: 'https://youtube.com/@cee',
    genius: 'https://genius.com/artists/cee',
    apple_music: 'https://music.apple.com/artist/cee/1',
  })
  assert.equal(urls.youtube_url, 'https://youtube.com/@cee')
  assert.equal(urls.genius_url, 'https://genius.com/artists/cee')
  assert.equal(urls.apple_music_url, 'https://music.apple.com/artist/cee/1')
})

test('applySrlLinks: null lookup returns fields untouched (backwards compat)', () => {
  assert.deepEqual(applySrlLinks(empty, null), empty)
})

test('applySrlLinks: 0-confidence match is ignored', () => {
  const links: PlatformLinks = { artistName: 'Central Cee', artistId: 'a-1', links: { spotify_artists: 'x' }, confidence: 0 }
  assert.deepEqual(applySrlLinks(empty, links), empty)
})

test('applySrlLinks: gap-fills artist_id, name and missing platform URLs', () => {
  const links: PlatformLinks = {
    artistName: 'Central Cee',
    artistId: 'a-1',
    links: { spotify_artists: '5H4yInM5zmHqpKIoMNAx4r', genius: 'https://genius.com/cee' },
    confidence: 0.9,
  }
  const out = applySrlLinks(empty, links)
  assert.equal(out.artist_id, 'a-1')
  assert.equal(out.artist_name, 'Central Cee')
  assert.equal(out.spotify_url, 'https://open.spotify.com/artist/5H4yInM5zmHqpKIoMNAx4r')
  assert.equal(out.genius_url, 'https://genius.com/cee')
})

test('applySrlLinks: never overwrites values the external APIs already produced', () => {
  const enriched: EnrichedFields = {
    ...empty,
    artist_id: 'existing-id',
    artist_name: 'Existing Name',
    spotify_url: 'https://open.spotify.com/track/existing',
  }
  const links: PlatformLinks = {
    artistName: 'SRL Name',
    artistId: 'srl-id',
    links: { spotify_artists: 'srlid', genius: 'https://genius.com/srl' },
    confidence: 1,
  }
  const out = applySrlLinks(enriched, links)
  // existing values win …
  assert.equal(out.artist_id, 'existing-id')
  assert.equal(out.artist_name, 'Existing Name')
  assert.equal(out.spotify_url, 'https://open.spotify.com/track/existing')
  // … but genuine gaps are still filled from SRL
  assert.equal(out.genius_url, 'https://genius.com/srl')
})
