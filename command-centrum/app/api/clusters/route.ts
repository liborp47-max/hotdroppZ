import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 30

// Map internal DB categories → spec output format
const CATEGORY_OUTPUT_MAP: Record<string, string> = {
  droppz_news: 'droppz_releases',
  rap_core:    'rap',
  deep_scout:  'rap',
  drama:       'drama',
  fashion:     'fashion',
  global_news: 'news',
  culture:     'culture',
  science:     'culture',
}

function normalizeCategory(raw: string): string {
  return CATEGORY_OUTPUT_MAP[raw] ?? raw
}

export async function GET(request: Request) {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const offset = Number(searchParams.get('offset') ?? '0')
  const status = searchParams.get('status') ?? 'pending'

  const { data: clusters, error: clustersError } = await authClient
    .from('story_clusters')
    .select('id, main_entity, category, title, confidence, source_count, max_attention_score, status, created_at, merged_context')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (clustersError) {
    return NextResponse.json({ error: clustersError.message }, { status: 500 })
  }

  if (!clusters?.length) {
    return NextResponse.json({ clusters: [], sources: {} })
  }

  const clusterIds = clusters.map((c) => c.id)

  const { data: sources, error: sourcesError } = await authClient
    .from('story_cluster_sources')
    .select('cluster_id, source_name, url, text_snippet, scout_item_id')
    .in('cluster_id', clusterIds)
    .order('created_at', { ascending: true })

  if (sourcesError) {
    return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  }

  const sourcesByCluster: Record<
    string,
    Array<{ source_name: string; url: string | null; text_snippet: string | null; scout_item_id: string }>
  > = {}

  for (const src of sources ?? []) {
    if (!sourcesByCluster[src.cluster_id]) sourcesByCluster[src.cluster_id] = []
    sourcesByCluster[src.cluster_id].push({
      source_name: src.source_name,
      url: src.url,
      text_snippet: src.text_snippet,
      scout_item_id: src.scout_item_id,
    })
  }

  const normalizedClusters = (clusters ?? []).map((c) => ({
    ...c,
    story_id: c.id,
    category: normalizeCategory(c.category),
  }))

  return NextResponse.json({ clusters: normalizedClusters, sources: sourcesByCluster })
}
