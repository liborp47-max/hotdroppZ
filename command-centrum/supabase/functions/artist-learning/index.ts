// ─── Artist Learning Engine ─────────────────────────────────────────────────────
// Cron job (daily) — analyzes conversion data & adjusts artist priority scores
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase       = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ArtistStats {
  id: string
  name: string
  priority_score: number
  check_interval_min: number
  releases_7d: number
  releases_30d: number
  last_release_at: string | null
  detected_total: number
  written: number
  conversion_rate: number
}

async function fetchAllArtistsWithStats(): Promise<ArtistStats[]> {
  const { data } = await supabase
    .from('mv_artist_activity')
    .select('*')

  return (data as ArtistStats[]) || []
}

function computeAdjustment(artist: ArtistStats): { priority: number; interval: number; reason: string } {
  let newPriority = artist.priority_score
  let newInterval = artist.check_interval_min
  let reason = 'no change'

  // RULE 1: High conversion artists (≥40%, ≥5 detections) → boost
  if (artist.conversion_rate >= 40 && artist.detected_total >= 5) {
    newPriority = Math.min(100, artist.priority_score + 15)
    reason      = '+15 pts (high conversion)'
  }
  // RULE 2: Low conversion (≤10%, ≥10 detections) → penalize
  else if (artist.conversion_rate <= 10 && artist.detected_total >= 10) {
    newPriority = Math.max(20, artist.priority_score - 20)
    reason      = '-20 pts (low conversion)'
  }

  // RULE 3: Very active artist (≥3 releases/week) → check every 5 min
  if (artist.releases_7d >= 3) {
    newInterval = 5
    reason     += ' | interval 5m (frequent releases)'
  }
  // RULE 4: Inactive > 14 days → slow down (max 30 min)
  else if (artist.last_release_at && new Date(artist.last_release_at) < new Date(Date.now() - 14*24*60*60*1000)) {
    newInterval = Math.min(30, artist.check_interval_min + 5)
    reason     += ` | interval ${newInterval}m (inactive)`
  }

  return { priority: newPriority, interval: newInterval, reason }
}

async function runDailyLearning(): Promise<{ updated: number; adjustments: any[] }> {
  const artists = await fetchAllArtistsWithStats()
  const updates: any[] = []
  const batchSize = 50

  for (let i = 0; i < Math.min(artists.length, 200); i++) {
    const artist = artists[i]
    const adj = computeAdjustment(artist)

    if (adj.priority !== artist.priority_score || adj.interval !== artist.check_interval_min) {
      updates.push({ id: artist.id, ...adj })

      await supabase
        .from('artists')
        .update({
          priority_score:    adj.priority,
          check_interval_min: adj.interval,
        })
        .eq('id', artist.id)
    }
  }

  return { updated: updates.length, adjustments: updates }
}

// ─── HANDLER ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'POST') {
    const result = await runDailyLearning()
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    })
  }

  // GET — last learning run status
  const { data: recent } = await supabase
    .from('tracking_log')
    .select('*')
    .eq('action', 'learning_cycle')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return new Response(JSON.stringify({
    service:    'artist-learning-engine',
    lastRun:    recent?.created_at || null,
    lastResult: recent?.details || null,
  }), { headers: { 'content-type': 'application/json' } })
})

// ─── DEPLOYMENT ─────────────────────────────────────────────────────────────────
// 1. Deploy as Edge Function: `supabase functions deploy artist-learning`
// 2. Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 3. Add cron in Supabase Dashboard: 0 6 * * * (daily 6 AM UTC)
//    URL: https://<project>.functions.supabase.co/artist-learning
// ─────────────────────────────────────────────────────────────────────────────
