// GET /api/ai/prompts — returns active prompt registry (file-based source of truth)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROMPTS } from '@/lib/pipeline/prompts'

export async function GET() {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return all prompts with module classification
  const MODULE_MAP: Record<string, string> = {
    PIPELINE_TRANSLATION:  'translation',
    PUBLISHING_TRANSLATION: 'translation',
    TRANSLATOR:            'translation',
    CURATOR:               'curator',
    WRITER:                'writer',
    JOURNALIST_WRITER:     'writer',
    QUALITY_CHECK:         'writer',
    QUALITY_FIX:           'writer',
    LOCALIZER:             'multilang',
    MULTILANG_FULL:        'multilang',
    ENTITY_EXTRACTOR:      'enrichment',
    MONETIZER:             'monetizer',
  }

  const registry = Object.entries(PROMPTS)
    .filter(([, v]) => typeof v === 'string')
    .map(([key, text]) => ({
      key,
      module:      MODULE_MAP[key] ?? 'other',
      prompt_text: text as string,
      chars:       (text as string).length,
      source:      'file',
    }))

  return NextResponse.json(registry)
}
