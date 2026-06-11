import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import {
  readSnapshotDoc,
  readPlans,
  recordPlanSnapshot,
  diffSnapshots,
} from '@/lib/hd-central/quarterly-plan-snapshots'

// PLAN HQ — Quarterly Plan snapshot endpoints.
// Storage + diff helpers live in `lib/hd-central/quarterly-plan-snapshots.ts`
// (Next App Router only allows HTTP-handler exports from route.ts —
// AUD-20260523-01 build blocker fix).

// GET — list snapshots (?planId=...), or compare two (?compare=idA,idB).
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const url = new URL(request.url)
    const doc = readSnapshotDoc()

    const compare = url.searchParams.get('compare')
    if (compare) {
      const [idA, idB] = compare.split(',').map((s) => s.trim())
      const a = doc.snapshots.find((s) => s.id === idA)
      const b = doc.snapshots.find((s) => s.id === idB)
      if (!a || !b) {
        return NextResponse.json({ error: 'One or both snapshots not found' }, { status: 404 })
      }
      return NextResponse.json(diffSnapshots(a, b))
    }

    const planId = url.searchParams.get('planId')
    let snapshots = planId ? doc.snapshots.filter((s) => s.planId === planId) : doc.snapshots
    snapshots = [...snapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    return NextResponse.json({ version: doc.version, updatedAt: doc.updatedAt, snapshots })
  } catch (e) {
    console.error('[quarterly-plan/snapshots] GET error:', e)
    return NextResponse.json({ error: 'Failed to load snapshots' }, { status: 500 })
  }
}

// POST — manually capture a snapshot of a current plan (body: { planId, label? }).
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json()) as Record<string, unknown>
    const planId = typeof body?.planId === 'string' ? body.planId : ''
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }
    const plan = readPlans().find((p) => p.id === planId)
    if (!plan) {
      return NextResponse.json({ error: 'Quarterly plan not found' }, { status: 404 })
    }
    const label = typeof body.label === 'string' ? body.label : undefined
    const snapshot = recordPlanSnapshot(plan, 'manual', {
      planId: plan.id,
      quarter: plan.quarter,
      actor: auth.user.email ?? auth.user.id,
      label,
    })
    if (!snapshot) {
      return NextResponse.json({ error: 'Failed to capture snapshot' }, { status: 500 })
    }
    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (e) {
    console.error('[quarterly-plan/snapshots] POST error:', e)
    return NextResponse.json({ error: 'Failed to capture snapshot' }, { status: 500 })
  }
}
