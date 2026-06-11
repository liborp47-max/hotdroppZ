import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

const PROMPTS_DIR = 'D:\\hot droppZ\\SYSTEM\\hotdroppz\\INTEL\\USED PROMPTS'

export async function POST(req: Request) {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, output } = await req.json()
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'Missing input' }, { status: 400 })
  }

  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true })
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `prompt-${timestamp}.md`
  const filepath = path.join(PROMPTS_DIR, filename)

  const content = [
    `# Prompt — ${now.toLocaleString('cs-CZ')}`,
    '',
    '## Input',
    input.trim(),
    '',
    '## Output',
    (output ?? '').trim() || '_no output_',
  ].join('\n')

  fs.writeFileSync(filepath, content, 'utf-8')

  return NextResponse.json({ ok: true, filename })
}
