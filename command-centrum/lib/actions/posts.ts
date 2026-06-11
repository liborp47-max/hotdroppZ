'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PostStatus } from '@/lib/types'

async function getAuthedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  return { supabase, user }
}

export async function approvePost(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function rejectPost(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function holdPost(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({ status: 'hold', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function publishPost(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function archivePost(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updatePostStatus(
  id: string,
  status: PostStatus
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const updateData: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function bulkUpdatePostStatus(
  ids: string[],
  status: PostStatus
): Promise<{ error: string | null; updated: number }> {
  try {
    const { supabase } = await getAuthedClient()
    if (ids.length === 0) return { error: null, updated: 0 }
    const updateData: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
    }
    const { error, count } = await supabase
      .from('posts')
      .update(updateData)
      .in('id', ids)
    if (error) return { error: error.message, updated: 0 }
    revalidatePath('/cms')
    return { error: null, updated: count ?? ids.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error', updated: 0 }
  }
}

export async function updatePostEmbeds(
  id: string,
  embeds: Array<{ type: string; url: string; title?: string }>,
  image_url?: string
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const updates: Record<string, unknown> = { embeds, updated_at: new Date().toISOString() }
    if (image_url !== undefined) updates.image_url = image_url
    const { error } = await supabase.from('posts').update(updates).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/editorial')
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updatePostFields(
  id: string,
  fields: { title?: string; body?: string; summary?: string; short_text?: string; category?: string; tags?: string[] }
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('posts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/cms')
    revalidatePath('/writer')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Image Override ─────────────────────────────────────────────────────────────

export async function overridePostImage(
  id: string,
  imageUrl: string,
  source?: string
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()

    // Update post image_url
    const { error } = await supabase
      .from('posts')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }

    // Upsert article_images with manual override
    const bestSource = source ?? 'manual'
    const { error: imageError } = await supabase.from('article_images').upsert({
      article_id: id,
      best_image_url: imageUrl,
      best_source: bestSource,
      best_score: 1.0,
      alternatives: [],
      selected_by: 'manual',
      selected_at: new Date().toISOString(),
    }, {
      onConflict: 'article_id',
    })
    if (imageError) return { error: imageError.message }

    revalidatePath('/editorial')
    revalidatePath('/cms')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
