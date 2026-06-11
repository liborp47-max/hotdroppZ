import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isUrlSafe } from '../lib/utils/ssrf-guard.ts'

test('blocks cloud metadata, loopback, private ranges', () => {
  for (const bad of [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/api',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'http://backend/internal', // bare internal host (no dot)
    'http://db.internal/',
    'file:///etc/passwd',
    'gopher://x/',
  ]) {
    assert.equal(isUrlSafe(bad).ok, false, `should block ${bad}`)
  }
})

test('allows legitimate public feed URLs', () => {
  for (const good of [
    'https://pitchfork.com/rss',
    'http://feeds.bbci.co.uk/news/rss.xml',
    'https://open.spotify.com/artist/x',
    'https://8.8.8.8/feed', // public IP literal
  ]) {
    assert.equal(isUrlSafe(good).ok, true, `should allow ${good}`)
  }
})

test('rejects malformed urls', () => {
  assert.equal(isUrlSafe('not a url').ok, false)
  assert.equal(isUrlSafe('').ok, false)
})
