/**
 * Feed publish-calendar helpers (UM-FEED_UI / #04).
 *
 * Derives a single canonical `scheduled_at` from the calendar page's
 * per-platform schedule payload, and decides which posts are due for the
 * auto-publish cron. Pure module — no I/O, no framework imports —
 * unit-testable in isolation.
 */

export interface PlatformSchedule {
  /** YYYY-MM-DD date the post is scheduled for, per platform. */
  date?: string
  /** HH:MM 24h time, per platform. */
  time?: string
  timezone?: string
}

/** Calendar page payload: per-platform schedule entries keyed by platform id. */
export type ScheduleData = Record<string, PlatformSchedule>

/**
 * Derives a single ISO `scheduled_at` from per-platform schedule data —
 * the earliest valid date+time across platforms. Null when no entry parses.
 * Drives the cron query and the `feed_posts.scheduled_at` column.
 */
export function deriveScheduledAt(schedule: ScheduleData | null | undefined): string | null {
  if (!schedule) return null
  let earliestMs = Number.POSITIVE_INFINITY
  for (const entry of Object.values(schedule)) {
    if (!entry?.date) continue
    const time = entry.time && /^\d{2}:\d{2}/.test(entry.time) ? entry.time : '00:00'
    const iso = `${entry.date}T${time}:00`
    const ms = Date.parse(iso)
    if (!Number.isNaN(ms) && ms < earliestMs) earliestMs = ms
  }
  return Number.isFinite(earliestMs) ? new Date(earliestMs).toISOString() : null
}

export interface PublishablePost {
  status?: string | null
  scheduled_at?: string | null
  published_at?: string | null
}

/**
 * True when a post is scheduled, its `scheduled_at` has arrived, and it has
 * not already been published. The cron uses the SQL form of this predicate.
 */
export function isPublishDue(post: PublishablePost, now: Date = new Date()): boolean {
  if (post.status !== 'scheduled') return false
  if (post.published_at) return false
  if (!post.scheduled_at) return false
  const ms = Date.parse(post.scheduled_at)
  return !Number.isNaN(ms) && ms <= now.getTime()
}

/** Filters a list of posts to those the cron should publish on `now`. */
export function selectDuePosts<T extends PublishablePost>(posts: T[], now: Date = new Date()): T[] {
  return posts.filter((p) => isPublishDue(p, now))
}
