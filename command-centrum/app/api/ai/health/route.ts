// POST /api/ai/health — ping a provider and log result
// GET  /api/ai/health — latest status per provider (last 50 pings)

import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import Groq from 'groq-sdk'

type HealthStatus = 'healthy' | 'degraded' | 'down'

type HealthResult = {
  provider:   string
  status:     HealthStatus
  latency_ms: number
  error?:     string
}

// ─── Ping helpers ─────────────────────────────────────────────────────────────

async function pingOpenAiCompat(
  id:      string,
  envKey:  string,
  model:   string,
  baseURL?: string,
): Promise<HealthResult> {
  const start = Date.now()
  const apiKey = process.env[envKey]

  if (!apiKey) {
    return { provider: id, status: 'down', latency_ms: 0, error: `${envKey} not set` }
  }

  try {
    const client = new OpenAI({ apiKey, baseURL })
    await client.chat.completions.create({
      model,
      max_tokens: 1,
      messages:   [{ role: 'user', content: 'ping' }],
    })
    const ms = Date.now() - start
    return { provider: id, status: ms > 3000 ? 'degraded' : 'healthy', latency_ms: ms }
  } catch (err) {
    return {
      provider:   id,
      status:     'down',
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : String(err),
    }
  }
}

async function pingGroq(): Promise<HealthResult> {
  const start = Date.now()
  if (!process.env.GROQ_API_KEY) {
    return { provider: 'groq', status: 'down', latency_ms: 0, error: 'GROQ_API_KEY not set' }
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    await groq.chat.completions.create({
      model:      'llama-3.1-8b-instant',
      max_tokens: 1,
      messages:   [{ role: 'user', content: 'ping' }],
    })
    const ms = Date.now() - start
    return { provider: 'groq', status: ms > 3000 ? 'degraded' : 'healthy', latency_ms: ms }
  } catch (err) {
    return {
      provider:   'groq',
      status:     'down',
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : String(err),
    }
  }
}

async function pingOllama(): Promise<HealthResult> {
  const start = Date.now()
  const base  = process.env.OLLAMA_URL ?? 'http://localhost:11434'
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const ms  = Date.now() - start
    if (!res.ok) return { provider: 'ollama', status: 'degraded', latency_ms: ms, error: `HTTP ${res.status}` }
    return { provider: 'ollama', status: ms > 3000 ? 'degraded' : 'healthy', latency_ms: ms }
  } catch (err) {
    return {
      provider:   'ollama',
      status:     'down',
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Provider ping registry ───────────────────────────────────────────────────

const PING_FNS: Record<string, () => Promise<HealthResult>> = {
  groq:           pingGroq,
  ollama_mistral: pingOllama,
  ollama_llama3:  pingOllama,
  gemini_flash:   () => pingOpenAiCompat(
    'gemini_flash',
    'GEMINI_API_KEY',
    'gemini-2.0-flash',
    'https://generativelanguage.googleapis.com/v1beta/openai/',
  ),
  deepseek:       () => pingOpenAiCompat(
    'deepseek',
    'DEEPSEEK_API_KEY',
    'deepseek-chat',
    'https://api.deepseek.com',
  ),
  openai_mini:    () => pingOpenAiCompat('openai_mini', 'OPENAI_API_KEY', 'gpt-4.1-mini'),
  openai_full:    () => pingOpenAiCompat('openai_full', 'OPENAI_API_KEY', 'gpt-4.1'),
  claude_haiku:   () => pingOpenAiCompat(
    'claude_haiku',
    'ANTHROPIC_API_KEY',
    'claude-haiku-4-5-20251001',
    'https://api.anthropic.com/v1',
  ),
}

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = createAdminClient() ?? authClient
  const body = await req.json().catch(() => ({})) as { provider?: string }
  const pid  = body.provider ?? 'gemini_flash'

  const pingFn = PING_FNS[pid]
  if (!pingFn) {
    return NextResponse.json({ provider: pid, status: 'healthy', latency_ms: 0 })
  }

  const result = await pingFn()

  await db.from('ai_health_logs').insert({
    provider:   result.provider,
    status:     result.status,
    latency_ms: result.latency_ms,
    error:      result.error ?? null,
  }).then(() => {}, () => {})

  return NextResponse.json(result)
}

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  const { data } = await db
    .from('ai_health_logs')
    .select('provider, status, latency_ms, error, checked_at')
    .order('checked_at', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
