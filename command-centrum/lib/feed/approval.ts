/**
 * Feed approval-stage helpers (UM-FEED_UI / #05).
 *
 * Encodes the three editorial verdicts and the schedule-aware approve rule:
 *   - approve  → publish now, OR keep scheduled when scheduled_at is future
 *   - reject   → return to draft
 *   - request_changes → return to draft with a changes_requested marker
 *
 * Pure module — no I/O, no framework imports — unit-testable in isolation.
 */

export type ApprovalAction = 'approve' | 'reject' | 'request_changes'
export type ReviewState = 'approved' | 'rejected' | 'changes_requested'

/** True when `action` is one of the three valid editorial verdicts. */
export function isValidApprovalAction(action: unknown): action is ApprovalAction {
  return action === 'approve' || action === 'reject' || action === 'request_changes'
}

export interface ApprovableTarget {
  scheduled_at?: string | null
}

export interface ApproveOutcome {
  /** New status to write on approval. */
  status: 'published' | 'scheduled'
  /** True when publication is deferred to the feed-publish cron. */
  deferred: boolean
}

/**
 * Decides what status an approved post should land in.
 *
 * If the post has a future `scheduled_at`, the approve verdict is recorded
 * but `status` stays `scheduled` — the feed-publish cron flips it to
 * `published` when the time arrives. Otherwise publish immediately.
 */
export function resolveApproveOutcome(
  post: ApprovableTarget,
  now: Date = new Date(),
): ApproveOutcome {
  if (post.scheduled_at) {
    const ms = Date.parse(post.scheduled_at)
    if (!Number.isNaN(ms) && ms > now.getTime()) {
      return { status: 'scheduled', deferred: true }
    }
  }
  return { status: 'published', deferred: false }
}
