import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const SOURCE_PATH = path.resolve(ROOT, '..', 'top_rappers_producers_europe.txt')
const USER_AGENT = 'HotdroppzArtistVerifier/1.0 (verified-profile-backfill)'
const NOW = new Date().toISOString()

const SOURCE_NAME = 'top_rappers_producers_europe.txt'
const VERIFY_VERSION = '2026-04-30-public-musicbrainz-wikidata'
const ARGS = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  })
)

const COUNTRY = {
  GERMANY: { code: 'de', label: 'Germany', region: 'DACH' },
  ITALY: { code: 'it', label: 'Italy', region: 'Southern Europe' },
  SPAIN: { code: 'es', label: 'Spain', region: 'Iberia' },
  FRANCE: { code: 'fr', label: 'France', region: 'Western Europe' },
  'CZECH REPUBLIC': { code: 'cz', label: 'Czech Republic', region: 'Central Europe' },
  SLOVAKIA: { code: 'sk', label: 'Slovakia', region: 'Central Europe' },
  POLAND: { code: 'pl', label: 'Poland', region: 'Central Europe' },
  RUSSIA: { code: 'ru', label: 'Russia', region: 'Eastern Europe' },
  'BALKAN COUNTRIES': { code: 'global', label: 'Balkans', region: 'Balkans' },
  NETHERLANDS: { code: 'nl', label: 'Netherlands', region: 'Benelux' },
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().trim()
}

function cleanName(value) {
  return String(value || '').replace(/\s*\(.+?\)\s*/g, '').trim()
}

function encodeUrl(value) {
  return encodeURIComponent(value)
}

function headerCountry(line) {
  const base = line.replace(/\s*\(.+\)$/, '')
  if (base.startsWith('BALKAN COUNTRIES')) return COUNTRY['BALKAN COUNTRIES']
  if (base.startsWith('NETHERLANDS')) return COUNTRY.NETHERLANDS
  return COUNTRY[base] || null
}

function countryFromNote(note, fallback) {
  const n = normalize(note)
  if (n.includes('serbia')) return { code: 'sr', label: 'Serbia', region: 'Balkans' }
  if (n.includes('croatia')) return { code: 'hr', label: 'Croatia', region: 'Balkans' }
  if (n.includes('bosnia')) return { code: 'bs', label: 'Bosnia and Herzegovina', region: 'Balkans' }
  return fallback
}

function scoreFor(rank, role) {
  if (!rank) return role === 'producer' ? 62 : 68
  const base = role === 'producer' ? 72 : 92
  const step = role === 'producer' ? 0.9 : 1.05
  return Math.max(role === 'producer' ? 55 : 58, Math.round((base - (rank - 1) * step) * 100) / 100)
}

function priorityFor(rank) {
  if (rank && rank <= 5) return 'critical'
  if (rank && rank <= 20) return 'high'
  return 'medium'
}

function boostFor(priority) {
  if (priority === 'critical') return 1.35
  if (priority === 'high') return 1.2
  if (priority === 'medium') return 1.05
  return 1
}

function parseSourceFile() {
  const rows = new Map()
  let currentCountry = null
  let role = 'rapper'

  for (const raw of fs.readFileSync(SOURCE_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^=+$/.test(line)) continue
    if (/^Rappers\//.test(line)) {
      role = 'rapper'
      continue
    }
    if (/^Producers:/.test(line)) {
      role = 'producer'
      continue
    }

    const country = headerCountry(line)
    if (country) {
      currentCountry = country
      continue
    }

    const match = line.match(/^(\d+)\.\s*(.+)$/)
    if (!match || !currentCountry) continue

    const rank = Number(match[1])
    const rawName = match[2].trim()
    const note = (rawName.match(/\((.+)\)/) || [])[1] || ''
    const name = cleanName(rawName)
    const resolvedCountry = currentCountry.label === 'Balkans'
      ? countryFromNote(note, currentCountry)
      : currentCountry

    const profile = {
      name,
      rank,
      role,
      country: resolvedCountry,
      note: note || null,
      rawName,
    }
    const key = normalize(name)
    const existing = rows.get(key)
    if (!existing || scoreFor(rank, role) > scoreFor(existing.rank, existing.role)) rows.set(key, profile)
  }

  return rows
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function getMusicBrainzCandidate(name, expectedCountry) {
  const query = `artist:"${name.replace(/"/g, '\\"')}"`
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeUrl(query)}&fmt=json&limit=5`
  const data = await fetchJson(url)
  const candidates = data.artists || []
  const exact = candidates
    .map((artist) => ({ artist, score: scoreMusicBrainzArtist(artist, name, expectedCountry) }))
    .filter((entry) => entry.score >= 75)
    .sort((a, b) => b.score - a.score)
  return exact[0]?.artist || null
}

function scoreMusicBrainzArtist(artist, name, expectedCountry) {
  const exactName = normalize(artist.name) === normalize(name)
  const aliasMatch = (artist.aliases || []).some((alias) => normalize(alias.name) === normalize(name))
  if (!exactName && !aliasMatch) return 0
  let score = exactName ? 70 : 55
  if (artist.type === 'Person' || artist.type === 'Group') score += 10
  const area = normalize(artist.area?.name || artist['begin-area']?.name)
  if (area && normalize(expectedCountry.label).includes(area)) score += 10
  if (area && area.includes(normalize(expectedCountry.label))) score += 10
  if (Number(artist.score || 0) >= 90) score += 10
  return score
}

async function getMusicBrainzDetails(mbid) {
  const url = `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels+aliases+tags&fmt=json`
  return fetchJson(url)
}

function relationUrls(details) {
  const links = {}
  for (const relation of details.relations || []) {
    const type = relation.type
    const resource = relation.url?.resource || null
    if (!resource) continue
    if (type === 'social network' && /instagram\.com/i.test(resource)) links.instagram_url = resource
    if (type === 'social network' && /tiktok\.com/i.test(resource)) links.tiktok_url = resource
    if (type === 'official homepage') links.official_website = resource
    if (type === 'youtube' || /youtube\.com|youtu\.be/i.test(resource)) links.youtube_url = resource
    if (/spotify\.com\/artist\//i.test(resource)) links.spotify_url = resource
    if (/music\.apple\.com/i.test(resource)) links.apple_music_url = resource
    if (/genius\.com\/artists\//i.test(resource)) links.genius_url = resource
    if (/soundcloud\.com/i.test(resource)) links.soundcloud_url = resource
    if (/facebook\.com/i.test(resource)) links.facebook_url = resource
  }
  return links
}

function idFromUrl(url, pattern) {
  const match = String(url || '').match(pattern)
  return match?.[1] || null
}

function handlesFromLinks(links) {
  return {
    spotify_id: idFromUrl(links.spotify_url, /spotify\.com\/artist\/([A-Za-z0-9]+)/),
    apple_music_id: idFromUrl(links.apple_music_url, /\/artist\/[^/]+\/(\d+)/),
    youtube_channel_id: idFromUrl(links.youtube_url, /(?:channel\/)(UC[A-Za-z0-9_-]+)/),
    instagram_handle: idFromUrl(links.instagram_url, /instagram\.com\/([^/?#]+)/),
    tiktok_handle: idFromUrl(links.tiktok_url, /tiktok\.com\/@([^/?#]+)/),
  }
}

async function wikidataForMusicBrainz(mbid) {
  const query = `
    SELECT ?item ?itemLabel ?itemDescription ?image ?officialWebsite ?spotifyId ?youtubeId ?instagram ?tiktok ?appleMusicId ?musicBrainzId WHERE {
      ?item wdt:P434 "${mbid}".
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P856 ?officialWebsite. }
      OPTIONAL { ?item wdt:P1902 ?spotifyId. }
      OPTIONAL { ?item wdt:P2397 ?youtubeId. }
      OPTIONAL { ?item wdt:P2003 ?instagram. }
      OPTIONAL { ?item wdt:P7085 ?tiktok. }
      OPTIONAL { ?item wdt:P2850 ?appleMusicId. }
      OPTIONAL { ?item wdt:P434 ?musicBrainzId. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 1`
  const url = `https://query.wikidata.org/sparql?query=${encodeUrl(query)}&format=json`
  const data = await fetchJson(url)
  const row = data.results?.bindings?.[0]
  if (!row) return null
  return {
    qid: row.item?.value?.split('/').pop() || null,
    label: row.itemLabel?.value || null,
    description: row.itemDescription?.value || null,
    image_url: row.image?.value || null,
    official_website: row.officialWebsite?.value || null,
    spotify_id: row.spotifyId?.value || null,
    youtube_channel_id: row.youtubeId?.value || null,
    instagram_handle: row.instagram?.value || null,
    tiktok_handle: row.tiktok?.value || null,
    apple_music_id: row.appleMusicId?.value || null,
  }
}

function wikidataLinks(wikidata) {
  if (!wikidata) return {}
  const links = {}
  if (wikidata.official_website) links.official_website = wikidata.official_website
  if (wikidata.spotify_id) links.spotify_url = `https://open.spotify.com/artist/${wikidata.spotify_id}`
  if (wikidata.youtube_channel_id) links.youtube_url = `https://www.youtube.com/channel/${wikidata.youtube_channel_id}`
  if (wikidata.instagram_handle) links.instagram_url = `https://www.instagram.com/${wikidata.instagram_handle}`
  if (wikidata.tiktok_handle) links.tiktok_url = `https://www.tiktok.com/@${wikidata.tiktok_handle}`
  if (wikidata.apple_music_id) links.apple_music_url = `https://music.apple.com/artist/${wikidata.apple_music_id}`
  return links
}

function shortDescription(name, source, mbDetails, wikidata) {
  if (wikidata?.description && !/^Wikimedia disambiguation page$/i.test(wikidata.description)) {
    return `${name} is ${article(wikidata.description)}.`
  }

  const area = mbDetails?.area?.name || mbDetails?.['begin-area']?.name || source.country.label
  const role = source.role === 'producer' ? 'producer' : 'rapper'
  return `${name} is a ${area} ${role} verified through MusicBrainz${wikidata?.qid ? ' and Wikidata' : ''}.`
}

function article(text) {
  const trimmed = String(text).trim()
  if (/^(a|an|the)\s/i.test(trimmed)) return trimmed
  return `${/^[aeiou]/i.test(trimmed) ? 'an' : 'a'} ${trimmed}`
}

function verifiedFlags(links, evidence) {
  return {
    spotify_verified: Boolean(links.spotify_url && evidence.spotify_url),
    apple_verified: Boolean(links.apple_music_url && evidence.apple_music_url),
    youtube_verified: Boolean(links.youtube_url && evidence.youtube_url),
    instagram_verified: Boolean(links.instagram_url && evidence.instagram_url),
    facebook_verified: Boolean(links.facebook_url && evidence.facebook_url),
    tiktok_verified: Boolean(links.tiktok_url && evidence.tiktok_url),
    soundcloud_verified: Boolean(links.soundcloud_url && evidence.soundcloud_url),
    genius_verified: Boolean(links.genius_url && evidence.genius_url),
  }
}

async function main() {
  loadEnv()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const sourceProfiles = parseSourceFile()

  let { data: artists, error } = await supabase
    .from('artists')
    .select('id,name,normalized_name,country,genre,tags,metadata,aliases')
    .order('name')
  if (error) throw error

  if (ARGS.resume === 'true') {
    artists = artists.filter((artist) => !artist.metadata?.verification?.status)
  }

  const start = Number(ARGS.start || 0)
  const limit = ARGS.limit ? Number(ARGS.limit) : artists.length
  artists = artists.slice(start, start + limit)

  const summary = {
    checked: artists.length,
    verified: 0,
    partial: 0,
    notVerified: 0,
    linkRowsUpserted: 0,
    imageRowsUpserted: 0,
    failures: [],
  }

  for (let index = 0; index < artists.length; index += 1) {
    const artist = artists[index]
    const source = sourceProfiles.get(normalize(artist.normalized_name || artist.name)) || {
      name: artist.name,
      rank: null,
      role: artist.genre === 'producer' ? 'producer' : 'rapper',
      country: COUNTRY[artist.country?.toUpperCase?.()] || { code: artist.country || 'global', label: artist.country || 'Global', region: 'Unknown' },
      note: null,
      rawName: artist.name,
    }

    process.stdout.write(`[${index + 1}/${artists.length}] ${artist.name} ... `)

    let mbCandidate = null
    let mbDetails = null
    let wikidata = null
    let verifiedLevel = 'unverified'
    const evidence = []

    try {
      mbCandidate = await getMusicBrainzCandidate(artist.name, source.country)
      await sleep(1100)
      if (mbCandidate?.id) {
        mbDetails = await getMusicBrainzDetails(mbCandidate.id)
        await sleep(1100)
        evidence.push({
          source: 'MusicBrainz',
          url: `https://musicbrainz.org/artist/${mbCandidate.id}`,
          field: 'identity',
          value: mbDetails.name,
          retrieved_at: NOW,
        })
        wikidata = await wikidataForMusicBrainz(mbCandidate.id)
        await sleep(350)
        if (wikidata?.qid) {
          evidence.push({
            source: 'Wikidata',
            url: `https://www.wikidata.org/wiki/${wikidata.qid}`,
            field: 'identity',
            value: wikidata.label || artist.name,
            retrieved_at: NOW,
          })
        }
        verifiedLevel = wikidata?.qid ? 'strong' : 'musicbrainz'
      }

      const mbLinks = mbDetails ? relationUrls(mbDetails) : {}
      const wdLinks = wikidataLinks(wikidata)
      const links = { ...mbLinks, ...wdLinks }
      const ids = { ...handlesFromLinks(links) }
      if (wikidata?.spotify_id) ids.spotify_id = wikidata.spotify_id
      if (wikidata?.apple_music_id) ids.apple_music_id = wikidata.apple_music_id
      if (wikidata?.youtube_channel_id) ids.youtube_channel_id = wikidata.youtube_channel_id
      if (wikidata?.instagram_handle) ids.instagram_handle = wikidata.instagram_handle
      if (wikidata?.tiktok_handle) ids.tiktok_handle = wikidata.tiktok_handle

      for (const [field, value] of Object.entries(links)) {
        if (!value) continue
        evidence.push({
          source: wdLinks[field] === value ? 'Wikidata' : 'MusicBrainz',
          url: wdLinks[field] === value && wikidata?.qid ? `https://www.wikidata.org/wiki/${wikidata.qid}` : `https://musicbrainz.org/artist/${mbCandidate?.id}`,
          field,
          value,
          retrieved_at: NOW,
        })
      }

      const priority = priorityFor(source.rank)
      const tags = Array.from(new Set([
        ...(artist.tags || []).filter((tag) => !/^verified:/.test(tag)),
        'european-rap',
        source.role,
        source.country.code,
        source.country.region.toLowerCase().replace(/\s+/g, '-'),
        `verified:${verifiedLevel}`,
      ].filter(Boolean)))

      const metadata = {
        ...(artist.metadata || {}),
        source: SOURCE_NAME,
        source_rank: source.rank,
        source_role: source.role,
        source_country_label: source.country.label,
        source_region: source.country.region,
        original_entry: source.rawName,
        note: source.note,
        verification: {
          version: VERIFY_VERSION,
          status: verifiedLevel,
          verified_at: NOW,
          musicbrainz_id: mbCandidate?.id || null,
          wikidata_qid: wikidata?.qid || null,
          evidence,
          gaps: fieldGaps(links, wikidata),
        },
      }

      const artistUpdate = {
        country: source.country.code,
        genre: source.role === 'producer' ? 'producer' : 'rap',
        description: verifiedLevel === 'unverified'
          ? null
          : shortDescription(artist.name, source, mbDetails, wikidata),
        aliases: Array.from(new Set([
          ...(artist.aliases || []),
          ...((mbDetails?.aliases || []).map((alias) => alias.name).filter(Boolean).slice(0, 8)),
        ])),
        profile_image_url: wikidata?.image_url || null,
        cover_image_url: null,
        spotify_url: links.spotify_url || null,
        youtube_url: links.youtube_url || null,
        apple_music_url: links.apple_music_url || null,
        instagram_url: links.instagram_url || null,
        tiktok_url: links.tiktok_url || null,
        genius_url: links.genius_url || null,
        tags,
        base_score: scoreFor(source.rank, source.role),
        priority_level: priority,
        boost_multiplier: boostFor(priority),
        ai_confidence: verifiedLevel === 'strong' ? 0.95 : verifiedLevel === 'musicbrainz' ? 0.85 : 0.25,
        ai_fetched_at: NOW,
        metadata,
        is_active: verifiedLevel !== 'unverified',
        tracking_enabled: verifiedLevel !== 'unverified',
        is_tracking_active: verifiedLevel !== 'unverified',
        updated_at: NOW,
      }

      const { error: updateError } = await supabase.from('artists').update(artistUpdate).eq('id', artist.id)
      if (updateError) throw updateError

      const linkPayload = {
        artist_id: artist.id,
        spotify_url: links.spotify_url || null,
        apple_music_url: links.apple_music_url || null,
        youtube_url: links.youtube_url || null,
        youtube_channel_id: ids.youtube_channel_id || null,
        instagram_url: links.instagram_url || null,
        facebook_url: links.facebook_url || null,
        tiktok_url: links.tiktok_url || null,
        soundcloud_url: links.soundcloud_url || null,
        genius_url: links.genius_url || null,
        spotify_id: ids.spotify_id || null,
        apple_music_id: ids.apple_music_id || null,
        instagram_handle: ids.instagram_handle || null,
        tiktok_handle: ids.tiktok_handle || null,
        ...verifiedFlags(links, Object.fromEntries(evidence.map((item) => [item.field, item]))),
        last_enriched_at: NOW,
        updated_at: NOW,
      }
      const { error: linkError } = await supabase
        .from('artist_links')
        .upsert(linkPayload, { onConflict: 'artist_id' })
      if (linkError) throw linkError
      summary.linkRowsUpserted += 1

      if (wikidata?.image_url) {
        await supabase
          .from('artist_images')
          .delete()
          .eq('artist_id', artist.id)
          .eq('type', 'profile')
        const { error: imageError } = await supabase
          .from('artist_images')
          .insert({
            artist_id: artist.id,
            image_url: wikidata.image_url,
            type: 'profile',
            mime_type: null,
          })
        if (!imageError) summary.imageRowsUpserted += 1
      }

      if (verifiedLevel === 'strong') summary.verified += 1
      else if (verifiedLevel === 'musicbrainz') summary.partial += 1
      else summary.notVerified += 1
      process.stdout.write(`${verifiedLevel}\n`)
    } catch (err) {
      summary.failures.push({ artist: artist.name, message: err.message })
      summary.notVerified += 1
      process.stdout.write(`failed: ${err.message}\n`)
      await sleep(1500)
    }
  }

  console.log(JSON.stringify(summary, null, 2))
}

function fieldGaps(links, wikidata) {
  const gaps = []
  if (!wikidata?.image_url) gaps.push('profile_image_url')
  if (!links.spotify_url) gaps.push('spotify_url')
  if (!links.youtube_url) gaps.push('youtube_url')
  if (!links.apple_music_url) gaps.push('apple_music_url')
  if (!links.instagram_url) gaps.push('instagram_url')
  if (!links.tiktok_url) gaps.push('tiktok_url')
  if (!links.genius_url) gaps.push('genius_url')
  return gaps
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
