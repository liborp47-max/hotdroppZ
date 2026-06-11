/**
 * Scout RSS integration tests — UM-SCOUT #04.
 *
 * Exercises the real RSS ingest logic (lib/services/rss-parser.ts :: parseFeed)
 * against representative feed fixtures and failure paths.
 *
 * Run: node --experimental-strip-types --test tests/scout-rss.test.ts
 *
 * NOTE: timeout/retry and DB persistence are NOT covered here — rss-gateway.ts
 * and scout.ts are still stubs (getFeedItems() returns [], scout.ts is
 * notImplemented). Those test dimensions are blocked on a real implementation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFeed } from '../lib/services/rss-parser.ts'

// ─── Fixtures — representative feeds ─────────────────────────────────────────

const RSS_2_0 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Rap News</title>
<item><title>Drake drops surprise album tonight</title><link>https://example.com/drake-album</link><description>The album hit streaming at midnight.</description><pubDate>Mon, 19 May 2026 22:00:00 GMT</pubDate></item>
<item><title>Kendrick announces European tour</title><link>https://example.com/kendrick-tour</link><description>Dates across eight countries.</description><pubDate>Tue, 20 May 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`

const ATOM_1_0 = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Culture Wire</title>
<entry><title>New fashion drop breaks the internet</title><link rel="alternate" href="https://example.com/fashion-drop"/><summary>Sold out within minutes.</summary><published>2026-05-20T10:00:00Z</published></entry>
</feed>`

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Viral Hub',
  items: [
    {
      title: 'Meme of the week explodes online',
      url: 'https://example.com/meme',
      content_text: 'Everyone is sharing it across platforms.',
      date_published: '2026-05-20T12:00:00Z',
    },
  ],
})

const WORDPRESS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<item><title><![CDATA[Beef escalates between two major artists]]></title><link>https://example.com/beef</link><description>Short teaser only.</description><content:encoded><![CDATA[<p>Full <strong>article</strong> body with all the detail.</p>]]></content:encoded><pubDate>Wed, 21 May 2026 08:00:00 GMT</pubDate></item>
<item><title>Track named &quot;Fire &amp; Ice&quot; leaks early</title><link>https://example.com/leak</link><description>Leaked ahead of release.</description></item>
</channel></rss>`

// ─── Representative-feed tests ───────────────────────────────────────────────

test('RSS 2.0 feed — parses every item with title, url, content, pubDate', () => {
  const items = parseFeed(RSS_2_0)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Drake drops surprise album tonight')
  assert.equal(items[0].url, 'https://example.com/drake-album')
  assert.match(items[0].content, /streaming at midnight/)
  assert.equal(items[0].pubDate, 'Mon, 19 May 2026 22:00:00 GMT')
  assert.equal(items[1].url, 'https://example.com/kendrick-tour')
})

test('Atom 1.0 feed — url resolved from rel="alternate" href', () => {
  const items = parseFeed(ATOM_1_0)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'New fashion drop breaks the internet')
  assert.equal(items[0].url, 'https://example.com/fashion-drop')
  assert.match(items[0].content, /Sold out within minutes/)
  assert.equal(items[0].pubDate, '2026-05-20T10:00:00Z')
})

test('JSON Feed — parsed via the JSON branch', () => {
  const items = parseFeed(JSON_FEED)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Meme of the week explodes online')
  assert.equal(items[0].url, 'https://example.com/meme')
  assert.match(items[0].content, /sharing it/)
})

test('WordPress feed — content:encoded preferred, CDATA + entities handled', () => {
  const items = parseFeed(WORDPRESS)
  assert.equal(items.length, 2)
  // content:encoded wins over <description>, HTML stripped
  assert.equal(items[0].title, 'Beef escalates between two major artists')
  assert.equal(items[0].content, 'Full article body with all the detail.')
  // HTML entities in a normal (non-CDATA) title are unescaped
  assert.equal(items[1].title, 'Track named "Fire & Ice" leaks early')
})

// ─── Failure-path tests — must degrade gracefully, never throw ───────────────

test('malformed XML — returns empty array, does not throw', () => {
  assert.deepEqual(parseFeed('<rss><channel><item><title>Broken feed no closing'), [])
})

test('malformed JSON feed — returns empty array, does not throw', () => {
  assert.deepEqual(parseFeed('{ "items": [ {"title": broken '), [])
})

test('empty / whitespace input — returns empty array', () => {
  assert.deepEqual(parseFeed(''), [])
  assert.deepEqual(parseFeed('   \n  '), [])
})

test('items missing a usable title (<5 chars) are skipped', () => {
  const feed = `<rss><channel>
<item><title>Hi</title><link>https://example.com/a</link></item>
<item><title>A properly long headline here</title><link>https://example.com/b</link></item>
</channel></rss>`
  const items = parseFeed(feed)
  assert.equal(items.length, 1)
  assert.equal(items[0].url, 'https://example.com/b')
})

test('items with no link/url are skipped', () => {
  const feed = `<rss><channel>
<item><title>Headline with no link at all</title><description>Body text.</description></item>
</channel></rss>`
  assert.deepEqual(parseFeed(feed), [])
})

test('item cap — at most 25 items returned from an oversized feed', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    `<item><title>Representative headline number ${i}</title><link>https://example.com/${i}</link><description>Body ${i}</description></item>`,
  ).join('')
  const items = parseFeed(`<rss><channel>${many}</channel></rss>`)
  assert.equal(items.length, 25)
})
