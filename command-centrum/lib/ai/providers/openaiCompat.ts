// Unified OpenAI-compatible provider — works for OpenAI, Gemini, and DeepSeek.
// All three expose an OpenAI-compatible chat completions endpoint.
import OpenAI from 'openai'
import type { AiProviderClient, AiCallOpts, AiCallResult } from './types'

type CompatConfig = {
  id:       string
  model:    string
  envKey:   string           // env var name that must be set
  baseURL?: string           // omit for standard OpenAI endpoint
}

class OpenAiCompatProvider implements AiProviderClient {
  readonly id: string
  private cfg: CompatConfig

  constructor(cfg: CompatConfig) {
    this.id  = cfg.id
    this.cfg = cfg
  }

  isAvailable(): boolean {
    return Boolean(process.env[this.cfg.envKey])
  }

  async call(system: string, user: string, opts?: AiCallOpts): Promise<AiCallResult> {
    const apiKey = process.env[this.cfg.envKey]
    if (!apiKey) throw new Error(`${this.cfg.id}: ${this.cfg.envKey} not set`)

    const client = new OpenAI({ apiKey, baseURL: this.cfg.baseURL })

    const res = await client.chat.completions.create({
      model:       this.cfg.model,
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

// ─── Singletons — one per provider+model ─────────────────────────────────────

export const GEMINI_FLASH = new OpenAiCompatProvider({
  id:      'gemini_flash',
  model:   'gemini-2.0-flash',
  envKey:  'GEMINI_API_KEY',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})

// DeepSeek disabled — 402 Insufficient Balance (paid API, no credits)
class DisabledProvider implements AiProviderClient {
  constructor(readonly id: string) {}
  isAvailable() { return false }
  async call(): Promise<AiCallResult> { throw new Error(`${this.id}: provider disabled`) }
}
export const DEEPSEEK = new DisabledProvider('deepseek')

export const OPENAI_MINI = new OpenAiCompatProvider({
  id:     'openai_mini',
  model:  'gpt-4.1-mini',
  envKey: 'OPENAI_API_KEY',
})

export const OPENAI_FULL = new OpenAiCompatProvider({
  id:     'openai_full',
  model:  'gpt-4.1',
  envKey: 'OPENAI_API_KEY',
})
