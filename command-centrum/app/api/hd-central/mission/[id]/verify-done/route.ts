import { NextResponse } from 'next/server'
import { verifyAndCompleteMission } from '@/lib/hd-central/lifecycle'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    // Pre-check for the 404 (don't write on a missing mission).
    const preview = verifyAndCompleteMission(plan, id)
    if (preview.outcome.kind === 'noop' && preview.outcome.reason === 'not_found') {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    // Re-run + persist atomically against a fresh in-lock read (AUD-DATA-001-PLUS).
    let outcome = preview.outcome
    const updated = await mutatePlan((current) => {
      const r = verifyAndCompleteMission(current, id)
      outcome = r.outcome
      return r.plan
    })
    return NextResponse.json({ outcome, plan: updated })
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[mission/verify-done] error:', e)
    return NextResponse.json({ error: 'Failed to verify mission' }, { status: 500 })
  }
}
