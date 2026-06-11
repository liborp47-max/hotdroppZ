import { test } from 'node:test'
import assert from 'node:assert/strict'

import { htmlToMarkdownLite, markdownLiteToHtml, unescapeHtml } from '../lib/feed/markdown-lite.ts'

const roundTrip = (md: string) => htmlToMarkdownLite(markdownLiteToHtml(md))

// ─── markdown -> html -> markdown is stable for the supported subset ──────────

test('headings round-trip', () => {
  assert.equal(roundTrip('## Title'), '## Title')
  assert.equal(roundTrip('### Sub'), '### Sub')
})

test('bold / italic / code round-trip', () => {
  assert.equal(roundTrip('**bold** and *italic* and `code`'), '**bold** and *italic* and `code`')
})

test('bullet list round-trip', () => {
  assert.equal(roundTrip('- one\n- two'), '- one\n- two')
})

test('link round-trip', () => {
  assert.equal(roundTrip('[HotDroppZ](https://hotdroppz.com)'), '[HotDroppZ](https://hotdroppz.com)')
})

test('paragraph round-trip', () => {
  assert.equal(roundTrip('Just a plain line.'), 'Just a plain line.')
})

test('mixed document preserves rendered HTML (live-preview parity)', () => {
  // Block spacing may normalise (heading/para/list separated by blank lines),
  // but the rendered output — what the preview + feed show — must be identical.
  const md = '## Heading\nIntro **para**.\n- a\n- b'
  assert.equal(markdownLiteToHtml(roundTrip(md)), markdownLiteToHtml(md))
})

test('round-trip is idempotent', () => {
  const md = '## Heading\nIntro **para**.\n- a\n- b'
  assert.equal(roundTrip(roundTrip(md)), roundTrip(md))
})

// ─── tolerant of contentEditable noise ───────────────────────────────────────

test('contentEditable <div>/<br> map to line breaks', () => {
  assert.equal(htmlToMarkdownLite('<div>line one</div><div>line two</div>'), 'line one\n\nline two')
  assert.equal(htmlToMarkdownLite('first<br>second'), 'first\nsecond')
})

test('execCommand <b>/<i> map to markdown markers', () => {
  assert.equal(htmlToMarkdownLite('<div>hello <b>world</b> and <i>more</i></div>'), 'hello **world** and *more*')
})

test('residual unknown tags are stripped, entities unescaped', () => {
  assert.equal(htmlToMarkdownLite('<span style="x">a &amp; b &lt; c</span>'), 'a & b < c')
})

test('unescapeHtml reverses escapeHtml entities', () => {
  assert.equal(unescapeHtml('a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;'), `a & b < c > d "e" 'f'`)
})

test('empty / nullish input -> empty string', () => {
  assert.equal(htmlToMarkdownLite(''), '')
  assert.equal(htmlToMarkdownLite(null), '')
  assert.equal(htmlToMarkdownLite(undefined), '')
})
