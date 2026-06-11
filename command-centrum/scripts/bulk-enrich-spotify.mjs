/**
 * bulk-enrich-spotify.mjs
 * Fills spotify_id + full artist profile + discography for active artists
 * missing spotify_id, using the MusicBrainz public API (no auth, 1 req/s).
 *
 * Per artist, one MB call fetches:
 *   - Spotify / YouTube / Instagram URLs
 *   - Genres (MB tags)
 *   - Bio hint (disambiguation text)
 *   - City (begin-area)
 *   - Full discography (release groups → artist_releases table)
 *
 * Run from command-centrum/:
 *   node scripts/bulk-enrich-spotify.mjs
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const v = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE env vars'); process.exit(1)
}

const MB_BASE  = 'https://musicbrainz.org/ws/2'
const MB_UA    = 'HotDroppZ/1.0 (libor.p47@gmail.com)'
const MB_DELAY = 1150   // >1 req/s anon limit with a small buffer

const SB_HEADERS = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ─── MusicBrainz helpers ──────────────────────────────────────────────────────

async function mbGet(urlPath) {
  const res = await fetch(`${MB_BASE}${urlPath}`, {
    headers: { 'User-Agent': MB_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (res.status === 429) {
    await sleep(5_000)
    return mbGet(urlPath)   // one retry after rate-limit
  }
  if (!res.ok) return null
  return res.json()
}

/** Full artist fetch — url-rels (Spotify/YT/IG) + tags (genres) + release-groups (discography) */
async function getArtistFull(mbid) {
  return mbGet(`/artist/${mbid}?inc=url-rels+tags+release-groups&fmt=json`)
}

/** Name search → best MBID */
async function mbidFromName(name) {
  const q    = encodeURIComponent(`artist:"${name}"`)
  const data = await mbGet(`/artist?query=${q}&limit=3&fmt=json`)
  if (!data?.artists?.length) return null
  const exact = data.artists.find(a => a.name.toLowerCase() === name.toLowerCase())
  return (exact ?? data.artists[0]).id
}

// ─── Data extraction ──────────────────────────────────────────────────────────

function extractUrls(relations = []) {
  const out = { spotify_id: null, spotify_url: null, youtube_url: null, instagram_url: null }
  for (const rel of relations) {
    const url = rel.url?.resource ?? ''
    const ms = url.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/)
    if (ms) { out.spotify_id = ms[1]; out.spotify_url = url; continue }
    if (/youtube\.com\/(channel|c|user)\//.test(url) || url.includes('youtube.com/@')) {
      out.youtube_url = out.youtube_url ?? url; continue
    }
    if (/instagram\.com\/[^/]+\/?$/.test(url) && !url.includes('instagram.com/p/')) {
      out.instagram_url = out.instagram_url ?? url
    }
  }
  return out
}

function extractGenres(tags = []) {
  return tags
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(t => t.name)
}

function normalizeDate(d) {
  if (!d) return null
  if (/^\d{4}$/.test(d))       return `${d}-01-01`
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`
  return d.slice(0, 10)
}

const RELEASE_TYPE_MAP = {
  'Album':          'album',
  'Single':         'single',
  'EP':             'ep',
  'Mixtape/Street': 'mixtape',
  'Live':           'album',
  'Compilation':    'album',
  'Soundtrack':     'album',
}

function extractReleaseGroups(releaseGroups = [], artistId) {
  return releaseGroups
    .filter(rg => {
      const mapped = RELEASE_TYPE_MAP[rg['primary-type']]
      return mapped && rg.id && rg.title && rg['first-release-date']
    })
    .map(rg => ({
      artist_id:      artistId,
      musicbrainz_id: rg.id,
      title:          rg.title,
      type:           RELEASE_TYPE_MAP[rg['primary-type']],
      release_date:   normalizeDate(rg['first-release-date']),
      is_new_release: false,
      is_hot_trend:   false,
    }))
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchBatch(offset, batchSize, backfillMode = false) {
  // backfill: artists that have spotify_id but no discography yet
  // normal: artists missing spotify_id entirely
  const filter = backfillMode
    ? `&spotify_id=not.is.null`
    : `&spotify_id=is.null`
  const url = `${SUPABASE_URL}/rest/v1/artists`
    + `?select=id,name,metadata`
    + `&is_active=eq.true`
    + filter
    + `&order=base_score.desc`
    + `&limit=${batchSize}&offset=${offset}`
  const res   = await fetch(url, { headers: { ...SB_HEADERS, Prefer: 'count=exact' } })
  const total = parseInt(res.headers.get('content-range')?.split('/')[1] ?? '0', 10)
  const rows  = await res.json()
  return { rows: Array.isArray(rows) ? rows : [], total }
}

async function updateArtist(id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artists?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
    body:    JSON.stringify(updates),
  })
  return res.ok
}

async function upsertReleases(releases) {
  if (!releases.length) return true
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artist_releases?on_conflict=musicbrainz_id`, {
    method:  'POST',
    headers: { ...SB_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(releases),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.warn(`\n    ⚠ releases upsert failed: ${txt.slice(0, 120)}`)
  }
  return res.ok
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const backfill = process.argv.includes('--backfill')
  const mode     = backfill ? 'BACKFILL (discography for already-enriched artists)' : 'ENRICH (artists missing spotify_id)'
  console.log(`HotDroppZ artist enrichment — ${mode}\n`)

  const BATCH = 400
  const { rows: artists, total } = await fetchBatch(0, BATCH, backfill)
  const label = backfill ? 'Artists with Spotify but missing discography' : 'Artists missing spotify_id'
  console.log(`${label}: ${total} (processing up to ${BATCH})\n`)

  let enriched  = 0   // got Spotify ID
  let partial   = 0   // got profile data but no Spotify on MB
  let notFound  = 0   // not on MusicBrainz at all
  let errors    = 0
  let releases  = 0
  const failed  = []

  for (let i = 0; i < artists.length; i++) {
    const artist     = artists[i]
    const knownMbid  = artist.metadata?.verification?.musicbrainz_id ?? null
    const label      = `[${String(i + 1).padStart(3)}/${artists.length}] ${artist.name.padEnd(36)}`

    process.stdout.write(label)

    try {
      let mbid = knownMbid

      // Step 1: resolve MBID via name search if not already known
      if (!mbid) {
        process.stdout.write(`search→ `)
        mbid = await mbidFromName(artist.name)
        await sleep(MB_DELAY)
      }

      if (!mbid) {
        process.stdout.write(`— not on MusicBrainz\n`)
        notFound++
        failed.push(artist.name)
        continue
      }

      // Step 2: fetch full profile in one call
      process.stdout.write(`fetch→ `)
      const data = await getArtistFull(mbid)
      await sleep(MB_DELAY)

      if (!data) {
        process.stdout.write(`✗ MB unreachable\n`)
        errors++
        failed.push(artist.name)
        continue
      }

      const urls   = extractUrls(data.relations ?? [])
      const genres = extractGenres(data.tags ?? [])
      const discog = extractReleaseGroups(data['release-groups'] ?? [], artist.id)
      const bio    = data.disambiguation ?? null
      const city   = data.area?.name ?? data['begin-area']?.name ?? null

      // Build artist update — never overwrite existing description/city with null
      const artistUpdate = {
        ...(urls.spotify_id    ? { spotify_id: urls.spotify_id, spotify_url: urls.spotify_url } : {}),
        ...(urls.youtube_url   ? { youtube_url: urls.youtube_url }   : {}),
        ...(urls.instagram_url ? { instagram_url: urls.instagram_url } : {}),
        ...(genres.length      ? { genres }                           : {}),
        ...(bio                ? { description: bio }                 : {}),
        ...(city               ? { city }                             : {}),
        ai_fetched_at: new Date().toISOString(),
      }

      // In backfill mode skip profile update — only upsert releases
      if (!backfill) {
        const ok = await updateArtist(artist.id, artistUpdate)
        if (!ok) {
          process.stdout.write(`✗ db write failed\n`)
          errors++
          failed.push(artist.name)
          continue
        }
      }

      // Upsert discography regardless of whether Spotify was found
      let relCount = 0
      if (discog.length) {
        const ok = await upsertReleases(discog)
        if (ok) { relCount = discog.length; releases += relCount }
      }

      if (backfill) {
        process.stdout.write(`✓ releases:${relCount}\n`)
        enriched++
      } else if (urls.spotify_id) {
        const genreStr = genres.slice(0, 2).join(',') || '—'
        process.stdout.write(`✓ spotify:${urls.spotify_id.slice(0, 12)}… genres:[${genreStr}] releases:${relCount}\n`)
        enriched++
      } else {
        const extras = [
          urls.youtube_url   ? 'yt' : '',
          urls.instagram_url ? 'ig' : '',
          genres.length      ? `genres:${genres.length}` : '',
          relCount           ? `releases:${relCount}` : '',
        ].filter(Boolean).join(' ')
        process.stdout.write(`~ no Spotify on MB${extras ? ` (${extras})` : ''}\n`)
        partial++
        failed.push(artist.name)
      }

    } catch (e) {
      process.stdout.write(`✗ ${e.message}\n`)
      errors++
      failed.push(artist.name)
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Spotify enriched:   ${enriched}`)
  console.log(`Profile only:       ${partial}  (genres/releases saved, no Spotify link)`)
  console.log(`Not on MB:          ${notFound}`)
  console.log(`Errors:             ${errors}`)
  console.log(`Discography rows:   ${releases}  total releases upserted`)

  if (failed.length) {
    console.log(`\nStill missing Spotify (need manual or Spotify API creds):`)
    failed.forEach(n => console.log(`  - ${n}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
