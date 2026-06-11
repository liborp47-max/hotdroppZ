/**
 * In-memory LRU cache — primary path when Redis is unavailable.
 *
 * Spec hard rule: SRL must be fast (< 50ms p95) i bez Redis dostupnosti.
 * This implementation backs the default CacheAdapter and serves as fallback
 * when Upstash adapter detects no creds in env.
 *
 * Map preserves insertion order — re-inserting on get() implements LRU.
 */

import type { CacheAdapter } from '../types.ts'

interface Entry<T> {
  value: T
  expiresAt: number
}

export interface LruOptions {
  /** Max number of entries before eviction. Default 1000. */
  maxEntries?: number
  /** Time provider — injectable for tests. */
  now?: () => number
}

export class LruCacheAdapter implements CacheAdapter {
  private readonly map = new Map<string, Entry<unknown>>()
  private readonly maxEntries: number
  private readonly now: () => number

  constructor(opts: LruOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 1000
    this.now = opts.now ?? (() => Date.now())
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key)
      return null
    }
    // Promote to most-recently-used
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = this.now() + ttlSeconds * 1000
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, expiresAt })
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  async del(key: string): Promise<void> {
    this.map.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    // Pattern uses Redis-style glob (* wildcard). Compile to RegExp.
    const re = globToRegex(pattern)
    for (const key of Array.from(this.map.keys())) {
      if (re.test(key)) this.map.delete(key)
    }
  }

  /** Test helper — current entry count after eviction of expired. */
  size(): number {
    return this.map.size
  }
}

export function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$')
}
