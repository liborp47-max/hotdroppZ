import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { writeJournalistArticle } from '@/lib/pipeline/ai'
import type { StoryInput } from '@/lib/pipeline/ai'

export async function POST(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient

  const { postId, tone, length } = await request.json() as {
    postId: string
    tone?: string
    length?: 'short' | 'medium' | 'long'
  }

  if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })

  // Fetch the post
  const { data: post, error: postErr } = await db
    .from('posts')
    .select('id, title, body, summary, short_text, category, tags, cluster_id, source_name, content_structured')
    .eq('id', postId)
    .single()

  if (postErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Try to get cluster context
  let mergedContext: string[] = []
  let mainEntity = post.title
  let confidence = 0.8

  if (post.cluster_id) {
    const { data: cluster } = await db
      .from('story_clusters')
      .select('main_entity, merged_context, confidence, source_count')
      .eq('id', post.cluster_id)
      .single()
    if (cluster) {
      mergedContext = cluster.merged_context ?? []
      mainEntity = cluster.main_entity ?? post.title
      confidence = cluster.confidence ?? 0.8
    }
  }

  // Fall back to existing body if no cluster
  if (mergedContext.length === 0) {
    const body = post.body ?? post.summary ?? post.title
    mergedContext = body.split(/\n+/).filter((s: string) => s.trim().length > 20).slice(0, 10)
    if (mergedContext.length === 0) mergedContext = [body]
  }

  // Apply tone/length override to category if specified
  const categoryOverride = tone === 'hype'       ? 'droppz'
    : tone === 'analytical' ? 'eu_rap'
    : tone === 'editorial'  ? 'fashion'
    : tone === 'street'     ? 'eu_rap'
    : (post.category as string | null) ?? 'eu_rap'

  const storyInput: StoryInput = {
    cluster_id: post.cluster_id ?? post.id,
    main_entity: mainEntity,
    category: categoryOverride,
    title: post.title,
    sources: post.source_name ? [{ source: post.source_name, url: null, text: null }] : [],
    merged_context: mergedContext,
    confidence,
  }

  const start = Date.now()
  try {
    const result = await writeJournalistArticle(storyInput)

    // Log to editorial_operations
    void db.from('editorial_operations').insert({
      post_id: postId,
      operation: 'rewrite',
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      tone,
      length_target: length,
      latency_ms: Date.now() - start,
      status: 'success',
    })

    return NextResponse.json({
      title: result.title,
      body: result.long_version,
      short_text: result.short_version,
      sections: result.sections,
      key_points: result.key_points,
      tags: result.tags,
      confidence: result.confidence,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Rewrite failed'
    void db.from('editorial_operations').insert({
      post_id: postId,
      operation: 'rewrite',
      provider: 'groq',
      tone,
      latency_ms: Date.now() - start,
      status: 'error',
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
