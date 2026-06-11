import { createClient, createAdminClient } from '@/lib/supabase/server'
import { searchSpotify } from '../spotify'
import { searchYouTube } from '../youtube'
import {
  searchWikimedia,
  type WikimediaImage,
} from './wikimedia'
import {
  searchUnsplash,
  type UnsplashImage,
} from './unsplash'
import {
  searchPexels,
  type PexelsImage,
} from './pexels'
import {
  searchPixabay,
  type PixabayImage,
} from './pixabay'
import { enrichImage, type EnrichmentResult } from './engine'

export type ClusterInput = {
  cluster_id: string
  main_entity?: string | null
  title: string
  category: string
  content?: string | null
}

type SupabaseServerClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export async function findBestImageForCluster(
  input: ClusterInput
): Promise<EnrichmentResult> {
  // Use our priority-based image enrichment
  return enrichImage({
    main_entity: input.main_entity,
    title: input.title,
    category: input.category,
    content: input.content || undefined,
  })
}

export async function storeImageSelection(
  clusterId: string,
  result: EnrichmentResult,
  supabaseClient?: SupabaseServerClient
): Promise<void> {
  const db = supabaseClient || createAdminClient()
  if (!db) return

  try {
    await db.from('story_clusters').update({
      selected_image_url: result.image_url,
      image_source: result.source,
      image_score: result.relevance_score,
      image_author: result.author,
      image_license: result.license,
      image_selected_at: new Date().toISOString(),
      image_alternatives: result.alternatives,
    }).eq('id', clusterId)
  } catch (err) {
console.error('IMAGE STORE: failed for cluster', clusterId, err)
   }
 }

export async function enrichClusterImages(
  clusterIds: string[],
  supabaseClient?: SupabaseServerClient
): Promise<Map<string, { success: boolean; result?: EnrichmentResult; error?: string }>> {
  const results = new Map<string, { success: boolean; result?: EnrichmentResult; error?: string }>()
  const db = supabaseClient || createAdminClient()
  if (!db) return results

  // Fetch cluster data in batch
  const { data: clusters } = await db
    .from('story_clusters')
    .select('id, main_entity, title, category, merged_context')
    .in('id', clusterIds)

  if (!clusters) return results

  // Process each cluster (parallel with limit to avoid rate limits)
  const chunkSize = 3
  for (let i = 0; i < clusters.length; i += chunkSize) {
    const chunk = clusters.slice(i, i + chunkSize)

    const promises = chunk.map(async (cluster) => {
      try {
        const result = await findBestImageForCluster({
          cluster_id: cluster.id,
          main_entity: cluster.main_entity,
          title: cluster.title,
          category: cluster.category,
          content: cluster.merged_context?.[0] || undefined,
        })

        await storeImageSelection(cluster.id, result, db)

        results.set(cluster.id, { success: true, result })
      } catch (err) {
        results.set(cluster.id, {
          success: false,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    })

    await Promise.all(promises)
    // Small delay between chunks to respect API rate limits
    if (i + chunkSize < clusters.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}

export async function batchMatchImages(
  clusterIds: string[],
  supabaseClient?: SupabaseServerClient
): Promise<Map<string, { success: boolean; result?: EnrichmentResult; error?: string }>> {
  return enrichClusterImages(clusterIds, supabaseClient)
}
