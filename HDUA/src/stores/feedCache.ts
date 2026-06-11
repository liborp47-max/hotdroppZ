import { create } from 'zustand'

import type { FeedItem } from '@/types'

/**
 * In-memory cache of feed items keyed by id. Lets the post detail screen render
 * the tapped item INSTANTLY (no loading spinner) from data the feed already has,
 * while the full post enriches in the background. The "no loadings" UX (HDUA-07).
 */
interface FeedCacheState {
  items: Record<string, FeedItem>
  put: (items: FeedItem[]) => void
  get: (id: string | undefined) => FeedItem | undefined
}

export const useFeedCache = create<FeedCacheState>((set, getState) => ({
  items: {},
  put: (incoming) =>
    set((s) => {
      const next = { ...s.items }
      for (const it of incoming) next[it.id] = it
      return { items: next }
    }),
  get: (id) => (id ? getState().items[id] : undefined),
}))
