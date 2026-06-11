import Anthropic from '@anthropic-ai/sdk'
import type { JournalistOutput, StoryInput } from '@/lib/pipeline/ai'
import { WRITER_V2_SYSTEM } from '@/lib/pipeline/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export async function haikuWriteJournalistArticle(story: StoryInput): Promise<JournalistOutput> {
  const fallbackLong = story.merged_context.join('\n\n') || story.title
  const fallback: JournalistOutput = {
    title: story.title,
    short_version: story.title,
    long_version: fallbackLong,
    sections: [{ heading: 'Intro', content: fallbackLong }],
    key_points: [],
    tags: [story.category],
    media_hint: 'image',
    confidence: story.confidence,
  }

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const userMsg = `Write an article about: ${story.title}\n\nContext:\n${story.merged_context.slice(0, 3).join('\n\n')}\n\nRespond with JSON: {"long_version":"...","sections":[{"heading":"...","content":"..."}]}`

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system: WRITER_V2_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!text) return fallback

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback

    const parsed = JSON.parse(jsonMatch[0]) as Partial<JournalistOutput>
    return {
      title: parsed.title || story.title,
      short_version: parsed.short_version || story.title,
      long_version: parsed.long_version || fallbackLong,
      sections: Array.isArray(parsed.sections) && parsed.sections.length > 0
        ? parsed.sections
        : [{ heading: 'Intro', content: fallbackLong }],
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 6) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [story.category],
      media_hint: parsed.media_hint === 'video' ? 'video' : 'image',
      confidence: story.confidence,
    }
  } catch {
    return fallback
  }
}
