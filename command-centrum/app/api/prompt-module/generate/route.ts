import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type TargetModule = 'CEO' | 'Planning' | 'Auditor' | 'Intel' | 'Analytics' | 'Global UI'

function inferTargetModule(text: string): TargetModule {
  const value = text.toLowerCase()

  if (/audit|rizik|compliance|blocker/.test(value)) return 'Auditor'
  if (/intel|ingest|run|error|source|changes|event/.test(value)) return 'Intel'
  if (/report|metrik|kpi|analytics|analy/.test(value)) return 'Analytics'
  if (/plan|timeline|mission|roadmap|checkpoint/.test(value)) return 'Planning'
  if (/ui|menu|sidebar|layout|okno|button/.test(value)) return 'Global UI'
  return 'CEO'
}

function buildOutput(input: string) {
  const cleanInput = input.trim().replace(/\s+/g, ' ')
  const targetModule = inferTargetModule(cleanInput)

  const missing: string[] = []
  if (cleanInput.length < 20) missing.push('Upresni cil a pozadovany vystup.')
  if (!/\b(vytvor|uprav|pridej|zmen|postav|implementuj|analyzuj|navrhni|zkontroluj)\b/i.test(cleanInput)) {
    missing.push('Chybi jasna akce (napr. vytvor / uprav / implementuj).')
  }

  const risks = [
    'Nesoulad s Primary Mission a aktualnim Planem.',
    'Zmena muze rozbit stabilni casti bez migrace.',
  ]

  const notes = missing.length > 0
    ? `[MISSING]\n- ${missing.join('\n- ')}`
    : 'none'

  const output = [
    `Task Goal: ${cleanInput}`,
    `Target Module: ${targetModule}`,
    '',
    'Prompt:',
    'Jsi HDCC vykonny modul. Proved task striktne podle zadani a zachovej soulad s Primary Mission a Planem.',
    `Zadani: ${cleanInput}`,
    'Pozadovany vystup:',
    '- konkretni kroky implementace',
    '- dopad na existujici casti systemu',
    '- rizika a navrh mitigace',
    '- stop podminky (kdy akci zastavit)',
    '',
    'Quality Rules:',
    '- Nevymyslej funkce mimo scope.',
    '- Pri nejasnosti vrat upresnujici otazky.',
    '- Pokud je konflikt s Primary Mission, oznac: [CONFLICT].',
    '',
    'Notes:',
    notes,
    '',
    'Risks:',
    `- ${risks[0]}`,
    `- ${risks[1]}`,
  ].join('\n')

  return {
    output,
    targetModule,
    qualityScore: missing.length > 0 ? 0.62 : 0.88,
    missing,
  }
}

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { input?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body.input?.trim()
  if (!input) {
    return NextResponse.json({ error: 'Missing input' }, { status: 400 })
  }

  const result = buildOutput(input)
  return NextResponse.json(result)
}
