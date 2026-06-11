// ─── AI Request Cache ──────────────────────────────────────────────────────────
// In-memory TTL cache for deduplicating identical AI requests.
// Scoped per Node.js process — survives route calls, resets on server restart.

const DEFAULT_TTL_MS = 30 * 60 * 1000  // 30 min
const MAX_ENTRIES    = 500

type CacheEntry<T> = {
  value: T
  expiresAt: number
  hits: number
}

class AICache {
  private store = new Map<string, CacheEntry<unknown>>()
  private _totalHits  = 0
  private _totalMisses = 0

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) { this._totalMisses++; return null }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this._totalMisses++
      return null
    }
    entry.hits++
    this._totalHits++
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    if (this.store.size >= MAX_ENTRIES) {
      // Evict the oldest key
      const first = this.store.keys().next().value
      if (first !== undefined) this.store.delete(first)
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, hits: 0 })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  invalidate(prefix: string): number {
    let count = 0
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) { this.store.delete(k); count++ }
    }
    return count
  }

  clear(): void {
    this.store.clear()
    this._totalHits   = 0
    this._totalMisses = 0
  }

  stats() {
    const total = this._totalHits + this._totalMisses
    return {
      size:      this.store.size,
      maxSize:   MAX_ENTRIES,
      hits:      this._totalHits,
      misses:    this._totalMisses,
      hitRate:   total > 0 ? this._totalHits / total : 0,
    }
  }

  // Build a deterministic cache key from an array of string parts.
  // Truncates to 220 chars — enough uniqueness for pipeline inputs.
  makeKey(parts: string[]): string {
    return parts.join('\x00').slice(0, 220)
  }
}

// Singleton — shared across all server-side route calls
export const aiCache = new AICache()
