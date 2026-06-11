import { Platform } from 'react-native'

import { supabase } from '@/lib/supabase'

/**
 * Lightweight engagement signal tracker (HDUA-09). Records post views + dwell +
 * scroll depth, batched and flushed to `hdua_post_views` (anonymous-friendly —
 * user_id is attached when signed in, else null). These signals feed the
 * recommended ranking (hdua_recommended_feed RPC) and analytics (HDUA-12).
 *
 * GDPR: respects a runtime opt-out flag; no PII beyond the (optional) user id.
 */
interface ViewEvent {
  post_id: string
  dwell_ms?: number
  scroll_pct?: number
}

const FLUSH_AFTER_MS = 4000
const FLUSH_AT_COUNT = 12

let queue: ViewEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let optedOut = false

export function setSignalsOptOut(value: boolean) {
  optedOut = value
}

export function trackView(postId: string, opts?: { dwellMs?: number; scrollPct?: number }) {
  if (optedOut || !postId) return
  queue.push({ post_id: postId, dwell_ms: opts?.dwellMs, scroll_pct: opts?.scrollPct })
  if (queue.length >= FLUSH_AT_COUNT) void flush()
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_AFTER_MS)
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!queue.length) return
  const batch = queue
  queue = []
  try {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id ?? null
    await supabase.from('hdua_post_views').insert(batch.map((e) => ({ ...e, user_id: uid })))
  } catch {
    // Best-effort telemetry — never block the UI or surface errors.
  }
}

// Flush in-flight signals when the web tab is hidden/closed.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}
