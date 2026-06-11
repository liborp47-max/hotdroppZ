/**
 * HDCC → HDUA realtime bridge (HDUA-02 sub05 / HDUA-05 sub04).
 *
 * Subscribes to the PUBLIC Supabase Realtime broadcast topic `hdua:feed`, which
 * the DB trigger `hdua_broadcast_new_feed_item` pushes to on every new
 * `feed_posts` row produced by the HDCC pipeline. Public topic = anon can
 * subscribe without weakening RLS on the raw table (content is read via the
 * SECURITY DEFINER `hdua_feed_items` view, never the table directly).
 *
 * Returns the count of new items seen since the last refresh and `flush()`,
 * which refetches the feed and clears the counter. The "X nových" pill in
 * FeedList drives off this.
 */
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

const FEED_TOPIC = 'hdua:feed'
const NEW_FEED_EVENT = 'new_feed_item'

export function useFeedRealtime(enabled = true) {
  const queryClient = useQueryClient()
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(FEED_TOPIC, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: NEW_FEED_EVENT }, () => {
        setNewCount((n) => n + 1)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled])

  const flush = useCallback(async () => {
    setNewCount(0)
    await queryClient.invalidateQueries({ queryKey: ['feed'] })
  }, [queryClient])

  return { newCount, flush }
}
