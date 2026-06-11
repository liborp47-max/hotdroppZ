'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { generateGraphicBuffer, uploadGraphic } from '@/lib/services/graphics'
import { enrichImage } from '@/lib/services/image'

export async function regeneratePostGraphic(
  postId: string,
  customHeadline?: string,
  imageUrl?: string,
): Promise<{ success: boolean; graphicUrl?: string; error?: string }> {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return { success: false, error: 'Unauthorized' }

  const db = createAdminClient() ?? authClient

  try {
    const { data: post, error } = await (db as any)
      .from('posts')
      .select('id, title, category, selected_image_url, thumbnail_url, graphic_headline')
      .eq('id', postId)
      .single()

    if (error || !post) return { success: false, error: 'Post not found' }

    // Determine image to use
    const resolvedImageUrl =
      imageUrl ??
      post.selected_image_url ??
      post.thumbnail_url ??
      null

    // If still no image, search free databases
    let finalImageUrl = resolvedImageUrl
    if (!finalImageUrl) {
      const result = await enrichImage({ title: post.title, category: post.category ?? 'news' })
      finalImageUrl = result.image_url ?? null
      if (finalImageUrl) {
        await (db as any)
          .from('posts')
          .update({ selected_image_url: finalImageUrl })
          .eq('id', postId)
          .catch(() => null)
      }
    }

    // Save custom headline if provided
    const headline = customHeadline?.trim() || post.graphic_headline || post.title
    if (customHeadline?.trim() && customHeadline.trim() !== post.graphic_headline) {
      await (db as any)
        .from('posts')
        .update({ graphic_headline: customHeadline.trim() })
        .eq('id', postId)
        .catch(() => null)
    }

    // Generate and upload
    await (db as any)
      .from('posts')
      .update({ graphic_status: 'processing' })
      .eq('id', postId)

    const buffer = await generateGraphicBuffer(post.title, post.category, finalImageUrl, headline)
    const graphicUrl = await uploadGraphic(db as any, postId, buffer)

    await (db as any)
      .from('posts')
      .update({
        graphic_url: graphicUrl,
        graphic_status: 'done',
        graphic_generated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    return { success: true, graphicUrl }
  } catch (err) {
    await (db as any)
      .from('posts')
      .update({ graphic_status: 'error' })
      .eq('id', postId)
      .catch(() => null)

    return { success: false, error: err instanceof Error ? err.message : 'Regeneration failed' }
  }
}

export async function saveGraphicHeadline(
  postId: string,
  headline: string,
): Promise<{ success: boolean; error?: string }> {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return { success: false, error: 'Unauthorized' }

  const db = createAdminClient() ?? authClient

  const { error } = await (db as any)
    .from('posts')
    .update({ graphic_headline: headline.trim() || null })
    .eq('id', postId)

  return error ? { success: false, error: error.message } : { success: true }
}
