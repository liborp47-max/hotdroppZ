'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function toggleCampaign(id: string, active: boolean) {
  const { supabase } = await requireAuth()
  await supabase.from('ad_campaigns').update({ active }).eq('id', id)
  revalidatePath('/monetization')
}

export async function toggleAdSlot(id: string, active: boolean) {
  const { supabase } = await requireAuth()
  await supabase.from('ad_slots').update({ active }).eq('id', id)
  revalidatePath('/monetization')
}

export async function createCampaign(data: {
  name: string
  client: string
  budget: number | null
  start_date: string | null
  end_date: string | null
}) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('ad_campaigns').insert({
    name: data.name,
    client: data.client || null,
    budget: data.budget,
    start_date: data.start_date,
    end_date: data.end_date,
    active: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/monetization')
}

export async function createAdSlot(data: {
  position: string
  type: string
  campaign_id: string | null
}) {
  const { supabase } = await requireAuth()
  const { error } = await supabase.from('ad_slots').insert({
    position: data.position,
    type: data.type,
    campaign_id: data.campaign_id,
    active: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/monetization')
}
