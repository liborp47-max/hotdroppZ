import Groq from 'groq-sdk'
import type { TranslationProvider, TranslationRequest, TranslationResponse } from './types'

export class GroqProvider implements TranslationProvider {
  readonly name: string
  private client: Groq

  constructor(private readonly model: string) {
    this.name   = `groq/${model}`
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }

  isAvailable(): boolean {
    return Boolean(process.env.GROQ_API_KEY)
  }

  async call(req: TranslationRequest): Promise<TranslationResponse> {
    const res = await this.client.chat.completions.create({
      model:       this.model,
      temperature: 0.1,
      max_tokens:  req.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user',   content: req.userContent },
      ],
    })
    return {
      text:     res.choices[0]?.message?.content ?? '',
      tokens:   res.usage?.total_tokens ?? 0,
      provider: this.name,
    }
  }
}

// Singletons — instantiated once, reused across requests
export const GROQ_FAST   = new GroqProvider('llama-3.1-8b-instant')
export const GROQ_MEDIUM = new GroqProvider('llama-3.3-70b-versatile')
