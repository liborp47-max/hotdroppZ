import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const NOW = new Date().toISOString()
const USER_AGENT = 'HotdroppzArtistSupplement/1.0'

function loadEnv() {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().trim()
}

function encodeUrl(value) {
  return encodeURIComponent(value)
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function searchAppleArtist(name) {
  const url = `https://itunes.apple.com/search?term=${encodeUrl(name)}&media=music&entity=musicArtist&limit=5`
  const data = await fetchJson(url)
  const results = data.results || []
  const exact = results.find((item) => normalize(item.artistName) === normalize(name))
  const fallback = results.find((item) => normalize(item.artistName).includes(normalize(name)) || normalize(name).includes(normalize(item.artistName)))
  const best = exact || fallback
  if (!best?.artistLinkUrl || !best?.artistId) return null
  return {
    artist_url: best.artistLinkUrl,
    artist_id: String(best.artistId),
    artist_name: best.artistName,
  }
}

async function searchWikidataEntity(name) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeUrl(name)}&language=en&format=json&limit=5`
  const data = await fetchJson(url)
  const candidates = (data.search || []).filter((item) => {
    const desc = normalize(item.description)
    return normalize(item.label) === normalize(name) && /(rapper|musician|singer|record producer|producer|hip hop|musical artist|band|music group)/.test(desc)
  })
  return candidates[0] || null
}

async function wikidataEntityDetails(qid) {
  const query = `
    SELECT ?item ?itemLabel ?itemDescription ?image ?spotifyId ?youtubeId ?instagram ?tiktok ?appleMusicId ?officialWebsite WHERE {
      BIND(wd:${qid} AS ?item)
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P856 ?officialWebsite. }
      OPTIONAL { ?item wdt:P1902 ?spotifyId. }
      OPTIONAL { ?item wdt:P2397 ?youtubeId. }
      OPTIONAL { ?item wdt:P2003 ?instagram. }
      OPTIONAL { ?item wdt:P7085 ?tiktok. }
      OPTIONAL { ?item wdt:P2850 ?appleMusicId. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1`
  const data = await fetchJson(`https://query.wikidata.org/sparql?query=${encodeUrl(query)}&format=json`)
  const row = data.results?.bindings?.[0]
  if (!row) return null
  return {
    qid,
    label: row.itemLabel?.value || null,
    description: row.itemDescription?.value || null,
    image_url: row.image?.value || null,
    spotify_id: row.spotifyId?.value || null,
    youtube_channel_id: row.youtubeId?.value || null,
    instagram_handle: row.instagram?.value || null,
    tiktok_handle: row.tiktok?.value || null,
    apple_music_id: row.appleMusicId?.value || null,
    official_website: row.officialWebsite?.value || null,
  }
}

function linksFromWikidata(wd) {
  const links = {}
  if (wd?.spotify_id) links.spotify_url = `https://open.spotify.com/artist/${wd.spotify_id}`
  if (wd?.youtube_channel_id) links.youtube_url = `https://www.youtube.com/channel/${wd.youtube_channel_id}`
  if (wd?.instagram_handle) links.instagram_url = `https://www.instagram.com/${wd.instagram_handle}`
  if (wd?.tiktok_handle) links.tiktok_url = `https://www.tiktok.com/@${wd.tiktok_handle}`
  if (wd?.apple_music_id) links.apple_music_url = `https://music.apple.com/artist/${wd.apple_music_id}`
  return links
}

function evidenceItem(source, sourceUrl, field, value) {
  return { source, url: sourceUrl, field, value, retrieved_at: NOW }
}

async function main() {
  loadEnv()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id,name,metadata,description,profile_image_url,spotify_url,youtube_url,apple_music_url,instagram_url,tiktok_url,genius_url')
    .order('name')
  if (error) throw error

  const summary = {
    checked: artists.length,
    appleFilled: 0,
    wikidataFallbackMatched: 0,
    spotifyFilled: 0,
    youtubeFilled: 0,
    instagramFilled: 0,
    tiktokFilled: 0,
    imagesFilled: 0,
    failures: [],
  }

  for (const [index, artist] of artists.entries()) {
    process.stdout.write(`[${index + 1}/${artists.length}] ${artist.name} ... `)
    try {
      const metadata = artist.metadata || {}
      const verification = metadata.verification || {}
      const evidence = [...(verification.evidence || [])]
      const updates = {}
      const linkUpdates = { artist_id: artist.id, updated_at: NOW, last_enriched_at: NOW }

      if (!artist.apple_music_url) {
        const apple = await searchAppleArtist(artist.name)
        await sleep(150)
        if (apple) {
          updates.apple_music_url = apple.artist_url
          linkUpdates.apple_music_url = apple.artist_url
          linkUpdates.apple_music_id = apple.artist_id
          linkUpdates.apple_verified = true
          evidence.push(evidenceItem('Apple iTunes Search API', 'https://performance-partners.apple.com/search-api', 'apple_music_url', apple.artist_url))
          summary.appleFilled += 1
        }
      }

      let wd = null
      if (verification.status === 'unverified' || (!artist.profile_image_url || !artist.spotify_url || !artist.youtube_url || !artist.instagram_url || !artist.tiktok_url)) {
        const entity = await searchWikidataEntity(artist.name)
        await sleep(200)
        if (entity?.id && entity.id !== verification.wikidata_qid) {
          wd = await wikidataEntityDetails(entity.id)
          await sleep(250)
          if (wd?.qid) {
            summary.wikidataFallbackMatched += 1
            evidence.push(evidenceItem('Wikidata', `https://www.wikidata.org/wiki/${wd.qid}`, 'identity', wd.label || artist.name))
          }
        }
      }

      if (wd) {
        const wdLinks = linksFromWikidata(wd)
        if (!artist.profile_image_url && wd.image_url) {
          updates.profile_image_url = wd.image_url
          evidence.push(evidenceItem('Wikidata', `https://www.wikidata.org/wiki/${wd.qid}`, 'profile_image_url', wd.image_url))
          summary.imagesFilled += 1
        }
        if (!artist.description && wd.description) {
          updates.description = `${artist.name} is ${article(wd.description)}.`
        }
        for (const [field, value] of Object.entries(wdLinks)) {
          if (!artist[field] && value) {
            updates[field] = value
            linkUpdates[field] = value
            evidence.push(evidenceItem('Wikidata', `https://www.wikidata.org/wiki/${wd.qid}`, field, value))
            if (field === 'spotify_url') {
              linkUpdates.spotify_id = wd.spotify_id
              linkUpdates.spotify_verified = true
              summary.spotifyFilled += 1
            }
            if (field === 'youtube_url') {
              linkUpdates.youtube_channel_id = wd.youtube_channel_id
              linkUpdates.youtube_verified = true
              summary.youtubeFilled += 1
            }
            if (field === 'instagram_url') {
              linkUpdates.instagram_handle = wd.instagram_handle
              linkUpdates.instagram_verified = true
              summary.instagramFilled += 1
            }
            if (field === 'tiktok_url') {
              linkUpdates.tiktok_handle = wd.tiktok_handle
              linkUpdates.tiktok_verified = true
              summary.tiktokFilled += 1
            }
          }
        }
      }

      if (Object.keys(updates).length > 0 || evidence.length !== (verification.evidence || []).length) {
        const newMetadata = {
          ...metadata,
          verification: {
            ...verification,
            supplemental_verified_at: NOW,
            evidence,
            gaps: fieldGaps({ ...artist, ...updates }),
          },
        }
        const { error: updateError } = await supabase
          .from('artists')
          .update({ ...updates, metadata: newMetadata, updated_at: NOW })
          .eq('id', artist.id)
        if (updateError) throw updateError
      }

      if (Object.keys(linkUpdates).length > 4) {
        const { error: linkError } = await supabase
          .from('artist_links')
          .upsert(linkUpdates, { onConflict: 'artist_id' })
        if (linkError) throw linkError
      }

      process.stdout.write('ok\n')
    } catch (err) {
      summary.failures.push({ artist: artist.name, message: err.message })
      process.stdout.write(`failed: ${err.message}\n`)
      await sleep(500)
    }
  }

  console.log(JSON.stringify(summary, null, 2))
}

function article(text) {
  const trimmed = String(text).trim()
  if (/^(a|an|the)\s/i.test(trimmed)) return trimmed
  return `${/^[aeiou]/i.test(trimmed) ? 'an' : 'a'} ${trimmed}`
}

function fieldGaps(row) {
  return ['description', 'profile_image_url', 'spotify_url', 'youtube_url', 'apple_music_url', 'instagram_url', 'tiktok_url', 'genius_url']
    .filter((field) => !row[field])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
