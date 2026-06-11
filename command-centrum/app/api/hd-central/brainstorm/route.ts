import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { logger } from '@/lib/logger'
import type { Plan } from '@/lib/hd-central/types'
import { generateBrainstorm } from '@/lib/hd-central/brainstorm'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan {
  if (!fs.existsSync(PLAN_FILE)) {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
    return { ...parsed, missions: Array.isArray(parsed.missions) ? parsed.missions : [] }
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
}

// POST /api/hd-central/brainstorm — generate AI upgrade suggestions for the
// CEO cockpit, filtered by the active Primary Mission and the current plan.
export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const body = (await request.json().catch(() => null)) as { count?: number } | null
    const plan = readPlan()
    const result = await generateBrainstorm(plan.missions, body?.count)

    logger.info('hd_central_brainstorm', {
      primaryMissionId: result.primaryMissionId,
      generated: result.suggestions.length,
      degraded: result.degraded,
      model: result.model,
    })

    return NextResponse.json(result)
  } catch (e) {
    // generateBrainstorm never throws, but readPlan / json parsing might —
    // keep the cockpit alive with an explicit degraded response.
    logger.error('[brainstorm] POST error', e)
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        primaryMissionId: null,
        suggestions: [],
        degraded: true,
        model: 'error-fallback',
      },
      { status: 200 },
    )
  }
}
