import { NextResponse } from 'next/server'
import { moveMissionToColdCase, normalizePlan } from '@/lib/hd-central/lifecycle'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const plan = readPlan()
    if (!plan) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }

    if (!normalizePlan(plan).missions.some((mission) => mission.id === id)) {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    // Atomic, serialized move (re-reads + re-applies inside the lock).
    const updated = await mutatePlan((current) => moveMissionToColdCase(normalizePlan(current), id))
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[mission/cold-case] error:', error)
    return NextResponse.json({ error: 'Failed to move mission to cold case' }, { status: 500 })
  }
}
