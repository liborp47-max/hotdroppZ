import { NextResponse, type NextRequest } from 'next/server'
import { multilangTranslateFull } from '@/lib/pipeline/ai'

// POST /api/feed/translate
// On-demand per-post translation for the Feed editorial multilanguage stage.
// Body: { headline, content, summary?, languages: string[] }
// Returns: { variants: { [lang]: { headline, content, summary } } }
//
// Uses the centralized lib/pipeline/ai.ts multilangTranslateFull (Groq +
// fallback that returns the source text per language on model failure — so
// the route never crashes the editor UI on AI errors).
type TranslateBody = {
  headline?: string
  content?: string
  summary?: string
  languages?: string[]
}

// Languages the multilang pipeline currently supports beyond the EN source.
const SUPPORTED_TARGETS = new Set(['cs', 'de', 'pl', 'fr', 'es'])

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as TranslateBody | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const headline = typeof body.headline === 'string' ? body.headline : ''
    const content = typeof body.content === 'string' ? body.content : ''
    const summary = typeof body.summary === 'string' ? body.summary : ''

    if (!headline.trim() || !content.trim()) {
      return NextResponse.json(
        { error: 'headline and content are required (EN base must be filled before auto-translate)' },
        { status: 400 },
      )
    }

    // Filter target languages to non-EN + supported. EN is the source; never
    // overwrite the source variant with a model round-trip.
    const targets = Array.from(
      new Set(
        (Array.isArray(body.languages) ? body.languages : [])
          .map((l) => String(l).toLowerCase())
          .filter((l) => l !== 'en' && SUPPORTED_TARGETS.has(l)),
      ),
    )

    if (targets.length === 0) {
      return NextResponse.json({ variants: {} })
    }

    const result = await multilangTranslateFull(headline, summary, content, targets)

    const variants: Record<string, { headline: string; content: string; summary: string }> = {}
    for (const lang of targets) {
      const entry = result[lang]
      variants[lang] = {
        headline: entry?.title ?? headline,
        content: entry?.body ?? content,
        summary: entry?.summary ?? summary,
      }
    }

    return NextResponse.json({ variants })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'translate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
