import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan } from '@/lib/hd-central/types'
import { deleteMission, normalizePlan } from '@/lib/hd-central/lifecycle'

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

export async function DELETE(
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
    if (!normalized.missions.some((mission) => mission.id === id && !mission.isDeleted)) {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    const next = deleteMission(normalized, id)
    const planWithMeta: Plan = {
      ...next,
      updatedAt: new Date().toISOString(),
    }

    writePlan(planWithMeta)
    return NextResponse.json(planWithMeta)
  } catch (error) {
    console.error('[mission/delete] error:', error)
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 })
  }
}