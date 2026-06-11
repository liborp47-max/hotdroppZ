/**
 * Feed data hooks (TanStack Query). The Feed Engine (HDUA-05) renders these.
 * Cursor-based infinite query over the Content API; flatten pages for the list.
 */
import { useInfiniteQuery } from '@tanstack/react-query'

import { getFeed, getRecommended, getTrending, type FeedQuery } from '@/api/content'
import type { FeedItem } from '@/types'

export type FeedKind = 'latest' | 'trending' | 'recommended'

const fetchers = {
  latest: getFeed,
  trending: getTrending,
  recommended: getRecommended,
} as const

/** Infinite, cursor-paginated feed. `kind` switches the ranking source. */
export function useFeed(kind: FeedKind = 'latest', base: FeedQuery = {}) {
  const query = useInfiniteQuery({
    queryKey: ['feed', kind, base.type ?? null, base.category ?? null],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchers[kind]({ ...base, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const items: FeedItem[] = query.data?.pages.flatMap((p) => p.items) ?? []
  return { ...query, items }
}
