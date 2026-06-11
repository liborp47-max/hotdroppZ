/**
 * Upstash Redis REST adapter — pluggable when UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN env vars are set. Otherwise factory returns null
 * and caller falls back to LruCacheAdapter.
 *
 * Wire format: Upstash REST API
 *   POST {URL}/  Body: ["GET","key"]              → { result: <string|null> }
 *   POST {URL}/  Body: ["SET","key","val","EX",60] → { result: "OK" }
 *   POST {URL}/  Body: ["DEL","key"]              → { result: <number> }
 *
 * Pattern delete (delPattern) uses SCAN + DEL pipeline. Conservative: scans
 * with COUNT 100, max 10 iterations to bound cost; missed keys expire by TTL.
 */

import type { CacheAdapter } from '../types.ts'

export interface UpstashConfig {
  url: string
  token: string
  /** Optional fetch implementation — injected for tests. */
  fetchImpl?: typeof fetch
}

export class UpstashAdapter implements CacheAdapter {
  private readonly url: string
  private readonly token: string
  private readonly fetchImpl: typeof fetch

  constructor(cfg: UpstashConfig) {
    this.url = cfg.url.replace(/\/$/, '')
    this.token = cfg.token
    this.fetchImpl = cfg.fetchImpl ?? fetch
  }

  private async exec(cmd: unknown[]): Promise<unknown> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cmd),
    })
    if (!res.ok) throw new Error(`Upstash ${cmd[0]} failed: ${res.status}`)
    const json = (await res.json()) as { result?: unknown; error?: string }
    if (json.error) throw new Error(`Upstash error: ${json.error}`)
    return json.result
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.exec(['GET', key])
      if (raw == null) return null
      return JSON.parse(raw as string) as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.exec(['SET', key, JSON.stringify(value), 'EX', ttlSeconds])
    } catch {
      // Soft-fail — caller can read from DB; cache miss is not fatal.
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.exec(['DEL', key])
    } catch {
      // soft-fail
    }
  }

  async delPattern(pattern: string): Promise<void> {
    let cursor = '0'
    let iterations = 0
    const collected: string[] = []
    try {
      do {
        const res = (await this.exec(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100])) as
          | [string, string[]]
          | null
        if (!Array.isArray(res)) break
        cursor = res[0]
        for (const k of res[1] ?? []) collected.push(k)
        iterations += 1
      } while (cursor !== '0' && iterations < 10)

      if (collected.length > 0) {
        await this.exec(['DEL', ...collected])
      }
    } catch {
      // soft-fail
    }
  }
}

/**
 * Factory — reads env vars and returns an UpstashAdapter or null.
 * Centralizes the "Redis present?" decision so call sites stay clean.
 */
export function createUpstashAdapterFromEnv(): UpstashAdapter | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new UpstashAdapter({ url, token })
}
