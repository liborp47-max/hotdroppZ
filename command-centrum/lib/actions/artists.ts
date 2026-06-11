'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'

async function getDb() {
  return createAdminClient() ?? (await createClient())
}

async function requireAuth() {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
}

export async function updateArtistOverview(
  artistId: string,
  data: {
    name: string
    country: string
    city: string | null
    genre: string
    description: string | null
    aliases: string[]
    negative_keywords: string[]
    tags: string[]
  }
) {
  await requireAuth()
  const db = await getDb()

  const { error } = await db
    .from('artists')
    .update({
      name:              data.name,
      normalized_name:   data.name.toLowerCase().trim(),
      country:           data.country,
      city:              data.city,
      genre:             data.genre,
      description:       data.description,
      aliases:           data.aliases,
      negative_keywords: data.negative_keywords,
      tags:              data.tags,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', artistId)

  if (error) throw new Error(error.message)
}

export async function updateArtistTracking(
  artistId: string,
  data: {
    base_score: number
    priority_level: string
    is_active: boolean
    is_tracking_active: boolean
    tracking_enabled: boolean
  }
) {
  await requireAuth()
  const db = await getDb()

  const { error } = await db
    .from('artists')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', artistId)

  if (error) throw new Error(error.message)
}

export async function updateArtistLinks(
  artistId: string,
  payload: Record<string, unknown>,
  hasExisting: boolean
) {
  await requireAuth()
  const db = await getDb()

  const data = { ...payload, artist_id: artistId }
  const { error } = hasExisting
    ? await db.from('artist_links').update(data).eq('artist_id', artistId)
    : await db.from('artist_links').insert(data)

  if (error) throw new Error(error.message)
}
