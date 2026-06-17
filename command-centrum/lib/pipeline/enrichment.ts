import { createAdminClient, createClient } from '../supabase/server'
import { searchSpotify } from '../services/spotify'
import { searchYouTube } from '../services/youtube'
import { searchGenius } from '../services/genius'
import { searchAppleMusic } from '../services/apple-music'
import { findOrCreateArtist, trackArtistRelease } from '../services/artist-service'
import { enrichImage, isArtistMusicContent, spotifyArtistMatches } from '../services/image'
import { logStageStart, logStageComplete } from '../analytics/collector'
import { logger } from '../logger'
import { createSourceResolver, srlHandlesToUrls, type SrlDb, type PlatformLinks, type SourceResolver } from '../sources/srl'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

type ClusterForEnrichment = {
  id: string
  main_entity: string
  category: string
  title: string
  merged_context: string[]
  // Optional enrichment fields (may be null until filled)
  artist_name?: string | null
  artist_id?: string | null
  spotify_url?: string | null
  youtube_url?: string | null
  genius_url?: string | null
  apple_music_url?: string | null
  image_url?: string | null
}

export interface EnrichmentResult {
  processed: number
  enriched: number
  skipped: number
}

// Categories where music-link enrichment (Spotify / Genius / Apple Music) is relevant
const MUSIC_CATEGORIES = new Set(['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap'])

// Categories where video enrichment is relevant
const VIDEO_CATEGORIES = new Set(['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap', 'culture', 'fun'])

// Process 5 clusters at a time — raised limit fetches up to 300 clusters
const BATCH_SIZE = 5

function extractTrackFromTitle(title: string, artist: string): string | undefined {
  // "Artist - Track" or "Artist: Track"
  const sep = /\s[-:|]\s/
  const parts = title.split(sep)
  if (parts.length >= 2) {
    const candidate = parts.find((p) => !p.toLowerCase().includes(artist.toLowerCase().slice(0, 5)))
    return candidate?.trim()
  }
  return undefined
}

function buildGeniusQuery(cluster: ClusterForEnrichment): string {
  const artist = cluster.main_entity
  const track = extractTrackFromTitle(cluster.title, artist)

  if (track) return `${artist} ${track}`

  // Fuzzy: strip artist name from title, use remaining words as search context
  const cleaned = cluster.title
    .replace(new RegExp(artist, 'gi'), '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')

  return cleaned ? `${artist} ${cleaned}` : artist
}

function buildYouTubeQuery(cluster: ClusterForEnrichment): string {
  const artist = cluster.main_entity
  const titleWords = cluster.title
    .replace(new RegExp(artist, 'gi'), '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')

  if (MUSIC_CATEGORIES.has(cluster.category)) {
    return titleWords ? `${artist} ${titleWords} official video` : `${artist} official video`
  }

  return `${artist} ${titleWords}`.trim()
}

function detectEUCountry(text: string): string {
  const t = text.toLowerCase()
  if (/\b(deutsch|german|berlin|hamburg|münchen|munich|rap\.de|deutschrap|187|gzuz|capital bra|bushido)\b/.test(t)) return 'de'
  if (/\b(france|français|paris|marseille|lyon|booska|sch|nekfeu|ninho|damso|hamza)\b/.test(t)) return 'fr'
  if (/\b(czech|česk|prag|prague|refresher cz|yzomandias|calin|mikro|nik tendo)\b/.test(t)) return 'cz'
  if (/\b(slovak|slovensko|bratislava|rytmus|ego|pil c|renne dang)\b/.test(t)) return 'sk'
  if (/\b(polish|polska|poland|warsaw|kraków|krakow|popkiller)\b/.test(t)) return 'pl'
  if (/\b(italian|italiano|milan|rome|roma|hiphoptv)\b/.test(t)) return 'it'
  if (/\b(spanish|español|spain|madrid|barcelona|peso pluma)\b/.test(t)) return 'es'
  if (/\b(netherlands|dutch|amsterdam|funx)\b/.test(t)) return 'nl'
  if (/\b(uk rap|grime|drill|london|manchester|british|stormzy|dave|central cee|skepta)\b/.test(t)) return 'uk'
  return 'us'
}

export type EnrichedFields = {
  artist_name: string | null
  spotify_url: string | null
  youtube_url: string | null
  genius_url: string | null
  apple_music_url: string | null
  image_url: string | null
  artist_id: string | null   // NEW: linked artist record
}

/**
 * PR-S4 #02 — map an SRL handle bag into platform URLs.
 * Re-export of the shared SRL helper so the conversion lives in one place
 * (the SRL module) yet stays importable from the enrichment test surface.
 */
export const srlLinksToUrls = srlHandlesToUrls

/**
 * PR-S4 #02 — gap-fill enrichment fields from an SRL cross-platform lookup.
 *
 * Additive + never-overwrite: external API results always win; SRL only fills
 * holes (artist_id, missing platform URLs, missing artist name). A null lookup
 * or 0-confidence match returns the input untouched, so enrichment behaves
 * exactly as before whenever the artist registry has no match (current schema).
 */
export function applySrlLinks(fields: EnrichedFields, links: PlatformLinks | null): EnrichedFields {
  if (!links || links.confidence <= 0) return fields
  const urls = srlLinksToUrls(links.links)
  return {
    ...fields,
    artist_id:       fields.artist_id ?? links.artistId ?? null,
    artist_name:     fields.artist_name ?? links.artistName ?? null,
    spotify_url:     fields.spotify_url ?? urls.spotify_url ?? null,
    youtube_url:     fields.youtube_url ?? urls.youtube_url ?? null,
    genius_url:      fields.genius_url ?? urls.genius_url ?? null,
    apple_music_url: fields.apple_music_url ?? urls.apple_music_url ?? null,
  }
}

async function enrichClusterData(
  cluster: ClusterForEnrichment,
  srl?: SourceResolver,
): Promise<EnrichedFields> {
  const artist = cluster.main_entity
  const track = extractTrackFromTitle(cluster.title, artist)
  const isMusic = MUSIC_CATEGORIES.has(cluster.category)

  // ── 1. External API enrichment (Spotify / YouTube / Genius / Apple Music) ──
  // Always query all available external sources so enrichment captures the fullest data set.
  const [spotifyResult, youtubeResult, geniusResult, appleMusicResult] = await Promise.allSettled([
    searchSpotify(artist, track),
    searchYouTube(buildYouTubeQuery(cluster)),
    searchGenius(buildGeniusQuery(cluster)),
    searchAppleMusic(artist, track),
  ])

  const spotify    = spotifyResult.status    === 'fulfilled' ? spotifyResult.value    : { track_url: null, artist_url: null, image_url: null, artist_name: null }
  const youtube    = youtubeResult.status    === 'fulfilled' ? youtubeResult.value    : { video_url: null, thumbnail_url: null, video_id: null }
  const genius     = geniusResult.status     === 'fulfilled' ? geniusResult.value     : { song_url: null, title: null }
  const appleMusic = appleMusicResult.status === 'fulfilled' ? appleMusicResult.value : { song_url: null, artist_url: null, artwork_url: null, track_name: null }

  // Image priority: Spotify > Apple Music > YouTube thumbnail
  // Guard: only use music API images when article is actually ABOUT the artist.
  // This prevents "tenerife" → Ed Sheeran album art, "china" → random K-pop, etc.
  const artistIsRelevant = isArtistMusicContent(artist, cluster.title) &&
    spotifyArtistMatches(spotify.artist_name, artist)
  const spotifyImage  = artistIsRelevant ? (spotify.image_url ?? null) : null
  const appleMusicImg = artistIsRelevant ? (appleMusic.artwork_url ?? null) : null
  const image_url = spotifyImage ?? appleMusicImg ?? youtube.thumbnail_url ?? null

  // ── 2. Artist Intelligence Layer — only for confirmed music artists ──────────
  let artistId: string | null = null
  try {
    if (artistIsRelevant) {
      const detectedCountry = detectEUCountry(`${cluster.title} ${cluster.merged_context?.join(' ') ?? ''}`)
      const artistRecord = await findOrCreateArtist(
        spotify.artist_name || artist,
        detectedCountry,
        'rap'
      )
      artistId = artistRecord?.id ?? null
    }

    // ── 3. Release detection — all music categories, not just rap_core ──
    const isRelease = MUSIC_CATEGORIES.has(cluster.category) && (
      cluster.title.toLowerCase().includes('drop') ||
      cluster.title.toLowerCase().includes('release') ||
      cluster.title.toLowerCase().includes('album') ||
      cluster.title.toLowerCase().includes('single') ||
      cluster.title.toLowerCase().includes('video')
    )

    if (isRelease && artistId && cluster.title) {
      // Attempt to parse release date from title or use today
      const releaseDate = new Date().toISOString().split('T')[0]

      await trackArtistRelease(artistId, {
        title: cluster.title,
        type: spotify.track_url ? 'track' : 'album',
        release_date: releaseDate,
        spotify_url: spotify.track_url ?? spotify.artist_url ?? null,
        youtube_url: youtube.video_url ?? null,
        genius_url: genius.song_url ?? null,
      })
    }
  } catch (err) {
    logger.warn('enrichment_artist_tracking_failed', {
      artist,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const fields: EnrichedFields = {
    artist_name:     artistIsRelevant ? (spotify.artist_name ?? artist) : null,
    spotify_url:     artistIsRelevant ? (spotify.track_url ?? spotify.artist_url ?? null) : null,
    youtube_url:     youtube.video_url ?? null,
    genius_url:      genius.song_url ?? null,
    apple_music_url: appleMusic.song_url ?? null,
    image_url,
    artist_id:       artistId,
  }

  // ── 4. SRL consult — route platform-link resolution through the Source
  // Resolution Layer instead of ad-hoc joins (PR-S4 #02). Read-only + cached by
  // artist name, so repeated clusters about the same artist share one lookup
  // ("reduces duplicate fetches napříč clustery"). Best-effort gap-fill only.
  if (srl && artist) {
    try {
      const links = await srl.resolveCrossPlatformLinks(artist)
      return applySrlLinks(fields, links)
    } catch (err) {
      logger.warn('enrichment_srl_lookup_failed', {
        artist,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return fields
}

async function processBatch(
  db: PipelineDbClient,
  clusters: ClusterForEnrichment[],
  options: PipelineOptions = {},
  srl?: SourceResolver,
): Promise<number> {
  let enriched = 0

  await Promise.all(
    clusters.map(async (cluster) => {
      try {
        const fields = await enrichClusterData(cluster, srl)

        const { error } = await db
          .from('story_clusters')
          .update({
            ...fields,
            enrichment_status: 'done',
            enriched_at: new Date().toISOString(),
          })
          .eq('id', cluster.id)
          .eq('enrichment_status', 'pending')

        if (!error) {
          enriched++

          // ── IMAGE ENRICHMENT: run AI image selection ──
          try {
            if (options.testMode) return
            const imageResult = await enrichImage({
              main_entity: cluster.main_entity,
              title: cluster.title,
              category: cluster.category,
            })

            // Store image selection on cluster
            await db.from('story_clusters').update({
              selected_image_url: imageResult.image_url,
              image_source: imageResult.source,
              image_score: imageResult.relevance_score,
              image_author: imageResult.author,
              image_license: imageResult.license,
              image_selected_at: new Date().toISOString(),
            }).eq('id', cluster.id)

            // Cache in article_images as well (cluster_id as article_id for now)
            await db.from('article_images').upsert({
              article_id: cluster.id,
              best_image_url: imageResult.image_url,
              best_source: imageResult.source,
              best_score: imageResult.relevance_score,
              alternatives: imageResult.alternatives.map((a) => ({
                image_url: a.image_url,
                source: a.source,
                score: a.relevance_score,
              })),
              selected_by: 'ai',
              selected_at: new Date().toISOString(),
            }, {
              onConflict: 'article_id',
            })
          } catch (imgErr) {
            logger.warn('enrichment_image_enrichment_failed', {
              cluster_id: cluster.id,
              error: imgErr instanceof Error ? imgErr.message : String(imgErr),
            })
          }
        }
      } catch (err) {
        logger.warn('enrichment_cluster_failed', {
          cluster_id: cluster.id,
          error: err instanceof Error ? err.message : String(err),
        })
        await db
          .from('story_clusters')
          .update({ enrichment_status: 'error', enriched_at: new Date().toISOString() })
          .eq('id', cluster.id)
      }
    })
  )

  return enriched
}

export async function runEnrichmentPipeline(db: PipelineDbClient, options: PipelineOptions = {}): Promise<EnrichmentResult> {
  // Note: Priority boost from Artist Tracking Engine queue is non-critical
  const maxClusters = options.testMode ? TEST_MODE_CONFIG.stage_batch_limit : 300
  const batchSize = options.testMode ? 2 : BATCH_SIZE
  const stageId = await logStageStart(db, 'enrichment', 'pipeline', { batch_limit: batchSize, max_clusters: maxClusters, test_mode: Boolean(options.testMode) })
  const startTime = Date.now()

  try {
    const { data: clusters, error } = await db
      .from('story_clusters')
      .select('id, main_entity, category, title, merged_context, artist_id')
      .eq('status', 'pending')
      .or('enrichment_status.is.null,enrichment_status.eq.pending')
      // P0 + P1 only — skip P2/P3 (fashion/culture/science) to avoid wasted Spotify/YouTube calls
      .in('category', ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap', 'rnb', 'fun'])
      .order('created_at', { ascending: false })
      .limit(maxClusters)

    if (error) {
      if (
        error.code === '42P01' ||
        error.code === '42703' ||
        (error.message ?? '').includes('does not exist')
      ) {
        logger.warn('enrichment_schema_missing', {
          error_code: error.code,
          error_message: error.message,
        })
        await logStageComplete(db, stageId, { processed: 0, enriched: 0, skipped: 0 }, { duration_ms: Date.now() - startTime })
        return { processed: 0, enriched: 0, skipped: 0 }
      }
      throw new Error(error.message)
    }

    if (!clusters?.length) {
      logger.info('enrichment_no_items', {
        processed: 0,
        duration_ms: Date.now() - startTime,
      })
      await logStageComplete(db, stageId, { processed: 0, enriched: 0, skipped: 0 }, { duration_ms: Date.now() - startTime })
      return { processed: 0, enriched: 0, skipped: 0 }
    }

    const clusterList = clusters as ClusterForEnrichment[]
    let totalEnriched = 0

    // One resolver for the whole run so its name-keyed cache is shared across
    // every batch — a cluster about an artist seen earlier resolves from cache.
    const srl = createSourceResolver(db as SrlDb)

    for (let i = 0; i < clusterList.length; i += batchSize) {
      const batch = clusterList.slice(i, i + batchSize)
      totalEnriched += await processBatch(db, batch, options, srl)
    }

    logger.info('enrichment_complete', {
      processed: clusterList.length,
      enriched: totalEnriched,
      skipped: clusterList.length - totalEnriched,
      duration_ms: Date.now() - startTime,
    })

    await logStageComplete(db, stageId, {
      processed: clusterList.length,
      enriched: totalEnriched,
      skipped: clusterList.length - totalEnriched,
    }, {
      duration_ms: Date.now() - startTime,
      metadata: { api_sources: ['spotify', 'youtube', 'genius', 'apple_music', 'image_ai'] },
    })

    return {
      processed: clusterList.length,
      enriched: totalEnriched,
      skipped: clusterList.length - totalEnriched,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    await logStageComplete(db, stageId, {}, {
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
