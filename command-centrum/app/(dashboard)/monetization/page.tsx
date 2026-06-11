import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { MonetizationClient } from './monetization-client'

export const metadata: Metadata = { title: 'Monetization' }
export const dynamic = 'force-dynamic'

export default async function MonetizationPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { data: slots }] = await Promise.all([
    supabase.from('ad_campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('ad_slots').select('*, campaign:ad_campaigns(id, name, client)').order('position'),
  ])

  return (
    <MonetizationClient
      initialCampaigns={campaigns ?? []}
      initialSlots={slots ?? []}
    />
  )
}
