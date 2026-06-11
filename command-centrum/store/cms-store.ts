import { create } from 'zustand'
import type { Post, PostStatus } from '@/lib/types'

interface CmsState {
  posts: Post[]
  selectedIds: Set<string>
  activeFilter: PostStatus | 'all'
  focusedIndex: number
  pendingCount: number

  setPosts: (posts: Post[]) => void
  optimisticUpdateStatus: (id: string, status: PostStatus) => void
  optimisticBulkUpdateStatus: (ids: string[], status: PostStatus) => void
  toggleSelected: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelected: () => void
  setFilter: (filter: PostStatus | 'all') => void
  setFocusedIndex: (index: number) => void
  setPendingCount: (count: number) => void
}

export const useCmsStore = create<CmsState>((set) => ({
  posts: [],
  selectedIds: new Set(),
  activeFilter: 'all',
  focusedIndex: 0,
  pendingCount: 0,

  setPosts: (posts) => set({ posts }),

  optimisticUpdateStatus: (id, status) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === id
          ? {
              ...p,
              status,
              updated_at: new Date().toISOString(),
              published_at: status === 'published' ? new Date().toISOString() : p.published_at,
            }
          : p
      ),
    })),

  optimisticBulkUpdateStatus: (ids, status) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              status,
              updated_at: new Date().toISOString(),
              published_at: status === 'published' ? new Date().toISOString() : p.published_at,
            }
          : p
      ),
      selectedIds: new Set(),
    })),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedIds: next }
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelected: () => set({ selectedIds: new Set() }),

  setFilter: (filter) => set({ activeFilter: filter, selectedIds: new Set(), focusedIndex: 0 }),

  setFocusedIndex: (index) => set({ focusedIndex: index }),

  setPendingCount: (count) => set({ pendingCount: count }),
}))
