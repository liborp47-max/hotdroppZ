import type { Metadata } from 'next'
import { Bot } from 'lucide-react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { STEP_CONFIGS, enrichStepConfig } from '@/lib/ai/registry'
import { getSelectedProvider, getUsageStats } from '@/lib/ai/usage'
import { AiControlClient } from './ai-control-client'

export const metadata: Metadata = { title: 'AI Control' }
export const dynamic = 'force-dynamic'

export default async function AiControlPage() {
  const authClient = await createClient()
  const db = createAdminClient() ?? authClient

  // Load step configs with availability status + user-selected providers
  const steps = await Promise.all(
    STEP_CONFIGS.map(async (config) => {
      const saved = await getSelectedProvider(db, config.step)
      return enrichStepConfig(config, saved ?? undefined)
    })
  )

  // Load usage stats
  const usageStats = await getUsageStats(db)

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2.5">
        <Bot className="h-4 w-4 text-venom-400" />
        <h1 className="text-base font-semibold text-[#E8E8E8]">AI Control Center</h1>
        <span className="text-xs text-[#6E6E6E]">Free-first · switch providers · test before run</span>
      </div>
      <AiControlClient initialSteps={steps} initialUsage={usageStats} />
    </div>
  )
}
