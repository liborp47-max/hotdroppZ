// ─── Artist Tracking Engine (ATE) ─────────────────────────────────────────────
// Polls external APIs for new releases from tracked artists
// Injects detections into droppz_queue for priority pipeline processing
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { searchSpotify } from '@/lib/services/spotify'
import { searchYouTube } from '@/lib/services/youtube'

type TrackingResult = {
  artistId: string
  artistName: string
  platform: 'spotify' | 'youtube' | 'rss'
  releaseType: 'track' | 'album' | 'ep' | 'single' | 'video' | 'mixtape'
  title: string
  url: string
  thumbnailUrl?: string
  detectedAt: string
}

type TrackedArtist = {
  id: string
  name: string
  normalized_name: string
  country: string
  genre: string
  spotify_id?: string | null
  youtube_channel_id?: string | null
  last_checked?: string | null
  check_interval_min: number
  priority_score: number
  is_tracking_active: boolean
}

// ─── 1. SCHEDULER — get next batch due for checking ───────────────────────────

export async function getNextArtistsForTracking(limit = 20): Promise<TrackedArtist[]> {
  const db = createAdminClient()
  if (!db) return []

  const { data, error } = await db
    .from('artists')
    .select('*')
    .eq('is_tracking_active', true)
    .or(`last_checked.is.null,last_checked.lt.${new Date(
      Date.now() - 15 * 60 * 1000
    ).toISOString()}`)
    .order('priority_score', { ascending: false })
    .order('last_checked', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    console.error('ATE: failed to fetch artists for tracking', error.message)
    return []
  }

  return (data as TrackedArtist[]) || []
}

// ─── 2. SPOTIFY TRACKING ───────────────────────────────────────────────────────

async function checkSpotifyForArtist(artist: TrackedArtist): Promise<TrackingResult[]> {
  const results: TrackingResult[] = []
  
  try {
    // Search for artist on Spotify to get ID if not stored
    const search = await searchSpotify(artist.name)
    
    // Note: Full Spotify discography requires OAuth + Spotify Web API
    // This is a simplified version using the search result as a "release detection"
    if (search.artist_url && search.track_url) {
      results.push({
        artistId: artist.id,
        artistName: artist.name,
        platform: 'spotify',
        releaseType: 'track',
        title: search.artist_name || artist.name + ' — new release',
        url: search.track_url,
        thumbnailUrl: search.image_url ?? undefined,
        detectedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error(`ATE: Spotify check failed for ${artist.name}`, err)
  }

  return results
}

// ─── 3. YOUTUBE TRACKING ───────────────────────────────────────────────────────

async function checkYouTubeForArtist(artist: TrackedArtist): Promise<TrackingResult[]> {
  const results: TrackingResult[] = []

  try {
    const result = await searchYouTube(artist.name + ' new release')
    
    if (result.video_url) {
      results.push({
        artistId: artist.id,
        artistName: artist.name,
        platform: 'youtube',
        releaseType: 'video',
        title: artist.name + ' — new video',
        url: result.video_url,
        thumbnailUrl: result.thumbnail_url ?? undefined,
        detectedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error(`ATE: YouTube check failed for ${artist.name}`, err)
  }

  return results
}

// ─── 4. RSS FALLBACK ───────────────────────────────────────────────────────────

async function checkRSSForArtist(): Promise<TrackingResult[]> {
  // Future: if artist has RSS feed URL stored, poll it for new items
  // For now, return empty — RSS sources are already covered by main scout
  return []
}

// ─── 5. DEDUPLICATION & QUEUE INSERT ──────────────────────────────────────────

export async function enqueueRelease(result: TrackingResult): Promise<string> {
  const db = createAdminClient()
  if (!db) return 'error-no-db'

  // Deduplication: check if URL already in queue or already processed
  const { data: existing } = await db
    .from('droppz_queue')
    .select('id')
    .eq('url', result.url)
    .in('status', ['pending','scouting','curated','clustered','written'])
    .limit(1)

  if (existing && existing.length > 0) {
    return 'duplicate-' + existing[0].id
  }

  // Calculate priority score: artist priority_score + boost for recency/type
  const priorityBoost = result.platform === 'spotify' ? 30 : 20  // Spotify gets +30, YouTube +20
  const finalPriority = Math.min(100, result.artistId ? 70 + priorityBoost : 50 + priorityBoost)

  const { data: inserted, error } = await db
    .from('droppz_queue')
    .insert({
      artist_name:     result.artistName,
      artist_id:       result.artistId,
      title:           result.title,
      type:            result.releaseType,
      platform:        result.platform,
      url:             result.url,
      thumbnail_url:   result.thumbnailUrl,
      priority_score:  finalPriority,
      source_type:     'artist_tracking',
      status:          'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('ATE: enqueue failed', error.message)
    return 'error-' + error.message
  }

  // Log tracking event
  await db.from('tracking_log').insert({
    artist_id:     result.artistId,
    queue_item_id: inserted.id,
    action:        'release_found',
    platform:      result.platform,
    details:       {
      title: result.title,
      type:  result.releaseType,
      url:   result.url,
    } as any,
  })

  return inserted.id
}

// ─── 6. MAIN TRACKING CYCLE ─────────────────────────────────────────────────────

export async function runTrackingCycle(limit = 20): Promise<{
  artistsChecked: number
  releasesFound: number
  queued: number
  errors: string[]
}> {
  const artists = await getNextArtistsForTracking(limit)
  const errors: string[] = []
  let totalReleases = 0
  let totalQueued = 0

  for (const artist of artists) {
    try {
      // Parallel checks across platforms
      const [spotifyResults, youtubeResults, rssResults] = await Promise.all([
        checkSpotifyForArtist(artist),
        checkYouTubeForArtist(artist),
        checkRSSForArtist(),
      ])

      const allResults = [...spotifyResults, ...youtubeResults, ...rssResults]
      
      if (allResults.length > 0) {
        console.log(`ATE: ${artist.name} — ${allResults.length} release(s) found`)
      }

      // Enqueue each detected release
      for (const result of allResults) {
        const queueResult = await enqueueRelease(result)
        if (queueResult.startsWith('error')) {
          errors.push(`${artist.name}: ${queueResult}`)
        } else if (!queueResult.startsWith('duplicate')) {
          totalQueued++
        }
        totalReleases++
      }

      // Mark artist as checked (updates last_checked and check interval)
      await markArtistChecked(artist.id, allResults.length)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${artist.name}: ${msg}`)
      console.error(`ATE: tracking error for ${artist.name}`, err)
    }
  }

  return {
    artistsChecked: artists.length,
    releasesFound: totalReleases,
    queued: totalQueued,
    errors,
  }
}

// ─── 7. MARK ARTIST CHECKED ─────────────────────────────────────────────────────

export async function markArtistChecked(
  artistId: string,
  releasesFound: number
): Promise<void> {
  const db = createAdminClient()
  if (!db) return

  // Fetch current interval
  const { data: artist } = await db
    .from('artists')
    .select('check_interval_min')
    .eq('id', artistId)
    .single()

  const currentInterval = artist?.check_interval_min || 15

  // Adjust interval: more frequent if releases found, less if silent
  let newInterval: number
  if (releasesFound > 0) {
    newInterval = Math.max(5, Math.min(currentInterval, 10))  // 5–10 min
  } else {
    newInterval = Math.min(30, currentInterval + 5)  // back off to 30 max
  }

  await db
    .from('artists')
    .update({
      last_checked:     new Date().toISOString(),
      check_interval_min: newInterval,
    })
    .eq('id', artistId)
}

// ─── 8. ANALYTICS ───────────────────────────────────────────────────────────────

export async function getArtistTrackingStats(
  artistId?: string,
  country?: string
): Promise<{
  totalReleases30d: number
  avgReleasesPerDay: number
  lastReleaseAt: string | null
  queueStatus: { pending: number; processing: number; completed: number }
}> {
  const db = createAdminClient()
  if (!db) return { totalReleases30d: 0, avgReleasesPerDay: 0, lastReleaseAt: null, queueStatus: { pending: 0, processing: 0, completed: 0 } }

  // Total queue items for this artist/country
  let queueQuery = db
    .from('droppz_queue')
    .select('status')
    // ^ simplified — in practice use multiple queries
    .in('status', ['pending','scouting','clustered','written'])

  if (artistId) {
    queueQuery = queueQuery.eq('artist_id', artistId as never)
  } else if (country) {
    queueQuery = queueQuery.eq('artist_country', country as never)
  }

  const { data: queueRows } = await queueQuery
  const queueStats = (queueRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status)
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})

  const queueStatus = {
    pending:    queueStats.pending ?? 0,
    processing: queueStats.scouting ?? 0,
    completed:  queueStats.written ?? 0,
  }

  // Releases in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: totalReleases30d } = await db
    .from('droppz_queue')
    .select('*', { count: 'exact', head: true })
    .eq('artist_id', artistId as never)
    .gte('detected_at', thirtyDaysAgo)

  // Last release timestamp
  const { data: last } = await db
    .from('droppz_queue')
    .select('detected_at')
    .eq('artist_id', artistId as never)
    .order('detected_at', { ascending: false })
    .limit(1)
    .single()

  return {
    totalReleases30d: totalReleases30d || 0,
    avgReleasesPerDay: (totalReleases30d || 0) / 30,
    lastReleaseAt: last?.detected_at || null,
    queueStatus,
  }
}

// ─── 9. LEARNING INTEGRATION ────────────────────────────────────────────────────
// Feed learning model with artist release patterns

export async function exportTrackingDataForLearning(
  days = 30
): Promise<Array<{
  artistId: string
  artistName: string
  country: string
  releaseCount: number
  avgPriority: number
  platforms: string[]
  lastDetectedAt: string
}>> {
  const db = createAdminClient()
  if (!db) return []

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await db.rpc('artist_tracking_learning_export', {
    p_since: since,
  })

  // Fallback: direct query if RPC not yet created
  if (!data || data.length === 0) {
    const { data: raw } = await db
      .from('droppz_queue')
      .select(`
        artist_id,
        artist_name,
        platform,
        priority_score,
        detected_at
      `)
      .gte('detected_at', since)
      .order('artist_id')

    if (!raw) return []

    // Aggregate per artist
    const map = new Map<string, any>()
    for (const row of raw as any[]) {
      const key = row.artist_id
      if (!map.has(key)) {
        map.set(key, {
          artistId:   key,
          artistName: row.artist_name,
          platforms:  new Set<string>(),
          total:      0,
          prioritySum:0,
          lastDetectedAt: row.detected_at,
        })
      }
      const entry = map.get(key)
      entry.total++
      entry.prioritySum += row.priority_score
      entry.platforms.add(row.platform)
      if (row.detected_at > entry.lastDetectedAt) {
        entry.lastDetectedAt = row.detected_at
      }
    }

    return Array.from(map.values()).map((e: any) => ({
      artistId:       e.artistId,
      artistName:     e.artistName,
      country:        'unknown', // join with artists table if needed
      releaseCount:   e.total,
      avgPriority:    Math.round(e.prioritySum / e.total),
      platforms:      Array.from(e.platforms),
      lastDetectedAt: e.lastDetectedAt,
    }))
  }

  return data as any[]
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type {
  TrackingResult,
  TrackedArtist,
}
