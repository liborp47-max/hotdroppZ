import { test } from 'node:test'
import assert from 'node:assert/strict'

import { escapeHtml, markdownLiteToHtml, markdownToPlainText } from '../lib/feed/markdown-lite.ts'

// ─── Safety: input is escaped before formatting ──────────────────────────────

test('escapeHtml neutralizes HTML-significant characters', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
})

test('markdownLiteToHtml never emits user-injected markup', () => {
  const html = markdownLiteToHtml('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'), 'raw script tag must not survive')
  assert.ok(html.includes('&lt;script&gt;'), 'angle brackets must be escaped')
})

test('markdownLiteToHtml link only emits the tags it builds', () => {
  // an attempted injection inside link text stays escaped
  const html = markdownLiteToHtml('[<b>x</b>](https://safe.example)')
  assert.ok(html.includes('href="https://safe.example"'))
  assert.ok(!html.includes('<b>'))
})

// ─── Formatting ──────────────────────────────────────────────────────────────

test('markdownLiteToHtml renders headings, bold, italic, code', () => {
  assert.equal(markdownLiteToHtml('## Title'), '<h2>Title</h2>')
  assert.equal(markdownLiteToHtml('### Sub'), '<h3>Sub</h3>')
  assert.equal(markdownLiteToHtml('**bold**'), '<p><strong>bold</strong></p>')
  assert.equal(markdownLiteToHtml('*italic*'), '<p><em>italic</em></p>')
  assert.equal(markdownLiteToHtml('`code`'), '<p><code>code</code></p>')
})

test('markdownLiteToHtml renders bullet lists', () => {
  assert.equal(markdownLiteToHtml('- one\n- two'), '<ul><li>one</li><li>two</li></ul>')
})

test('markdownLiteToHtml renders http links with safe rel', () => {
  const html = markdownLiteToHtml('[HotDroppZ](https://hotdroppz.com)')
  assert.ok(html.includes('<a href="https://hotdroppz.com" target="_blank" rel="noopener noreferrer">HotDroppZ</a>'))
})

test('markdownLiteToHtml: empty input yields empty string', () => {
  assert.equal(markdownLiteToHtml(''), '')
  assert.equal(markdownLiteToHtml(null), '')
  assert.equal(markdownLiteToHtml(undefined), '')
})

// ─── markdownToPlainText — SEO meta description fallback ──────────────────────

test('markdownToPlainText strips markdown syntax', () => {
  assert.equal(markdownToPlainText('## Title\n\n**bold** and *italic*'), 'Title bold and italic')
})

test('markdownToPlainText truncates to maxLen with an ellipsis', () => {
  const long = 'word '.repeat(80)
  const out = markdownToPlainText(long, 50)
  assert.ok(out.length <= 50)
  assert.ok(out.endsWith('…'))
})
