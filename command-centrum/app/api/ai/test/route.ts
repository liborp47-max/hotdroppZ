import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STEP_CONFIGS, enrichStepConfig, detectProviderStatus } from '@/lib/ai/registry'
import { getSelectedProvider, logUsage } from '@/lib/ai/usage'
import { createAdminClient } from '@/lib/supabase/server'
import { checkOllamaHealth } from '@/lib/ai/ollama'

export type TestResult = {
  step: string
  provider: string
  model?: string
  status: 'working' | 'slow' | 'failed' | 'not-configured'
  latency_ms: number
  message: string
}

async function testGroq(model: string): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { ok: false, latency_ms: 0, error: 'GROQ_API_KEY not set' }

  const start = Date.now()
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model,
        max_tokens: 8,
        temperature: 0,
        messages: [{ role: 'user', content: 'Reply with: {"ok":true}' }],
      }),
    })
    const latency_ms = Date.now() - start
    if (!res.ok) return { ok: false, latency_ms, error: `HTTP ${res.status}` }
    return { ok: true, latency_ms }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
  }
}


async function testLibreTranslate(url: string): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const start = Date.now()
  try {
    const res = await fetch(`${url}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ q: 'hello', source: 'en', target: 'es' }),
    })
    const latency_ms = Date.now() - start
    if (!res.ok) return { ok: false, latency_ms, error: `HTTP ${res.status}` }
    return { ok: true, latency_ms }
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
  }
}

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  let body: { step: string }
  try {
    body = await req.json() as { step: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const config = STEP_CONFIGS.find((c) => c.step === body.step)
  if (!config) return NextResponse.json({ error: `Unknown step: ${body.step}` }, { status: 400 })

  const savedProvider = await getSelectedProvider(db, config.step)
  const enriched = enrichStepConfig(config, savedProvider ?? undefined)
  const provider = enriched.activeProvider

  // Check availability before testing
  const status = detectProviderStatus(provider)
  if (status === 'not-configured' || status === 'disabled') {
    const result: TestResult = {
      step:     config.step,
      provider: provider.id,
      model:    provider.model,
      status:   'not-configured',
      latency_ms: 0,
      message: `${provider.displayName} is not configured. ${provider.requiresEnv ? `Set: ${provider.requiresEnv.join(', ')}` : ''}${provider.requiresLocal ? `Set: ${provider.requiresLocal}` : ''}`,
    }
    return NextResponse.json(result)
  }

  // Rule-based / local — instant success
  if (provider.type === 'local-rules') {
    const result: TestResult = {
      step:      config.step,
      provider:  provider.id,
      status:    'working',
      latency_ms: 0,
      message:   `${provider.displayName} is always available (no AI, rule-based)`,
    }
    await logUsage(db, { step: config.step, provider: provider.id, requests: 1, latency_ms: 0, status: 'success' })
    return NextResponse.json(result)
  }

  // Real provider tests
  let testOut: { ok: boolean; latency_ms: number; error?: string } = { ok: false, latency_ms: 0 }

  if (provider.id === 'groq') {
    testOut = await testGroq(provider.model ?? 'llama-3.1-8b-instant')
  } else if (provider.id.startsWith('ollama_')) {
    testOut = await checkOllamaHealth(provider.model ?? 'mistral:7b')
  } else if (provider.id === 'libretranslate') {
    const ltUrl = process.env.LIBRETRANSLATE_URL ?? 'http://localhost:5000'
    testOut = await testLibreTranslate(ltUrl)
  } else {
    testOut = { ok: false, latency_ms: 0, error: 'No test implemented for this provider' }
  }

  const testStatus: TestResult['status'] =
    !testOut.ok           ? 'failed'
    : testOut.latency_ms > 3000 ? 'slow'
    : 'working'

  const result: TestResult = {
    step:      config.step,
    provider:  provider.id,
    model:     provider.model,
    status:    testStatus,
    latency_ms: testOut.latency_ms,
    message: testOut.ok
      ? `${provider.displayName} responded in ${testOut.latency_ms}ms`
      : (testOut.error ?? 'Test failed'),
  }

  await logUsage(db, {
    step:       config.step,
    provider:   provider.id,
    model:      provider.model,
    requests:   1,
    latency_ms: testOut.latency_ms,
    status:     testOut.ok ? 'success' : 'error',
    error:      testOut.error,
  })

  return NextResponse.json(result)
}
