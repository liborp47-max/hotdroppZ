'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function updateScoringWeight(id: string, weight: number, reason: string) {
  const { supabase } = await requireAuth()
  const { data, error } = await supabase
    .from('scoring_weights')
    .update({ weight, reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  return data
}

export async function createScoringWeight(category: string, weight: number, reason: string) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('scoring_weights').upsert(
    { category, weight, reason: reason || null },
    { onConflict: 'category' }
  )
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

export async function resetScoringWeights(
  defaults: Array<{ category: string; weight: number }>
) {
  const { supabase } = await requireAuth()
  for (const d of defaults) {
    await supabase.from('scoring_weights').upsert(
      { category: d.category, weight: d.weight, reason: 'Reset to default', updated_at: new Date().toISOString() },
      { onConflict: 'category' }
    )
  }
  revalidatePath('/learning')
}
