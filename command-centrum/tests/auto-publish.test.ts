import test from 'node:test'
import assert from 'node:assert/strict'

import {
  runAutoPublishPipeline,
  AUTO_PUBLISH_MIN_SCORE,
  AUTO_PUBLISH_MIN_BODY_CHARS,
} from '../lib/pipeline/auto-publish.ts'

/**
 * HDUA-16 — editorial auto-publish gate.
 *
 * The writer persists posts as status='draft'; nothing promotes them, so the
 * editorial branch of hdua_feed_items (posts WHERE status='published') is empty
 * and HDUA never shows articles. runAutoPublishPipeline closes that gap with a
 * quality gate. These tests pin the gate predicate, the status guard, and the
 * never-throw contract.
 */

type Row = Record<string, unknown>

/** Minimal chainable Supabase mock for the exact chain auto-publish uses:
 *  select().in().gte().order().limit()  and  update().in().in().select() */
class Builder implements PromiseLike<{ data: Row[]; error: { message: string } | null }> {
  private store: Row[]
  private working: Row[]
  private mode: 'select' | 'update' = 'select'
  private patch: Row | null = null
  private readonly failMessage: string | null

  constructor(store: Row[], failMessage: string | null) {
    this.store = store
    this.working = [...store]
    this.failMessage = failMessage
  }

  select(): this {
    return this
  }
  update(patch: Row): this {
    this.mode = 'update'
    this.patch = patch
    return this
  }
  in(col: string, vals: unknown[]): this {
    const set = new Set(vals)
    this.working = this.working.filter((r) => set.has(r[col]))
    return this
  }
  gte(col: string, val: number): this {
    this.working = this.working.filter((r) => typeof r[col] === 'number' && (r[col] as number) >= val)
    return this
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    const desc = opts?.ascending === false
    this.working = [...this.working].sort((a, b) => {
      const av = a[col] as number | string
      const bv = b[col] as number | string
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return desc ? -cmp : cmp
    })
    return this
  }
  limit(n: number): this {
    this.working = this.working.slice(0, n)
    return this
  }

  then<T = { data: Row[]; error: { message: string } | null }>(
    onFulfilled?: ((value: { data: Row[]; error: { message: string } | null }) => T | PromiseLike<T>) | null,
  ): PromiseLike<T> {
    if (this.failMessage) {
      return Promise.resolve({ data: [], error: { message: this.failMessage } }).then(
        onFulfilled ?? ((v) => v as unknown as T),
      )
    }
    if (this.mode === 'update' && this.patch) {
      for (const r of this.working) Object.assign(r, this.patch)
    }
    return Promise.resolve({ data: this.working, error: null }).then(
      onFulfilled ?? ((v) => v as unknown as T),
    )
  }
}

class MockDb {
  private posts: Row[]
  private failMessage: string | null
  constructor(posts: Row[], failMessage: string | null = null) {
    this.posts = posts
    this.failMessage = failMessage
  }
  from(_table: string): Builder {
    return new Builder(this.posts, this.failMessage)
  }
  rows(): Row[] {
    return this.posts
  }
}

const goodBody = 'x'.repeat(AUTO_PUBLISH_MIN_BODY_CHARS)
const db = (rows: Row[], fail?: string) =>
  new MockDb(rows, fail ?? null) as unknown as Parameters<typeof runAutoPublishPipeline>[0]

test('publishes draft/approved posts that clear score + title + body gate', async () => {
  const rows: Row[] = [
    { id: 'a', status: 'draft', ai_score: 90, title: 'Strong', body: goodBody },
    { id: 'b', status: 'approved', ai_score: AUTO_PUBLISH_MIN_SCORE, title: 'Edge', body: goodBody },
  ]
  const res = await runAutoPublishPipeline(db(rows))
  assert.equal(res.published, 2)
  assert.deepEqual(res.publishedIds.sort(), ['a', 'b'])
  assert.equal(res.errors.length, 0)
  // store mutated to published
  assert.equal(rows.every((r) => r.status === 'published' && r.published_at), true)
})

test('skips low score, short body, and empty title — and never publishes them', async () => {
  const rows: Row[] = [
    { id: 'low', status: 'draft', ai_score: AUTO_PUBLISH_MIN_SCORE - 1, title: 'ok', body: goodBody },
    { id: 'short', status: 'draft', ai_score: 95, title: 'ok', body: 'too short' },
    { id: 'untitled', status: 'draft', ai_score: 95, title: '   ', body: goodBody },
  ]
  const res = await runAutoPublishPipeline(db(rows))
  assert.equal(res.published, 0)
  // low score never even reaches candidates (filtered by .gte); short/untitled are evaluated then skipped
  assert.equal(res.evaluated, 2)
  assert.equal(res.skipped, 2)
  assert.equal(rows.find((r) => r.id === 'short')!.status, 'draft')
  assert.equal(rows.find((r) => r.id === 'untitled')!.status, 'draft')
})

test('never re-publishes already-published rows (status guard / idempotent)', async () => {
  const rows: Row[] = [{ id: 'a', status: 'draft', ai_score: 90, title: 'Strong', body: goodBody }]
  const mock = new MockDb(rows)
  const first = await runAutoPublishPipeline(mock as unknown as Parameters<typeof runAutoPublishPipeline>[0])
  assert.equal(first.published, 1)
  const second = await runAutoPublishPipeline(mock as unknown as Parameters<typeof runAutoPublishPipeline>[0])
  assert.equal(second.published, 0, 'second pass must publish 0')
  assert.equal(second.evaluated, 0)
})

test('respects custom thresholds via options', async () => {
  const rows: Row[] = [{ id: 'a', status: 'draft', ai_score: 50, title: 'ok', body: 'short body here' }]
  const res = await runAutoPublishPipeline(db(rows), { minScore: 40, minBodyChars: 5 })
  assert.equal(res.published, 1)
})

test('never throws on db error — returns errors in summary', async () => {
  const res = await runAutoPublishPipeline(db([], 'boom: connection lost'))
  assert.equal(res.published, 0)
  assert.equal(res.errors.length, 1)
  assert.match(res.errors[0], /boom/)
})
