import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PipelineDeleteBar } from '@/components/shared/pipeline-delete-bar'
import { EnrichmentClient } from './enrichment-client'

export const dynamic = 'force-dynamic'

const MUSIC_CATEGORIES = ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap']
const VIDEO_CATEGORIES = ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap', 'culture', 'fun']

const CONFIG = {
  batchSize: 5,
  maxClusters: 300,
  musicCategories: MUSIC_CATEGORIES,
  videoCategories: VIDEO_CATEGORIES,
}

export default async function EnrichmentPage() {
  const authClient = await createClient()
  const db = createAdminClient() ?? authClient

  const [pending, done, error] = await Promise.all([
    db.from('story_clusters').select('*', { count: 'exact', head: true })
      .or('enrichment_status.is.null,enrichment_status.eq.pending'),
    db.from('story_clusters').select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'done'),
    db.from('story_clusters').select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'error'),
  ])

  const { data: clusters } = await db
    .from('story_clusters')
    .select(`
      id, main_entity, title, category,
      enrichment_status, enriched_at, created_at,
      artist_name, artist_id,
      spotify_url, youtube_url, genius_url, apple_music_url,
      image_url, selected_image_url,
      image_source, image_score, image_author, image_license,
      source_count, confidence
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <div className="px-5 pt-5">
        <PipelineDeleteBar mode="enrichment" />
      </div>
      <EnrichmentClient
        clusters={(clusters ?? []) as Parameters<typeof EnrichmentClient>[0]['clusters']}
        stats={{
          pending: pending.count ?? 0,
          done:    done.count    ?? 0,
          error:   error.count   ?? 0,
        }}
        config={CONFIG}
      />
    </>
  )
}
