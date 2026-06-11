'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { supabase, user }
}

// Boosts attention_score to 100 so the item jumps to the front of the writer queue.
// scout_items.status stays CURATED — writer picks it up on next run.
export async function sendCuratedToWriter(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireAuth()
    const { error } = await supabase
      .from('scout_items')
      .update({ attention_score: 100 })
      .eq('id', id)
      .eq('status', 'CURATED')
    if (error) return { error: error.message }
    revalidatePath('/curated')
    revalidatePath('/writer')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Removes item from the pipeline permanently.
export async function skipCuratedItem(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireAuth()
    const { error } = await supabase
      .from('scout_items')
      .update({ status: 'discarded' })
      .eq('id', id)
      .eq('status', 'CURATED')
    if (error) return { error: error.message }
    revalidatePath('/curated')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
