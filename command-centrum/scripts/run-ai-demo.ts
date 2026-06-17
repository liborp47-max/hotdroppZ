/** temp: demonstrate real AI — run writer + feed (build+engine w/ localization), sample output. */
import { createClient } from '@supabase/supabase-js'
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
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({ email: 'admin@hotdroppz.com', password: '12345678' })
  if (error) throw new Error('auth: ' + error.message)

  // 1) Writer with real AI
  const { runWriterPipeline } = await import('@/lib/pipeline/writer')
  const w = await runWriterPipeline(sb as never)
  console.log('WRITER:', JSON.stringify({ generated: (w as unknown as Record<string, unknown>).articlesGenerated, inserted: (w as unknown as Record<string, unknown>).articlesInserted, errors: ((w as unknown as Record<string, unknown>).errors as unknown[])?.length }))

  // 2) Reset the 17 feed cards so the engine re-localizes them with the AI key
  await sb.from('feed_posts').update({ template_id: null, media_hint: null, card_metadata: null }).not('cluster_id', 'is', null)
  const { runFeedBuilderPipeline } = await import('@/lib/pipeline/feed-builder')
  const { runFeedEnginePipeline } = await import('@/lib/pipeline/feed-engine')
  await runFeedBuilderPipeline(sb as never)
  const fe = await runFeedEnginePipeline(sb as never)
  console.log('FEED:', JSON.stringify({ processed: (fe as unknown as Record<string, unknown>).processed, localized: (fe as unknown as Record<string, unknown>).localized, pass: (fe as unknown as Record<string, unknown>).validatedPass }))

  // 3) Sample a freshly written article
  const { data: posts } = await sb.from('posts').select('title, body, summary, created_at').order('created_at', { ascending: false }).limit(2)
  console.log('SAMPLE_POSTS=' + JSON.stringify(posts))

  // 4) Sample a localized feed card
  const { data: cards } = await sb.from('feed_posts').select('title, localized_versions').not('localized_versions', 'eq', '{}').limit(1)
  console.log('SAMPLE_LOCALIZED=' + JSON.stringify(cards).slice(0, 800))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
