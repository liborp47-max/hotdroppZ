import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan } from '@/lib/hd-central/types'
import { moveMissionToColdCase, normalizePlan } from '@/lib/hd-central/lifecycle'

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
    if (!plan) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }

    const normalized = normalizePlan(plan)
    if (!normalized.missions.some((mission) => mission.id === id)) {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    const next = moveMissionToColdCase(normalized, id)
    const planWithMeta: Plan = {
      ...next,
      updatedAt: new Date().toISOString(),
    }

    writePlan(planWithMeta)
    return NextResponse.json(planWithMeta)
  } catch (error) {
    console.error('[mission/cold-case] error:', error)
    return NextResponse.json({ error: 'Failed to move mission to cold case' }, { status: 500 })
  }
}
