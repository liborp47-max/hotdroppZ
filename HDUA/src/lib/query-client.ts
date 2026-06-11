import { QueryClient } from '@tanstack/react-query'

/**
 * Shared TanStack Query client. Tuned for a content feed: data stays fresh for a
 * short window, retries are cheap, and refetch-on-focus is off (the feed has its
 * own realtime "new posts" signal — HDUA-05).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
