import { create } from 'zustand'

/**
 * Which feed post is expanded (accordion — one at a time). Kept in a store rather
 * than per-card local state so FlashList cell recycling can't leak the expanded
 * state onto a different post. Tapping a post unrolls it inline; tapping again (or
 * another post) collapses it.
 */
interface FeedExpandState {
  expandedId: string | null
  toggle: (id: string) => void
  collapse: () => void
}

export const useFeedExpand = create<FeedExpandState>((set) => ({
  expandedId: null,
  toggle: (id) => set((s) => ({ expandedId: s.expandedId === id ? null : id })),
  collapse: () => set({ expandedId: null }),
}))
