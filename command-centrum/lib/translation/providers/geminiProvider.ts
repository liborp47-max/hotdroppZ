import OpenAI from 'openai'
import type { TranslationProvider, TranslationRequest, TranslationResponse } from './types'

export class GeminiProvider implements TranslationProvider {
  readonly name: string
  private readonly model: string

  constructor(model = 'gemini-2.0-flash') {
    this.name  = `gemini/${model}`
    this.model = model
  }

  isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY)
  }

  async call(req: TranslationRequest): Promise<TranslationResponse> {
    const client = new OpenAI({
      apiKey:  process.env.GEMINI_API_KEY ?? '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })

    const res = await client.chat.completions.create({
      model:       this.model,
      temperature: 0.1,
      max_tokens:  req.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user',   content: req.userContent  },
      ],
    })

    return {
      text:     res.choices[0]?.message?.content ?? '',
      tokens:   res.usage?.total_tokens ?? 0,
      provider: this.name,
    }
  }
}

export const GEMINI_FLASH = new GeminiProvider('gemini-2.0-flash')
