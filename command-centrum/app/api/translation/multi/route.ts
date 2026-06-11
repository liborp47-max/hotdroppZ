import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { multilangTranslateFull } from '@/lib/pipeline/ai'

const SUPPORTED_LANGUAGES = ['cs', 'de', 'fr', 'es', 'pl', 'it', 'pt', 'nl', 'tr']
const DEFAULT_LANGUAGES = ['cs', 'de', 'fr', 'es', 'pl', 'it', 'nl', 'ru']

export async function POST(req: Request) {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, summary, body: bodyField, text, languages } = parsed as {
    title?: string
    summary?: string
    body?: string
    text?: string
    languages?: string[]
  }

  // Accept either structured {title, summary, body} or legacy flat {text}
  const resolvedTitle = title || text || ''
  const resolvedSummary = summary || text || ''
  const resolvedBody = bodyField || text || ''

  if (!resolvedTitle.trim()) {
    return NextResponse.json({ error: 'title (or text) is required' }, { status: 400 })
  }

  const targetLanguages = Array.isArray(languages)
    ? languages.filter((l) => SUPPORTED_LANGUAGES.includes(l))
    : DEFAULT_LANGUAGES

  if (targetLanguages.length === 0) {
    return NextResponse.json(
      { error: `languages must be a non-empty array of: ${SUPPORTED_LANGUAGES.join(', ')}` },
      { status: 400 }
    )
  }

  const translations = await multilangTranslateFull(resolvedTitle, resolvedSummary, resolvedBody, targetLanguages)
  return NextResponse.json({ translations, languages: targetLanguages })
}
