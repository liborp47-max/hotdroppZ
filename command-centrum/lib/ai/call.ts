// Unified AI call entry point for all pipeline steps.
// Route → try providers in fallback chain → return text.
// Callers never know which provider ran.
import { route } from './router'
import type { AiStepKey } from './registry'
import type { AiCallOpts, AiProviderClient } from './providers/types'
import { GEMINI_FLASH, DEEPSEEK, OPENAI_MINI, OPENAI_FULL } from './providers/openaiCompat'
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'

// ─── Groq adapter ─────────────────────────────────────────────────────────────

class GroqProviderClient implements AiProviderClient {
  constructor(readonly id: string, private readonly model: string) {}

  isAvailable() { return Boolean(process.env.GROQ_API_KEY) }

  async call(system: string, user: string, opts?: AiCallOpts) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const res  = await groq.chat.completions.create({
      model:       this.model,
      max_tokens:  opts?.maxTokens   ?? 2048,
      temperature: opts?.temperature ?? 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    })
    return {
      text:   res.choices[0]?.message?.content?.trim() ?? '',
      tokens: res.usage?.total_tokens ?? 0,
    }
  }
}

// ─── Claude adapter (Anthropic SDK) ───────────────────────────────────────────

class ClaudeProviderClient implements AiProviderClient {
  constructor(readonly id: string, private readonly model: string) {}

  isAvailable() { return Boolean(process.env.ANTHROPIC_API_KEY) }

  async call(system: string, user: string, opts?: AiCallOpts) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model:      this.model,
      max_tokens: opts?.maxTokens ?? 2048,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
    return {
      text:   text.trim(),
      tokens: (res.usage.input_tokens ?? 0) + (res.usage.output_tokens ?? 0),
    }
  }
}

// ─── Passthrough — rule-based steps, no AI needed ────────────────────────────

class PassthroughClient implements AiProviderClient {
  constructor(readonly id: string) {}
  isAvailable() { return true }
  async call() { return { text: '', tokens: 0 } }
}

// ─── Client map ───────────────────────────────────────────────────────────────

const CLIENTS: Record<string, AiProviderClient> = {
  gemini_flash:   GEMINI_FLASH,
  deepseek:       DEEPSEEK,
  openai_mini:    OPENAI_MINI,
  openai_full:    OPENAI_FULL,
  groq:           new GroqProviderClient('groq',           'llama-3.3-70b-versatile'),
  groq_fast:      new GroqProviderClient('groq_fast',      'llama-3.1-8b-instant'),
  claude_haiku:   new ClaudeProviderClient('claude_haiku', 'claude-haiku-4-5-20251001'),
  claude_sonnet:  new ClaudeProviderClient('claude_sonnet','claude-sonnet-4-6'),
  rules:          new PassthroughClient('rules'),
  jaccard:        new PassthroughClient('jaccard'),
}

// ─── Token usage tracker ──────────────────────────────────────────────────────

export type AiUsage = {
  promptTokens:     number
  completionTokens: number
  totalTokens:      number
  calls:            number
  estimatedCostUsd: number
}

// Approximate cost per 1M tokens (input+output blended average)
const COST_PER_1M: Record<string, number> = {
  gemini_flash:  0.10,
  deepseek:      0.27,
  openai_mini:   0.15,
  openai_full:   2.00,
  groq:          0.05,
  groq_fast:     0.05,
  claude_haiku:  1.25,  // $0.80/1M in + $4/1M out, blended
  claude_sonnet: 6.00,  // $3/1M in + $15/1M out, blended
}

const DAILY_COST_ALERT_USD = parseFloat(process.env.DAILY_COST_ALERT_USD ?? '5.0')

let _usage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, estimatedCostUsd: 0 }
let _alertFired = false

export function getAiUsage(): AiUsage       { return { ..._usage } }
export function resetAiUsage(): void {
  _usage      = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, estimatedCostUsd: 0 }
  _alertFired = false
}

// ─── Priority by step ─────────────────────────────────────────────────────────

const STEP_PRIORITY: Record<AiStepKey, 'low' | 'normal' | 'high'> = {
  filter:       'normal',
  translation:  'normal',
  curator:      'high',
  cluster:      'low',
  writer:       'high',
  final_editor: 'normal',
  enrichment:   'low',
  feed:         'low',
  multilang:    'normal',
  monetizer:    'low',
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RATE_LIMIT_TERMS = ['429', 'rate limit', 'rate_limit', 'too many', 'quota', 'tpm', 'ratelimit']

function isRateLimit(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return RATE_LIMIT_TERMS.some(t => msg.includes(t))
}

async function callWithBackoff(
  client:     AiProviderClient,
  system:     string,
  user:       string,
  opts:       AiCallOpts | undefined,
  step:       string,
  providerId: string,
): Promise<{ text: string; tokens: number }> {
  let delay = 1500
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      return await client.call(system, user, opts)
    } catch (err) {
      const isQL = isRateLimit(err)
      if (attempt < 2 && isQL) {
        console.warn(`AI CALL: ${step}/${providerId} rate limited — retrying in ${delay}ms (attempt ${attempt + 1}/3)`)
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error(`${providerId}: all retries exhausted`)
}

// ─── callAI ──────────────────────────────────────────────────────────────────

export async function callAI(
  step:   AiStepKey,
  system: string,
  user:   string,
  opts?:  AiCallOpts,
): Promise<string> {
  const decision = route({ step, priority: STEP_PRIORITY[step] ?? 'normal' })

  for (const providerId of decision.fallbackChain) {
    const client = CLIENTS[providerId]
    if (!client || !client.isAvailable()) continue
    // Passthrough providers signal "no AI" — return empty so caller uses its own fallback
    if (providerId === 'rules' || providerId === 'jaccard') return ''

    try {
      const res = await callWithBackoff(client, system, user, opts, step, providerId)

      _usage.calls            += 1
      _usage.totalTokens      += res.tokens
      _usage.estimatedCostUsd += (res.tokens / 1_000_000) * (COST_PER_1M[providerId] ?? 0)

      if (!_alertFired && _usage.estimatedCostUsd >= DAILY_COST_ALERT_USD) {
        _alertFired = true
        console.warn(`[COST ALERT] Pipeline spend reached $${_usage.estimatedCostUsd.toFixed(3)} (threshold $${DAILY_COST_ALERT_USD}) — step: ${step}, provider: ${providerId}`)
      }

      return res.text
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`AI CALL: ${step}/${providerId} failed:`, errMsg)
      // Quota-exhausted providers: skip for the rest of this session
      if (errMsg.includes('quota') || errMsg.includes('billing') || errMsg.includes('Billing')) {
        console.error(`AI CALL: ${providerId} quota exhausted — removing from active rotation`)
      }
    }
  }

  console.error(`AI CALL: all providers failed for step "${step}"`)
  return ''
}

// ─── Cost log persistence ─────────────────────────────────────────────────────
// Call from pipeline route handlers after each run to persist spend in Supabase.
// pipeline_costs table schema: see supabase/schema-pipeline-costs.sql

type CostDb = { from: (table: string) => { insert: (row: object) => Promise<{ error: unknown }> } }

export async function flushCostLog(db: CostDb, runId?: string): Promise<void> {
  const snap = { ..._usage }
  if (snap.calls === 0) return
  try {
    await db.from('pipeline_costs').insert({
      run_id:             runId ?? null,
      date:               new Date().toISOString().split('T')[0],
      total_calls:        snap.calls,
      total_tokens:       snap.totalTokens,
      estimated_cost_usd: parseFloat(snap.estimatedCostUsd.toFixed(6)),
      recorded_at:        new Date().toISOString(),
    })
  } catch {
    // non-fatal — monitoring must never break the pipeline
  }
}
