import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan } from '@/lib/hd-central/types'
import { verifyAndCompleteMission } from '@/lib/hd-central/lifecycle'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return null
  }
}

function writePlan(plan: Plan) {
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8')
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const result = verifyAndCompleteMission(plan, id)
    if (result.outcome.kind === 'noop' && result.outcome.reason === 'not_found') {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    writePlan(result.plan)
    return NextResponse.json({ outcome: result.outcome, plan: result.plan })
  } catch (e) {
    console.error('[mission/verify-done] error:', e)
    return NextResponse.json({ error: 'Failed to verify mission' }, { status: 500 })
  }
}
