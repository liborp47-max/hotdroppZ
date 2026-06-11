import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase       = createClient(SUPABASE_URL, SUPABASE_KEY)

const BATCH_SIZE = 20

interface Artist {
  id: string
  name: string
  country: string
  spotify_id?: string | null
  youtube_channel_id?: string | null
  check_interval_min: number
  priority_score: number
  last_checked?: string | null
}

async function getNextBatch(): Promise<Artist[]> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .eq('is_tracking_active', true)
    .or(`last_checked.is.null,last_checked.lt.${cutoff}`)
    .order('priority_score', { ascending: false })
    .order('last_checked', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('ATE fetch error:', error.message)
    return []
  }
  return (data as Artist[]) || []
}

async function checkSpotify(artist: Artist): Promise<{title: string; url: string; platform: string} | null> {
  // TODO: Real Spotify API integration
  if (artist.priority_score >= 80) {
    return {
      title:   `${artist.name} — new release`,
      url:     `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`,
      platform: 'spotify',
    }
  }
  return null
}

async function checkYouTube(artist: Artist): Promise<{title: string; url: string; platform: string} | null> {
  // TODO: Real YouTube API integration
  if (artist.priority_score >= 70) {
    return {
      title:   `${artist.name} — official video`,
      url:     `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.name + ' new release')}`,
      platform: 'youtube',
    }
  }
  return null
}

async function enqueue(artist: Artist, release: { title: string; url: string; platform: string }): Promise<string> {
  const boost = release.platform === 'spotify' ? 30 : 20
  const priority = Math.min(100, 50 + boost + Math.floor(artist.priority_score / 4))

  const { data, error } = await supabase
    .from('droppz_queue')
    .insert({
      artist_name:    artist.name,
      artist_id:      artist.id,
      title:          release.title,
      type:           release.platform === 'youtube' ? 'video' : 'track',
      platform:       release.platform,
      url:            release.url,
      priority_score: priority,
      source_type:    'artist_tracking',
    })
    .select('id')
    .single()

  return error ? 'error' : data.id
}

async function markChecked(artistId: string, found: number): Promise<void> {
  const { data } = await supabase.from('artists').select('check_interval_min').eq('id', artistId).single()
  const cur = data?.check_interval_min || 15
  const next = found > 0 ? Math.max(5, Math.min(cur, 10)) : Math.min(30, cur + 5)

  await supabase.from('artists').update({
    last_checked: new Date().toISOString(),
    check_interval_min: next,
  }).eq('id', artistId)
}

serve(async (req) => {
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))

    if (body.artistId) {
      // Single artist check
      const { data: artist } = await supabase.from('artists').select('*').eq('id', body.artistId).single()
      if (artist) {
        const [s, y] = await Promise.all([checkSpotify(artist as Artist), checkYouTube(artist as Artist)])
        const releases = [s, y].filter(Boolean)
        for (const r of releases) await enqueue(artist as Artist, r!)
        await markChecked(body.artistId, releases.length)
      }
      return new Response(JSON.stringify({ success: true, releases: 1 }), { headers: { 'content-type': 'application/json' } })
    }

    // Batch run
    const artists = await getNextBatch()
    let total = 0; let checked = 0

    for (const artist of artists) {
      try {
        const [s, y] = await Promise.all([checkSpotify(artist), checkYouTube(artist)])
        const releases = [s, y].filter(Boolean)
        for (const r of releases) await enqueue(artist, r!)
        await markChecked(artist.id, releases.length)
        total += releases.length; checked++
      } catch (e) { console.error('ATE error:', e) }
    }

    return new Response(JSON.stringify({
      success: true,
      artistsChecked: checked,
      releasesFound:  total,
      timestamp: new Date().toISOString(),
    }), { headers: { 'content-type': 'application/json' } })
  }

  return new Response(JSON.stringify({ service: 'artist-tracking-engine', status: 'running' }), {
    headers: { 'content-type': 'application/json' },
  })
})
