import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STEP_CONFIGS } from '@/lib/ai/registry'
import { route, getReliabilitySnapshot, getScoresForStep } from '@/lib/ai/router'
import { recommendAllSteps } from '@/lib/ai/recommend'
import { aiCache } from '@/lib/ai/cache'
import type { AiStepKey } from '@/lib/ai/registry'

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const steps = STEP_CONFIGS.map((s) => ({
    step:      s.step,
    label:     s.label,
    decision:  route({ step: s.step }),
    scores:    getScoresForStep(s.step),
  }))

  return NextResponse.json({
    steps,
    // UM-AI_CONTROL / SM1 — per-step provider auto-recommendation.
    recommendation: recommendAllSteps(),
    reliability: getReliabilitySnapshot(),
    cache:       aiCache.stats(),
    timestamp:   new Date().toISOString(),
  })
}

// POST /api/ai/router — simulate a routing decision without executing
export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { step: AiStepKey; priority?: string; maxCost?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const decision = route({
    step:     body.step,
    priority: (body.priority as 'low' | 'normal' | 'high') ?? 'normal',
    maxCost:  (body.maxCost  as 'zero' | 'low' | 'any')   ?? 'low',
  })

  return NextResponse.json({
    decision,
    scores: getScoresForStep(body.step, (body.priority as 'low' | 'normal' | 'high') ?? 'normal'),
  })
}
