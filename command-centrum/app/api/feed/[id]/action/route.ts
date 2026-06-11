import { NextResponse, NextRequest } from 'next/server'
import {
  approveFeedPost,
  rejectFeedPost,
  getFeedPost,
  updateFeedPost,
} from '@/lib/supabase/feed-admin'
import { isValidApprovalAction, resolveApproveOutcome } from '@/lib/feed/approval'

// PATCH /api/feed/[id]/action — editorial verdict (UM-FEED_UI / #05)
// Body: { action: 'approve'|'reject'|'request_changes', notes?, reason? }
//
//  - approve         → if scheduled_at is future, keep status='scheduled'
//                      (feed-publish cron publishes at the right time);
//                      otherwise publish immediately (existing behavior).
//  - reject          → status='draft', rejected_reason persisted.
//  - request_changes → status='draft', metadata.review_state='changes_requested',
//                      metadata.review_notes captures the editor's reason.
//
// JSON-fallback mock paths preserved for posts not yet in the DB.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const action = (body as { action?: unknown }).action

    if (!isValidApprovalAction(action)) {
      return NextResponse.json(
        { status: 'error', message: 'Unknown action — expected approve|reject|request_changes' },
        { status: 400 },
      )
    }

    const notes = typeof (body as { notes?: unknown }).notes === 'string'
      ? ((body as { notes: string }).notes)
      : ''
    const reason = typeof (body as { reason?: unknown }).reason === 'string'
      ? ((body as { reason: string }).reason)
      : ''

    // ── approve (schedule-aware) ────────────────────────────────────────────
    if (action === 'approve') {
      const current = await getFeedPost(id)
      const outcome = resolveApproveOutcome({ scheduled_at: current?.scheduled_at ?? null })

      if (outcome.deferred) {
        // Future-scheduled: record verdict but let the cron publish later.
        const nowIso = new Date().toISOString()
        const updated = await updateFeedPost(id, {
          approved_at: nowIso,
          approval_notes: notes,
          metadata: {
            ...(current?.metadata ?? {}),
            review_state: 'approved',
          },
        })
        if (updated) {
          return NextResponse.json({
            status: 'ok',
            post: updated,
            mode: 'scheduled_for_publish',
            scheduled_at: current?.scheduled_at ?? null,
          })
        }
        // Fallback — DB row not present (JSON-sourced post).
        return NextResponse.json({
          status: 'ok',
          post: {
            id,
            status: 'scheduled',
            approved_at: nowIso,
            approval_notes: notes,
            review_state: 'approved',
            source: 'json_fallback',
          },
          mode: 'scheduled_for_publish',
        })
      }

      // Immediate publish — existing behavior.
      const approved = await approveFeedPost(id, notes)
      if (approved) {
        return NextResponse.json({ status: 'ok', post: approved, mode: 'published' })
      }
      const nowIso = new Date().toISOString()
      return NextResponse.json({
        status: 'ok',
        post: {
          id,
          status: 'published',
          approved_at: nowIso,
          published_at: nowIso,
          approval_notes: notes,
          source: 'json_fallback',
        },
        mode: 'published',
      })
    }

    // ── reject ──────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { status: 'error', message: 'Rejection reason required' },
          { status: 400 },
        )
      }
      const rejected = await rejectFeedPost(id, reason)
      if (rejected) return NextResponse.json({ status: 'ok', post: rejected })
      return NextResponse.json({
        status: 'ok',
        post: {
          id,
          status: 'draft',
          rejected_at: new Date().toISOString(),
          rejected_reason: reason,
          source: 'json_fallback',
        },
      })
    }

    // ── request_changes ─────────────────────────────────────────────────────
    // Returns the post to 'draft' with a changes_requested marker in metadata
    // so the editor stage can surface the reviewer's notes.
    const changesReason = reason || notes
    if (!changesReason) {
      return NextResponse.json(
        { status: 'error', message: 'Reason required for request_changes' },
        { status: 400 },
      )
    }
    const current = await getFeedPost(id)
    const updated = await updateFeedPost(id, {
      status: 'draft',
      metadata: {
        ...(current?.metadata ?? {}),
        review_state: 'changes_requested',
        review_notes: changesReason,
      },
    })
    if (updated) return NextResponse.json({ status: 'ok', post: updated, mode: 'changes_requested' })
    return NextResponse.json({
      status: 'ok',
      post: {
        id,
        status: 'draft',
        review_state: 'changes_requested',
        review_notes: changesReason,
        source: 'json_fallback',
      },
      mode: 'changes_requested',
    })
  } catch (error) {
    console.error('PATCH /api/feed/[id]/action error:', error)
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 },
    )
  }
}
