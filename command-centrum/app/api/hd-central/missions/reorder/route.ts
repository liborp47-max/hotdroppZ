import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import type { Mission } from '@/lib/hd-central/types'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

const OFFSET_TAIL = 1000 // Missions not in the reorder body land beyond this index.

const ReorderBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

async function triggerStateSync(request: Request): Promise<void> {
  try {
    const u = new URL(request.url)
    const base =
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? `${u.protocol}//${u.host}`
    const cookie = request.headers.get('cookie') ?? ''
    await fetch(`${base}/api/hd-central/pipeline-state/sync`, {
      method: 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}) },
    })
  } catch (e) {
    // Non-fatal — pipeline state will catch up on next sync interval.
    logger.warn('[missions/reorder] state sync trigger failed', { error: (e as Error).message })
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Body must be JSON' } },
      { status: 400 }
    )
  }

  const parsed = ReorderBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_body',
          message: 'ids must be a non-empty string array',
          details: parsed.error.issues,
        },
      },
      { status: 400 }
    )
  }
  const { ids } = parsed.data

  // No duplicates.
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      return NextResponse.json(
        { error: { code: 'duplicate_id', message: `Duplicate mission id: ${id}` } },
        { status: 400 }
      )
    }
    seen.add(id)
  }

  const plan = readPlan()
  if (!plan) {
    return NextResponse.json(
      { error: { code: 'plan_unavailable', message: 'plan.json not loaded' } },
      { status: 500 }
    )
  }

  // Every id must exist in plan.missions.
  const planIds = new Set(plan.missions.map((m) => m.id))
  for (const id of ids) {
    if (!planIds.has(id)) {
      return NextResponse.json(
        { error: { code: 'unknown_id', message: `Mission ${id} not in plan` } },
        { status: 400 }
      )
    }
  }

  // Build new ordering — explicit ids get 0..N, everything else keeps order shifted by OFFSET_TAIL.
  const now = new Date().toISOString()
  const actor = user.email ?? user.id
  const idToIndex = new Map<string, number>()
  ids.forEach((id, idx) => idToIndex.set(id, idx))

  // Apply the ordering atomically against a fresh in-lock read so a concurrent
  // edit can't be clobbered (AUD-DATA-001-PLUS).
  let nextPlan
  try {
    nextPlan = await mutatePlan((current) => {
      let tailCursor = OFFSET_TAIL
      current.missions = current.missions.map((m): Mission => {
        if (idToIndex.has(m.id)) {
          return { ...m, sequenceIndex: idToIndex.get(m.id)!, sequencedAt: now, sequencedBy: actor }
        }
        // Preserve relative order of non-reordered missions but push them past the reordered set.
        const existing = typeof m.sequenceIndex === 'number' ? m.sequenceIndex : tailCursor++
        return { ...m, sequenceIndex: existing < OFFSET_TAIL ? existing + OFFSET_TAIL : existing }
      })
    })
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json(
        { error: { code: 'plan_unavailable', message: 'plan.json not loaded' } },
        { status: 500 }
      )
    }
    logger.error('[missions/reorder] write failed', e)
    return NextResponse.json(
      { error: { code: 'write_failed', message: 'Failed to persist plan' } },
      { status: 500 }
    )
  }

  // Best-effort: sync pipeline state so dashboard sees the new ordering.
  await triggerStateSync(request)

  logger.info('hd_central_missions_reordered', {
    actor,
    updated: ids.length,
    total: nextPlan.missions.length,
  })

  return NextResponse.json({
    ok: true,
    updated: ids.length,
    plan: nextPlan,
  })
}
