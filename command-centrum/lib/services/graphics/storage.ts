import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'post-graphics'

export async function uploadGraphic(
  db: SupabaseClient,
  postId: string,
  buffer: Buffer,
): Promise<string> {
  const filename = `${postId}.jpg`
  const path = `graphics/${filename}`

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert: true,      // overwrite if regenerated
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = db.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
