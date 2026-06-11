'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getAuthedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  return { supabase, user }
}

export async function sendToCuration(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('scout_items')
      .update({ status: 'queued' })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/inbox')
    revalidatePath('/curated')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function discardItem(id: string): Promise<{ error: string | null }> {
  try {
    const { supabase } = await getAuthedClient()
    const { error } = await supabase
      .from('scout_items')
      .update({ status: 'discarded' })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/inbox')
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

