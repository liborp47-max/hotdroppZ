/** temp: confirm Groq key works via callAI('writer'). */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
function loadEnv(f: string) {
  if (!existsSync(f)) return
  for (const raw of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue
    const eq = l.indexOf('='); if (eq === -1) continue
    const k = l.slice(0, eq).trim(); let v = l.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && process.env[k] === undefined) process.env[k] = v
  }
}
async function main() {
  loadEnv(path.resolve(process.cwd(), '.env.local'))
  console.log('groq key present:', Boolean(process.env.GROQ_API_KEY))
  const { callAI } = await import('@/lib/ai/call')
  const t = Date.now()
  const out = await callAI('writer', 'You are a hip-hop journalist. Reply ONLY with JSON.',
    'Write a 2-sentence news blurb as JSON {"title":"...","body":"..."} about: Drake announces surprise album "For All The Dogs 2".',
    { maxTokens: 400 })
  console.log(`took ${Date.now() - t}ms, length ${out.length}`)
  console.log('OUTPUT:', out.slice(0, 500))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
