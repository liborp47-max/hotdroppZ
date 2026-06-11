// Skript pro import evropských rapperů a producentů do Supabase
// Používá existující služby projektu (findOrCreateArtist, enrichArtistProfile, trackArtistRelease)

import { findOrCreateArtist, enrichArtistProfile, trackArtistRelease } from '../lib/services/artist-service'
import fs from 'fs/promises'
import path from 'path'

const FILE_PATH = process.argv[2] || path.resolve(__dirname, '../../../../../Downloads/top_rappers_producers_europe.txt')

async function parseArtistsFile(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const artists: { name: string; country: string; type: 'rapper' | 'producer' }[] = []
  let country = ''
  let type: 'rapper' | 'producer' = 'rapper'
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^={5,}/.test(trimmed)) continue

    // Detekce názvu státu: pouze velká písmena, případně mezery, délka 3+ znaků
    if (/^[A-Z][A-Z ]{2,}$/.test(trimmed) && !/RAPPERS|PRODUCERS|COUNTRIES|STREET|BY|AND/.test(trimmed)) {
      country = trimmed
      console.log('Detected country:', country)
      continue
    }

    if (/Rappers/.test(trimmed)) {
      type = 'rapper'
      console.log('Detected type: rapper')
    }
    if (/Producers/.test(trimmed)) {
      type = 'producer'
      console.log('Detected type: producer')
    }

    const match = /^\d+\.\s*(.+)$/.exec(trimmed)
    if (match && country) {
      const name = match[1].replace(/\(.+\)/, '').trim()
      console.log('Detected artist:', name, 'Country:', country, 'Type:', type)
      artists.push({ name, country, type })
    }
  }
  console.log('Total detected artists:', artists.length)
  return artists
}

async function main() {
  const artists = await parseArtistsFile(FILE_PATH)
  let imported = 0, enriched = 0
  const errors: string[] = []
  for (const artist of artists) {
    try {
      const genre = artist.type === 'producer' ? 'producer' : 'rap'
      const a = await findOrCreateArtist(artist.name, artist.country, genre)
      if (!a) continue
      imported++
      await enrichArtistProfile(a.id, { fetchSpotify: true, fetchYouTube: true, fetchGenius: true })
      enriched++
      // Volitelně: trackArtistRelease(a.id, ...)
    } catch (e: any) {
      errors.push(`${artist.name} (${artist.country}): ${e.message}`)
    }
  }
  console.log(`Imported: ${imported}, Enriched: ${enriched}, Errors: ${errors.length}`)
  if (errors.length) console.log(errors.join('\n'))
}

main()
