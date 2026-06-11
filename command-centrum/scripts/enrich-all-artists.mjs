/**
 * enrich-all-artists.mjs
 *
 * Full artist enrichment: Apple Music · Wikidata · Spotify (detail + discography) · Genius
 * Updates: artists · artist_links · artist_releases
 *
 * Usage:
 *   node scripts/enrich-all-artists.mjs              # all non-US artists
 *   node scripts/enrich-all-artists.mjs --country=de # single country
 *   node scripts/enrich-all-artists.mjs --reset      # clear checkpoint, start fresh
 */

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const CHECKPOINT_PATH = path.join(ROOT, '.enrich-checkpoint.json')
const NOW = new Date().toISOString()
const TODAY = NOW.split('T')[0]
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

// Spotify rate limit: stay under 30 req/10s to be safe
const DELAY_SPOTIFY_MS = 350
const DELAY_APPLE_MS = 200
const DELAY_WIKIDATA_MS = 400
const DELAY_GENIUS_MS = 250

// Apple Music country code mapping
const APPLE_COUNTRY = {
  cz: 'cz', de: 'de', fr: 'fr', it: 'it', es: 'es',
  nl: 'nl', pl: 'pl', ru: 'ru', sk: 'sk', sr: 'rs',
  hr: 'hr', bs: 'ba', uk: 'gb', us: 'us',
}

// ─── Env + CLI ────────────────────────────────────────────────────────────────

function loadEnv() {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const args = process.argv.slice(2)
const countryFilter = args.find(a => a.startsWith('--country='))?.split('=')[1] ?? null
const resetCheckpoint = args.includes('--reset')

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (resetCheckpoint || !fs.existsSync(CHECKPOINT_PATH)) return { done: [] }
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8')) } catch { return { done: [] } }
}

function saveCheckpoint(done) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({ done }, null, 2))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const norm = (s) => String(s || '').toLowerCase().trim()

async function fetchJson(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

function normalizeReleaseDate(dateStr) {
  if (!dateStr) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`
  return null
}

function inferReleaseType(albumType, totalTracks) {
  if (albumType === 'single') return totalTracks <= 1 ? 'single' : 'ep'
  if (albumType === 'album') return totalTracks <= 6 ? 'ep' : 'album'
  return 'album'
}

function articleize(text) {
  const t = String(text || '').trim()
  if (/^(a|an|the)\s/i.test(t)) return t
  return `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}`
}

// ─── Apple Music (iTunes API) ─────────────────────────────────────────────────

async function searchApple(name, country = 'us') {
  const cc = APPLE_COUNTRY[country] || 'us'
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&media=music&entity=musicArtist&limit=5&country=${cc}`
  const data = await fetchJson(url)
  const results = data.results || []
  const exact = results.find(r => norm(r.artistName) === norm(name))
  const loose = results.find(r => norm(r.artistName).includes(norm(name)) || norm(name).includes(norm(r.artistName)))
  const best = exact || loose
  if (!best?.artistLinkUrl || !best?.artistId) return null
  return {
    url: best.artistLinkUrl,
    id: String(best.artistId),
    name: best.artistName,
  }
}

// ─── Wikidata ─────────────────────────────────────────────────────────────────

async function searchWikidata(name) {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5`
  const data = await fetchJson(searchUrl)
  const candidates = (data.search || []).filter(item => {
    const desc = norm(item.description || '')
    return norm(item.label) === norm(name) &&
      /(rapper|musician|singer|record producer|producer|hip hop|hip-hop|musical artist|band|music group|dj|beatmaker)/i.test(desc)
  })
  return candidates[0]?.id ?? null
}

async function wikidataDetails(qid) {
  const query = `
    SELECT ?itemLabel ?itemDescription ?image ?spotify ?youtube ?instagram ?tiktok ?appleMusic ?website WHERE {
      BIND(wd:${qid} AS ?item)
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P856 ?website. }
      OPTIONAL { ?item wdt:P1902 ?spotify. }
      OPTIONAL { ?item wdt:P2397 ?youtube. }
      OPTIONAL { ?item wdt:P2003 ?instagram. }
      OPTIONAL { ?item wdt:P7085 ?tiktok. }
      OPTIONAL { ?item wdt:P2850 ?appleMusic. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`
  const data = await fetchJson(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
    { headers: { Accept: 'application/sparql-results+json' } }
  )
  const row = data.results?.bindings?.[0]
  if (!row) return null
  return {
    qid,
    description: row.itemDescription?.value ?? null,
    image_url: row.image?.value ?? null,
    spotify_id: row.spotify?.value ?? null,
    youtube_channel_id: row.youtube?.value ?? null,
    instagram_handle: row.instagram?.value ?? null,
    tiktok_handle: row.tiktok?.value ?? null,
    apple_music_id: row.appleMusic?.value ?? null,
  }
}

// ─── Spotify ──────────────────────────────────────────────────────────────────

let _spotifyToken = null
let _spotifyTokenExp = 0

async function getSpotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) return null
  if (_spotifyToken && Date.now() < _spotifyTokenExp) return _spotifyToken
  const data = await fetchJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  _spotifyToken = data.access_token
  _spotifyTokenExp = Date.now() + (data.expires_in - 60) * 1000
  return _spotifyToken
}

async function spotifyGet(path) {
  const token = await getSpotifyToken()
  if (!token) return null
  return fetchJson(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function spotifySearchArtist(name) {
  const data = await spotifyGet(`/search?q=${encodeURIComponent(name)}&type=artist&limit=5`)
  if (!data) return null
  const items = data.artists?.items || []
  const exact = items.find(a => norm(a.name) === norm(name))
  const loose = items.find(a => norm(a.name).includes(norm(name)) || norm(name).includes(norm(a.name)))
  return exact || loose || null
}

async function spotifyArtistDetail(spotifyId) {
  return spotifyGet(`/artists/${spotifyId}`)
}

async function spotifyDiscography(spotifyId) {
  const pages = []
  let url = `/artists/${spotifyId}/albums?include_groups=album,single,ep&market=US&limit=50`
  // Only fetch first page (50 releases is plenty for our needs)
  const data = await spotifyGet(url)
  if (data?.items) pages.push(...data.items)
  return pages
}

// ─── Genius ───────────────────────────────────────────────────────────────────

async function searchGenius(name) {
  const token = process.env.GENIUS_ACCESS_TOKEN
  if (!token) return null
  const data = await fetchJson(
    `https://api.genius.com/search?q=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const hits = data.response?.hits || []
  const match = hits.find(h => norm(h.result?.primary_artist?.name) === norm(name))
  const loose = hits.find(h =>
    norm(h.result?.primary_artist?.name).includes(norm(name)) ||
    norm(name).includes(norm(h.result?.primary_artist?.name))
  )
  const best = match || loose
  return best?.result?.primary_artist?.url ?? null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const checkpoint = loadCheckpoint()
  const doneSet = new Set(checkpoint.done)

  // Fetch all artists + their existing links
  let query = supabase
    .from('artists')
    .select(`
      id, name, country, city, description, profile_image_url,
      spotify_id, youtube_channel_id, genres,
      spotify_url, youtube_url, apple_music_url, genius_url, instagram_url, tiktok_url,
      artist_links (
        id, spotify_id, spotify_url, apple_music_url, apple_music_id,
        youtube_url, youtube_channel_id, instagram_url, instagram_handle,
        tiktok_url, tiktok_handle, genius_url
      )
    `)
    .neq('country', 'us')
    .eq('is_active', true)
    .order('country')
    .order('name')

  if (countryFilter) query = query.eq('country', countryFilter)

  const { data: artists, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Check which artists already have releases
  const { data: releaseStats } = await supabase
    .from('artist_releases')
    .select('artist_id')
  const artistsWithReleases = new Set((releaseStats || []).map(r => r.artist_id))

  const total = artists.length
  let processed = 0, updated = 0, skipped = 0, errors = 0

  console.log(`\n🎵 HotDroppZ Artist Enrichment`)
  console.log(`   Artists to process: ${total}${countryFilter ? ` (${countryFilter})` : ''}`)
  console.log(`   Already done (checkpoint): ${doneSet.size}\n`)

  for (const artist of artists) {
    processed++
    const prefix = `[${processed}/${total}] ${artist.country.toUpperCase()} › ${artist.name}`

    if (doneSet.has(artist.id)) {
      process.stdout.write(`${prefix} — skipped (checkpoint)\n`)
      skipped++
      continue
    }

    const links = artist.artist_links?.[0] ?? {}

    // Determine what's missing
    const needsApple   = !artist.apple_music_url && !links.apple_music_url
    const needsSpotify = !artist.spotify_id && !links.spotify_id
    const needsYoutube = !artist.youtube_channel_id && !links.youtube_channel_id && !links.youtube_url
    const needsInsta   = !artist.instagram_url && !links.instagram_url
    const needsTiktok  = !artist.tiktok_url && !links.tiktok_url
    const needsGenius  = !artist.genius_url && !links.genius_url
    const needsWikidata = needsSpotify || needsYoutube || needsInsta || needsTiktok
    const needsDiscography = !artistsWithReleases.has(artist.id)
    const currentSpotifyId = artist.spotify_id || links.spotify_id

    const missing = [
      needsApple && 'apple', needsSpotify && 'spotify', needsYoutube && 'youtube',
      needsInsta && 'insta', needsTiktok && 'tiktok', needsGenius && 'genius',
      needsDiscography && 'discog',
    ].filter(Boolean)

    if (missing.length === 0) {
      process.stdout.write(`${prefix} — ✓ complete\n`)
      doneSet.add(artist.id)
      saveCheckpoint([...doneSet])
      skipped++
      continue
    }

    process.stdout.write(`${prefix} — missing: ${missing.join(', ')} ... `)

    try {
      const artistUpdates = {}
      const linkUpdates = { artist_id: artist.id, updated_at: NOW, last_enriched_at: NOW }
      let spotifyId = currentSpotifyId

      // ── 1. Apple Music ────────────────────────────────────────────────────────
      if (needsApple) {
        await sleep(DELAY_APPLE_MS)
        const apple = await searchApple(artist.name, artist.country).catch(() => null)
        if (apple) {
          artistUpdates.apple_music_url = apple.url
          linkUpdates.apple_music_url = apple.url
          linkUpdates.apple_music_id = apple.id
          linkUpdates.apple_verified = true
        }
      }

      // ── 2. Wikidata ───────────────────────────────────────────────────────────
      let wikidata = null
      if (needsWikidata) {
        await sleep(DELAY_WIKIDATA_MS)
        const qid = await searchWikidata(artist.name).catch(() => null)
        if (qid) {
          await sleep(DELAY_WIKIDATA_MS)
          wikidata = await wikidataDetails(qid).catch(() => null)
        }
        if (wikidata) {
          if (!artist.description && wikidata.description) {
            artistUpdates.description = `${artist.name} is ${articleize(wikidata.description)}.`
          }
          if (!artist.profile_image_url && wikidata.image_url) {
            artistUpdates.profile_image_url = wikidata.image_url
          }
          if (wikidata.spotify_id && !spotifyId) {
            spotifyId = wikidata.spotify_id
            artistUpdates.spotify_id = spotifyId
            artistUpdates.spotify_url = `https://open.spotify.com/artist/${spotifyId}`
            linkUpdates.spotify_id = spotifyId
            linkUpdates.spotify_url = artistUpdates.spotify_url
            linkUpdates.spotify_verified = true
          }
          if (wikidata.youtube_channel_id && needsYoutube) {
            artistUpdates.youtube_channel_id = wikidata.youtube_channel_id
            artistUpdates.youtube_url = `https://www.youtube.com/channel/${wikidata.youtube_channel_id}`
            linkUpdates.youtube_channel_id = wikidata.youtube_channel_id
            linkUpdates.youtube_url = artistUpdates.youtube_url
            linkUpdates.youtube_verified = true
          }
          if (wikidata.instagram_handle && needsInsta) {
            artistUpdates.instagram_url = `https://www.instagram.com/${wikidata.instagram_handle}`
            linkUpdates.instagram_url = artistUpdates.instagram_url
            linkUpdates.instagram_handle = wikidata.instagram_handle
            linkUpdates.instagram_verified = true
          }
          if (wikidata.tiktok_handle && needsTiktok) {
            artistUpdates.tiktok_url = `https://www.tiktok.com/@${wikidata.tiktok_handle}`
            linkUpdates.tiktok_url = artistUpdates.tiktok_url
            linkUpdates.tiktok_handle = wikidata.tiktok_handle
            linkUpdates.tiktok_verified = true
          }
          if (wikidata.apple_music_id && !linkUpdates.apple_music_id) {
            const appleUrl = `https://music.apple.com/artist/${wikidata.apple_music_id}`
            if (!artistUpdates.apple_music_url) artistUpdates.apple_music_url = appleUrl
            linkUpdates.apple_music_url = linkUpdates.apple_music_url || appleUrl
            linkUpdates.apple_music_id = linkUpdates.apple_music_id || wikidata.apple_music_id
          }
        }
      }

      // ── 3. Spotify search (if still no spotify_id) ────────────────────────────
      if (!spotifyId && needsSpotify) {
        await sleep(DELAY_SPOTIFY_MS)
        const spotifyArtist = await spotifySearchArtist(artist.name).catch(() => null)
        if (spotifyArtist?.id) {
          spotifyId = spotifyArtist.id
          artistUpdates.spotify_id = spotifyId
          artistUpdates.spotify_url = spotifyArtist.external_urls?.spotify
          if (!artistUpdates.profile_image_url && spotifyArtist.images?.[0]?.url) {
            artistUpdates.profile_image_url = spotifyArtist.images[0].url
          }
          if (!artistUpdates.genres && spotifyArtist.genres?.length) {
            artistUpdates.genres = spotifyArtist.genres
          }
          linkUpdates.spotify_id = spotifyId
          linkUpdates.spotify_url = artistUpdates.spotify_url
          linkUpdates.spotify_verified = false // search result, not confirmed
        }
      }

      // ── 4. Spotify artist detail (if we have spotify_id) ─────────────────────
      if (spotifyId) {
        await sleep(DELAY_SPOTIFY_MS)
        const detail = await spotifyArtistDetail(spotifyId).catch(() => null)
        if (detail) {
          if (!artistUpdates.profile_image_url && !artist.profile_image_url && detail.images?.[0]?.url) {
            artistUpdates.profile_image_url = detail.images[0].url
          }
          if (!artist.genres?.length && !artistUpdates.genres && detail.genres?.length) {
            artistUpdates.genres = detail.genres
          }
          // Store followers + popularity in metadata
          const existingMeta = {}
          artistUpdates.metadata = {
            ...existingMeta,
            spotify_followers: detail.followers?.total ?? null,
            spotify_popularity: detail.popularity ?? null,
            spotify_verified_at: NOW,
          }
        }
      }

      // ── 5. Spotify discography ────────────────────────────────────────────────
      const releasesToInsert = []
      if (spotifyId && needsDiscography) {
        await sleep(DELAY_SPOTIFY_MS)
        const albums = await spotifyDiscography(spotifyId).catch(() => [])
        for (const album of albums) {
          const releaseDate = normalizeReleaseDate(album.release_date)
          if (!releaseDate) continue
          const type = inferReleaseType(album.album_type, album.total_tracks)
          releasesToInsert.push({
            artist_id: artist.id,
            title: album.name,
            type,
            release_date: releaseDate,
            platform: 'spotify',
            url: album.external_urls?.spotify,
            spotify_url: album.external_urls?.spotify,
            spotify_id: album.id,
            thumbnail: album.images?.[0]?.url ?? null,
            is_new_release: releaseDate >= SEVEN_DAYS_AGO,
            is_hot_trend: false,
          })
        }
        if (releasesToInsert.length > 0) {
          artistUpdates.total_releases = releasesToInsert.length
          const latestDate = releasesToInsert
            .map(r => r.release_date)
            .sort()
            .reverse()[0]
          if (latestDate) artistUpdates.last_release_at = latestDate
        }
      }

      // ── 6. Genius ─────────────────────────────────────────────────────────────
      if (needsGenius) {
        await sleep(DELAY_GENIUS_MS)
        const geniusUrl = await searchGenius(artist.name).catch(() => null)
        if (geniusUrl) {
          artistUpdates.genius_url = geniusUrl
          linkUpdates.genius_url = geniusUrl
          linkUpdates.genius_verified = false
        }
      }

      // ── 7. Save to DB ─────────────────────────────────────────────────────────
      artistUpdates.ai_fetched_at = NOW
      artistUpdates.updated_at = NOW

      const { error: artistErr } = await supabase
        .from('artists')
        .update(artistUpdates)
        .eq('id', artist.id)
      if (artistErr) throw new Error(`artists update: ${artistErr.message}`)

      if (Object.keys(linkUpdates).length > 4) {
        const { error: linkErr } = await supabase
          .from('artist_links')
          .upsert(linkUpdates, { onConflict: 'artist_id' })
        if (linkErr) throw new Error(`artist_links upsert: ${linkErr.message}`)
      }

      if (releasesToInsert.length > 0) {
        // Insert in chunks to avoid payload limits
        for (let i = 0; i < releasesToInsert.length; i += 20) {
          const chunk = releasesToInsert.slice(i, i + 20)
          const { error: relErr } = await supabase
            .from('artist_releases')
            .upsert(chunk, { onConflict: 'artist_id,spotify_id', ignoreDuplicates: true })
          if (relErr) {
            // If no unique constraint, use insert
            await supabase.from('artist_releases').insert(chunk)
          }
        }
      }

      const filled = [
        artistUpdates.apple_music_url && 'apple',
        artistUpdates.spotify_id && 'spotify',
        artistUpdates.youtube_url && 'youtube',
        artistUpdates.instagram_url && 'insta',
        artistUpdates.tiktok_url && 'tiktok',
        artistUpdates.genius_url && 'genius',
        releasesToInsert.length > 0 && `${releasesToInsert.length} releases`,
      ].filter(Boolean)

      process.stdout.write(filled.length > 0 ? `✓ filled: ${filled.join(', ')}\n` : `→ no new data found\n`)
      doneSet.add(artist.id)
      saveCheckpoint([...doneSet])
      updated++

    } catch (err) {
      process.stdout.write(`✗ error: ${err.message}\n`)
      errors++
      await sleep(1000)
    }
  }

  // Remove checkpoint on full completion
  if (!countryFilter && errors === 0) {
    fs.rmSync(CHECKPOINT_PATH, { force: true })
  }

  console.log(`
─────────────────────────────────────
 Enrichment complete
 Total    : ${total}
 Updated  : ${updated}
 Skipped  : ${skipped}
 Errors   : ${errors}
─────────────────────────────────────`)
}

main().catch(err => { console.error(err); process.exit(1) })
