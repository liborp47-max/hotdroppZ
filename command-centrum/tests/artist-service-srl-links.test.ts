/**
 * PR-S4 #03 — Artist Service platform-link resolution via SRL.
 *
 * Proves enrichArtistProfile's SRL gap-fill helper only writes columns the
 * artist is missing, only on a confident match, and never overwrites an
 * existing value — so the legacy external-API path is preserved whenever the
 * registry has no hit (current schema → 0 confidence → no updates).
 *
 * Pure-function level: no DB, no external APIs.
 * Run: tsx --test tests/artist-service-srl-links.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { srlArtistLinkUpdates } from '../lib/services/artist-service.ts'
import type { PlatformLinks } from '../lib/sources/srl/index.ts'

const bare = { spotify_url: null, youtube_url: null, genius_url: null }

test('srlArtistLinkUpdates: null lookup yields no updates (legacy path preserved)', () => {
  assert.deepEqual(srlArtistLinkUpdates(bare, null), {})
})

test('srlArtistLinkUpdates: 0-confidence match is ignored', () => {
  const links: PlatformLinks = { artistName: 'X', artistId: 'a', links: { spotify_artists: 'id' }, confidence: 0 }
  assert.deepEqual(srlArtistLinkUpdates(bare, links), {})
})

test('srlArtistLinkUpdates: fills missing spotify/genius from a confident match', () => {
  const links: PlatformLinks = {
    artistName: 'Central Cee',
    artistId: 'a-1',
    links: { spotify_artists: '5H4yInM5zmHqpKIoMNAx4r', genius: 'https://genius.com/cee' },
    confidence: 0.9,
  }
  assert.deepEqual(srlArtistLinkUpdates(bare, links), {
    spotify_url: 'https://open.spotify.com/artist/5H4yInM5zmHqpKIoMNAx4r',
    genius_url: 'https://genius.com/cee',
  })
})

test('srlArtistLinkUpdates: never overwrites a column the artist already has', () => {
  const artist = { spotify_url: 'https://open.spotify.com/artist/existing', youtube_url: null, genius_url: null }
  const links: PlatformLinks = {
    artistName: 'Central Cee',
    artistId: 'a-1',
    links: { spotify_artists: 'srlid', genius: 'https://genius.com/cee' },
    confidence: 1,
  }
  // spotify kept, only the genuine gap (genius) is filled
  assert.deepEqual(srlArtistLinkUpdates(artist, links), { genius_url: 'https://genius.com/cee' })
})
