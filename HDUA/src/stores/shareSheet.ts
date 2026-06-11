import { create } from 'zustand'

import type { FeedItem } from '@/types'

/** Controls the global ShareSheet. Any card/post calls `open(item)`. */
interface ShareSheetState {
  item: FeedItem | null
  open: (item: FeedItem) => void
  close: () => void
}

export const useShareSheet = create<ShareSheetState>((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}))
