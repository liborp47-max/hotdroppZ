'use client'

/**
 * Tab switcher for the Intel page. Local state, no router param needed.
 * Default tab is 'events' (new SM-3/4/5 stack) but legacy MissionDone
 * remains one click away.
 */

import { useState } from 'react'
import { IntelMissionDone } from '@/components/hd-central/intel-mission-done'
import { IntelEventsTab } from '@/components/intel/IntelEventsTab'

type Tab = 'events' | 'mission_done'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'mission_done', label: 'Mission Done' },
]

export function IntelTabs() {
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="flex flex-col">
      <nav className="flex items-center gap-3 px-6 py-3 border-b border-[#1A1A1A]">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-[11px] uppercase tracking-widest font-mono px-3 py-1.5 border ${
                active
                  ? 'border-[#00E085]/40 bg-[#00E085]/5 text-[#00E085]'
                  : 'border-[#1A1A1A] text-[#A8A8A8] hover:text-[#E8E8E8]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>
      {tab === 'events' && <IntelEventsTab />}
      {tab === 'mission_done' && (
        <div className="flex items-center justify-center px-6 py-8">
          <IntelMissionDone />
        </div>
      )}
    </div>
  )
}
