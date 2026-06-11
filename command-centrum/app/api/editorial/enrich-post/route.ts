import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { searchSpotify } from '@/lib/services/spotify'
import { searchYouTube } from '@/lib/services/youtube'
import { searchGenius } from '@/lib/services/genius'
import { resolveImage } from '@/lib/services/image/image-engine'

function extractYouTubeQuery(title: string, entity: string): string {
  const clean = title.replace(new RegExp(entity, 'gi'), '').replace(/[^\w\s]/g, ' ').trim()
  return `${entity} ${clean.split(/\s+/).slice(0, 4).join(' ')} official`.trim()
}

function extractTrack(title: string, artist: string): string | undefined {
  const parts = title.split(/\s[-:|]\s/)
  if (parts.length >= 2) {
    return parts.find((p) => !p.toLowerCase().includes(artist.toLowerCase().slice(0, 5)))?.trim()
  }
  return undefined
}

export async function POST(request: Request) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient() ?? authClient
  const { postId } = await request.json() as { postId: string }

  if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })

  const { data: post, error: postErr } = await db
    .from('posts')
    .select('id, title, cluster_id, source_url, category, embeds, image_url')
    .eq('id', postId)
    .single()

  if (postErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const title = post.title as string
  const category = (post.category as string | null) ?? 'eu_rap'
  const MUSIC_CATS = ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap', 'rnb']
  const isMusic = MUSIC_CATS.includes(category)
  const isVideo = [...MUSIC_CATS, 'fun'].includes(category)

  // Get main entity from cluster if available
  let mainEntity = title.split(/\s[-:|]\s/)[0] ?? title.split(' ').slice(0, 3).join(' ')
  if (post.cluster_id) {
    const { data: cluster } = await db
      .from('story_clusters')
      .select('main_entity, artist_name, spotify_url, youtube_url, genius_url, image_url')
      .eq('id', post.cluster_id)
      .single()
    if (cluster?.main_entity) mainEntity = cluster.main_entity
  }

  const track = extractTrack(title, mainEntity)

  const [spotifyRes, youtubeRes, geniusRes] = await Promise.allSettled([
    isMusic ? searchSpotify(mainEntity, track) : Promise.resolve({ track_url: null, artist_url: null, image_url: null, artist_name: null }),
    isVideo ? searchYouTube(extractYouTubeQuery(title, mainEntity)) : Promise.resolve({ video_url: null, thumbnail_url: null, video_id: null }),
    isMusic && track ? searchGenius(`${mainEntity} ${track}`) : Promise.resolve({ song_url: null, title: null }),
  ])

  const spotify = spotifyRes.status === 'fulfilled' ? spotifyRes.value : { track_url: null, artist_url: null, image_url: null, artist_name: null }
  const youtube = youtubeRes.status === 'fulfilled' ? youtubeRes.value : { video_url: null, thumbnail_url: null }
  const genius = geniusRes.status === 'fulfilled' ? geniusRes.value : { song_url: null }

  const newEmbeds: Array<{ type: string; url: string; title?: string }> = []
  if (spotify.track_url ?? spotify.artist_url) newEmbeds.push({ type: 'spotify', url: (spotify.track_url ?? spotify.artist_url)!, title: mainEntity })
  if (youtube.video_url) newEmbeds.push({ type: 'youtube', url: youtube.video_url, title })
  if (genius.song_url) newEmbeds.push({ type: 'genius', url: genius.song_url, title: `${mainEntity} lyrics` })

  // Merge with existing embeds (don't duplicate types)
  const existingEmbeds = (post.embeds ?? []) as Array<{ type: string; url: string; title?: string }>
  const existingTypes = new Set(existingEmbeds.map((e) => e.type))
  const mergedEmbeds = [
    ...existingEmbeds,
    ...newEmbeds.filter((e) => !existingTypes.has(e.type)),
  ]

  // Resolve image if none
  let imageUrl = post.image_url as string | null
  if (!imageUrl) {
    imageUrl = spotify.image_url ?? (youtube as { thumbnail_url?: string | null }).thumbnail_url ?? null
    if (!imageUrl && post.source_url) {
      imageUrl = await resolveImage(post.source_url).catch(() => null)
    }
  }

  // Update post
  await db.from('posts').update({
    embeds: mergedEmbeds,
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', postId)

  return NextResponse.json({
    embeds: mergedEmbeds,
    image_url: imageUrl,
    added: newEmbeds.length,
  })
}
