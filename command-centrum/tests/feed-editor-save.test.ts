import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildEditorSavePayload } from '../lib/feed/editor-save.ts'

const baseDraft = {
  headline: 'Editorial headline',
  content: 'Body text',
  status: 'draft' as const,
  platforms: ['blog', 'newsletter'],
  languages: ['en', 'cs'],
  imageUrl: '',
  metaTitle: '',
  metaDescription: '',
  slug: '',
}

test('buildEditorSavePayload: omits image_url when empty', () => {
  const payload = buildEditorSavePayload(baseDraft)
  assert.equal('image_url' in payload, false, 'image_url must be omitted, not null')
})

test('buildEditorSavePayload: includes image_url when non-empty', () => {
  const payload = buildEditorSavePayload({ ...baseDraft, imageUrl: 'https://x.test/a.jpg' })
  assert.equal(payload.image_url, 'https://x.test/a.jpg')
})

test('buildEditorSavePayload: wraps SEO fields under metadata.seo', () => {
  const payload = buildEditorSavePayload({
    ...baseDraft,
    metaTitle: 'T',
    metaDescription: 'D',
    slug: 's',
  })
  assert.deepEqual(payload.metadata, { seo: { metaTitle: 'T', metaDescription: 'D', slug: 's' } })
})

test('buildEditorSavePayload: status field propagates verbatim', () => {
  for (const status of ['draft', 'scheduled', 'published'] as const) {
    const payload = buildEditorSavePayload({ ...baseDraft, status })
    assert.equal(payload.status, status)
  }
})

test('buildEditorSavePayload: editorial fields propagate verbatim', () => {
  const payload = buildEditorSavePayload(baseDraft)
  assert.equal(payload.headline, 'Editorial headline')
  assert.equal(payload.content, 'Body text')
  assert.deepEqual(payload.platforms, ['blog', 'newsletter'])
  assert.deepEqual(payload.languages, ['en', 'cs'])
})

test('buildEditorSavePayload: regression — payload shape matches PUT /api/feed/[id] contract', () => {
  // The keys this test asserts are the contract the route handler in
  // app/api/feed/[id]/route.ts unpacks (lines ~97-114). If a future refactor
  // changes the route's body shape, this test must be updated in lockstep.
  const payload = buildEditorSavePayload({ ...baseDraft, imageUrl: 'x' })
  const keys = Object.keys(payload).sort()
  assert.deepEqual(keys, [
    'content',
    'headline',
    'image_url',
    'languages',
    'metadata',
    'platforms',
    'status',
  ])
})
