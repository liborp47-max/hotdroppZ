import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  getAllReports,
  listExperiments,
  loadExperiments,
  persistExperiment,
  registerExperiment,
  removeExperiment,
} from '@/lib/ai/ab-testing'
import type { AbExperiment, AbObjective } from '@/lib/ai/ab-core'
import { STEP_CONFIGS, type AiStepKey } from '@/lib/ai/registry'

const OBJECTIVES: AbObjective[] = ['cost', 'latency', 'quality', 'balanced']

// GET /api/ai/ab-test — list experiments + their current reports.
export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Best-effort hydrate from ai_settings (non-fatal when DB absent).
  const db = createAdminClient()
  if (db) await loadExperiments(db as never)

  return NextResponse.json({
    experiments: listExperiments(),
    reports: getAllReports(),
    timestamp: new Date().toISOString(),
  })
}

// POST /api/ai/ab-test — create/update an experiment.
export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<AbExperiment>
  try {
    body = (await req.json()) as Partial<AbExperiment>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validation — never register a malformed experiment.
  const validSteps = new Set(STEP_CONFIGS.map((s) => s.step))
  if (!body.id || typeof body.id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!body.step || !validSteps.has(body.step as AiStepKey)) return NextResponse.json({ error: 'valid step required' }, { status: 400 })
  if (!body.control || !body.variant) return NextResponse.json({ error: 'control + variant provider ids required' }, { status: 400 })
  if (body.control === body.variant) return NextResponse.json({ error: 'control and variant must differ' }, { status: 400 })
  const splitPct = Number(body.splitPct)
  if (!Number.isFinite(splitPct) || splitPct < 0 || splitPct > 100) return NextResponse.json({ error: 'splitPct must be 0-100' }, { status: 400 })
  const objective: AbObjective = OBJECTIVES.includes(body.objective as AbObjective) ? (body.objective as AbObjective) : 'balanced'

  const exp: AbExperiment = {
    id: body.id,
    step: body.step as AiStepKey,
    control: body.control,
    variant: body.variant,
    splitPct,
    objective,
    active: body.active ?? true,
    minSamples: typeof body.minSamples === 'number' ? body.minSamples : undefined,
  }

  registerExperiment(exp)
  const db = createAdminClient()
  if (db) await persistExperiment(db as never, exp)

  return NextResponse.json({ ok: true, experiment: exp })
}

// DELETE /api/ai/ab-test?id=<id> — remove an experiment.
export async function DELETE(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  const removed = removeExperiment(id)
  return NextResponse.json({ ok: true, removed })
}
