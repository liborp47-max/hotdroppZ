import { create } from 'zustand'

import { getMyInteractions, toggleLike as apiToggleLike, toggleSave as apiToggleSave } from '@/api/user'

/**
 * The signed-in user's like/save state for feed posts (HDUA-14 sub03). Hydrated
 * once on sign-in (AuthProvider calls `hydrate`) so the feed action bar reflects
 * server truth instead of resetting on every cell recycle. Toggles are
 * optimistic with rollback on failure; the actual writes go through the
 * RLS-protected `hdua_liked_posts` / `hdua_saved_posts` tables.
 *
 * Callers must gate on auth themselves (see RequireAuth / the feed action bar) —
 * a toggle while signed out throws from the API and is rolled back here.
 */
interface InteractionsState {
  liked: Set<string>
  saved: Set<string>
  hydrated: boolean
  isLiked: (postId: string) => boolean
  isSaved: (postId: string) => boolean
  hydrate: () => Promise<void>
  /** Clears local state on sign-out. */
  reset: () => void
  toggleLike: (postId: string) => Promise<void>
  toggleSave: (postId: string) => Promise<void>
}

function withToggled(s: Set<string>, id: string): Set<string> {
  const next = new Set(s)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export const useInteractions = create<InteractionsState>((set, get) => ({
  liked: new Set(),
  saved: new Set(),
  hydrated: false,

  isLiked: (postId) => get().liked.has(postId),
  isSaved: (postId) => get().saved.has(postId),

  hydrate: async () => {
    try {
      const { liked, saved } = await getMyInteractions()
      set({ liked: new Set(liked), saved: new Set(saved), hydrated: true })
    } catch {
      // Non-fatal — the action bar just starts from an empty (un-liked) state.
      set({ hydrated: true })
    }
  },

  reset: () => set({ liked: new Set(), saved: new Set(), hydrated: false }),

  toggleLike: async (postId) => {
    const wasLiked = get().liked.has(postId)
    set((s) => ({ liked: withToggled(s.liked, postId) }))
    try {
      await apiToggleLike(postId, !wasLiked)
    } catch (e) {
      set((s) => ({ liked: withToggled(s.liked, postId) })) // rollback
      throw e
    }
  },

  toggleSave: async (postId) => {
    const wasSaved = get().saved.has(postId)
    set((s) => ({ saved: withToggled(s.saved, postId) }))
    try {
      await apiToggleSave(postId, !wasSaved)
    } catch (e) {
      set((s) => ({ saved: withToggled(s.saved, postId) })) // rollback
      throw e
    }
  },
}))
