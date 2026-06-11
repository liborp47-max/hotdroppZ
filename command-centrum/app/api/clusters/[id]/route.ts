import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/clusters/[id]
 * Fetch cluster by ID for analysis/preview
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: cluster, error } = await authClient
      .from('story_clusters')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !cluster) {
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(cluster)
  } catch (error) {
    console.error('[clusters] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cluster' },
      { status: 500 }
    )
  }
}
