import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { STEP_CONFIGS, enrichStepConfig } from '@/lib/ai/registry'
import { getSelectedProvider, setSelectedProvider } from '@/lib/ai/usage'

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  // Load all user-selected providers from DB
  const steps = await Promise.all(
    STEP_CONFIGS.map(async (config) => {
      const saved = await getSelectedProvider(db, config.step)
      return enrichStepConfig(config, saved ?? undefined)
    })
  )

  return NextResponse.json({ steps })
}

export async function PATCH(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  let body: { step: string; provider: string }
  try {
    body = await req.json() as { step: string; provider: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { step, provider } = body
  if (!step || !provider) {
    return NextResponse.json({ error: 'step and provider required' }, { status: 400 })
  }

  // Validate that the provider exists for this step
  const config = STEP_CONFIGS.find((c) => c.step === step)
  if (!config) return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 })

  const providerDef = config.providers.find((p) => p.id === provider)
  if (!providerDef) return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })

  await setSelectedProvider(db, step, provider)

  return NextResponse.json({
    ok: true,
    step,
    provider,
    message: `Switched ${step} → ${providerDef.displayName}`,
  })
}
