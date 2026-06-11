/**
 * Mock Supabase client for SRL unit tests.
 *
 * NOTE: avoids TS parameter properties (not supported by Node's
 * --experimental-strip-types). Plain field declarations only.
 */

import type { SrlDb } from '../lib/sources/srl/types.ts'

export type Row = Record<string, unknown>

interface QueryState {
  rows: Row[]
}

class MockQueryBuilder implements PromiseLike<{ data: Row[]; error: null }> {
  private state: QueryState

  constructor(state: QueryState) {
    this.state = state
  }

  select(_columns?: string): this {
    return this
  }

  eq(col: string, val: unknown): this {
    this.state.rows = this.state.rows.filter((r) => r[col] === val)
    return this
  }

  in(col: string, vals: unknown[]): this {
    const set = new Set(vals)
    this.state.rows = this.state.rows.filter((r) => set.has(r[col]))
    return this
  }

  ilike(col: string, pattern: string): this {
    const re = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, '.*')
          .replace(/_/g, '.') +
        '$',
      'i',
    )
    this.state.rows = this.state.rows.filter(
      (r) => typeof r[col] === 'string' && re.test(r[col] as string),
    )
    return this
  }

  gte(col: string, val: unknown): this {
    this.state.rows = this.state.rows.filter((r) => {
      const v = r[col]
      if (typeof v === 'number' && typeof val === 'number') return v >= val
      if (typeof v === 'string' && typeof val === 'string') return v >= val
      return false
    })
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    const desc = opts?.ascending === false
    this.state.rows = [...this.state.rows].sort((a, b) => {
      const av = a[col]
      const bv = b[col]
      if (av === bv) return 0
      const cmp = (av as number | string) > (bv as number | string) ? 1 : -1
      return desc ? -cmp : cmp
    })
    return this
  }

  limit(n: number): this {
    this.state.rows = this.state.rows.slice(0, n)
    return this
  }

  // Added for Intel query tests — additive, doesn't change SRL behavior
  lte(col: string, val: unknown): this {
    this.state.rows = this.state.rows.filter((r) => {
      const v = r[col]
      if (typeof v === 'number' && typeof val === 'number') return v <= val
      if (typeof v === 'string' && typeof val === 'string') return v <= val
      return false
    })
    return this
  }

  range(from: number, to: number): this {
    this.state.rows = this.state.rows.slice(from, to + 1)
    return this
  }

  /**
   * Mock or() — Supabase syntax `col.op.val,col.op.val` is complex to parse
   * deterministically; for tests we treat it as a permissive pass-through
   * (no filtering applied). Tests should verify with positive filters first.
   */
  or(_expression: string): this {
    return this
  }

  then<TResult1 = { data: Row[]; error: null; count: number }>(
    onFulfilled?:
      | ((value: { data: Row[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1> {
    const result = { data: this.state.rows, error: null as null, count: this.state.rows.length }
    return Promise.resolve(result).then(onFulfilled ?? ((v) => v as unknown as TResult1))
  }
}

class MockTableHandler {
  private store: Map<string, Row[]>
  private inserts: Map<string, Row[]>
  private table: string

  constructor(store: Map<string, Row[]>, inserts: Map<string, Row[]>, table: string) {
    this.store = store
    this.inserts = inserts
    this.table = table
  }

  select(_columns?: string, _opts?: { count?: 'exact' | 'planned' | 'estimated' }): MockQueryBuilder {
    return new MockQueryBuilder({ rows: [...(this.store.get(this.table) ?? [])] })
  }

  insert(row: Row | Row[]): MockQueryBuilder {
    const list = Array.isArray(row) ? row : [row]
    const bucket = this.inserts.get(this.table) ?? []
    for (const r of list) bucket.push(r)
    this.inserts.set(this.table, bucket)
    return new MockQueryBuilder({ rows: list })
  }
}

export class MockDb {
  private store: Map<string, Row[]> = new Map()
  private inserts: Map<string, Row[]> = new Map()
  public fromCalls: string[] = []

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [k, v] of Object.entries(seed)) this.store.set(k, v)
  }

  from(table: string): MockTableHandler {
    this.fromCalls.push(table)
    if (!this.store.has(table)) this.store.set(table, [])
    return new MockTableHandler(this.store, this.inserts, table)
  }

  rpc(_name: string, _args?: unknown): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null })
  }

  insertsFor(table: string): Row[] {
    return this.inserts.get(table) ?? []
  }

  asSrlDb(): SrlDb {
    return this as unknown as SrlDb
  }
}

export class ThrowingMissingTableDb {
  private existingTables: Set<string>

  constructor(existingTables: Set<string>) {
    this.existingTables = existingTables
  }

  from(table: string): MockTableHandler | { select: () => never; insert: () => never } {
    if (!this.existingTables.has(table)) {
      const err = () => {
        throw new Error(`relation "${table}" does not exist`)
      }
      return { select: err, insert: err }
    }
    const store = new Map<string, Row[]>([[table, []]])
    const inserts = new Map<string, Row[]>()
    return new MockTableHandler(store, inserts, table)
  }

  rpc(_name: string, _args?: unknown): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null })
  }

  asSrlDb(): SrlDb {
    return this as unknown as SrlDb
  }
}
