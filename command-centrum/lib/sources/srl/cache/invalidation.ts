/**
 * Event-driven cache invalidation.
 *
 * Spec: trigger v `sources` table → publish event → `invalidation.ts` clears
 * matching keys.
 *
 * Two integration shapes:
 *  1. Direct call from resolver after writes:
 *     `await invalidateForSource(cache, sourceId)`
 *  2. Supabase realtime / Postgres NOTIFY listener wired by an external runner
 *     that calls `handleSourceChangeEvent(cache, payload)`.
 *
 * In-process eventBus is exposed for the same-runtime fan-out (worker emits
 * change → REST handler clears its own LRU on the next tick).
 */

import { BundleCache, INVALIDATION_PATTERNS } from './bundle-cache.ts'

export interface SourceChangeEvent {
  sourceId: string
  changeType: 'insert' | 'update' | 'delete'
  reason?: string
}

type Listener = (ev: SourceChangeEvent) => void | Promise<void>

class SourceChangeBus {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async emit(ev: SourceChangeEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(ev)
      } catch {
        // Listener errors must never break the emitter — invalidation is best-effort.
      }
    }
  }

  /** Test helper — clear all listeners between tests. */
  reset(): void {
    this.listeners.clear()
  }

  size(): number {
    return this.listeners.size
  }
}

export const sourceChangeBus = new SourceChangeBus()

/** Wire a cache instance to auto-invalidate on emitted events. */
export function bindCacheToBus(cache: BundleCache, bus: SourceChangeBus = sourceChangeBus): () => void {
  return bus.subscribe((ev) => invalidateForSource(cache, ev.sourceId))
}

export async function invalidateForSource(cache: BundleCache, sourceId: string): Promise<void> {
  const patterns = INVALIDATION_PATTERNS.bySource(sourceId)
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      await cache.delPattern(pattern)
    } else {
      await cache.del(pattern)
    }
  }
}

export async function handleSourceChangeEvent(
  cache: BundleCache,
  payload: SourceChangeEvent,
): Promise<void> {
  await invalidateForSource(cache, payload.sourceId)
  await sourceChangeBus.emit(payload)
}
