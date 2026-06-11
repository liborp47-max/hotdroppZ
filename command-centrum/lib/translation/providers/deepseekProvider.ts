import OpenAI from 'openai'
import type { TranslationProvider, TranslationRequest, TranslationResponse } from './types'

export class DeepSeekProvider implements TranslationProvider {
  readonly name: string
  private readonly model: string

  constructor(model = 'deepseek-chat') {
    this.name  = `deepseek/${model}`
    this.model = model
  }

  isAvailable(): boolean {
    // DeepSeek is a paid API — disabled for translation (use Gemini/Groq instead)
    return false
  }

  async call(req: TranslationRequest): Promise<TranslationResponse> {
    const client = new OpenAI({
      apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
      baseURL: 'https://api.deepseek.com',
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

export const DEEPSEEK_CHAT = new DeepSeekProvider('deepseek-chat')
