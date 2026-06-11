/** Post detail hook (HDUA-07). Renders instantly from the feed cache (no loading
 * spinner), then enriches with the full post (body + related) in the background. */
import { useQuery } from '@tanstack/react-query'

import { getPost } from '@/api/content'
import { useFeedCache } from '@/stores/feedCache'
import type { Post } from '@/types'

export function usePost(id: string | undefined) {
  const seed = useFeedCache((s) => s.get(id))

  return useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id as string),
    enabled: !!id,
    // Instant render from the tapped feed item; full body fills in when ready.
    placeholderData: seed ? ({ ...seed, body: seed.content, related: [] } as Post) : undefined,
  })
}
