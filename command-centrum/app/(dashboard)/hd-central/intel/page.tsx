import { Database } from 'lucide-react'
import { IntelTabs } from './intel-tabs'

export const metadata = {
  title: 'Intel | HD Central',
  description: 'Central data hub for runs, errors, audits, changes',
}

// UM-INTEL — tabbed central data hub.
// Tab "Events" mounts IntelEventsTab (SM-3/4/5 unified search+timeline+drill).
// Tab "Mission Done" keeps the legacy IntelMissionDone view shipped earlier.
export default function IntelPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#5C9A72] font-semibold">
          <Database className="h-3 w-3" />
          <span>HD Central / Intel</span>
        </div>
        <h1 className="text-2xl font-bold text-[#E8E8E8] mt-1">Intel</h1>
        <p className="text-sm text-[#A8A8A8] mt-1">Data hub. Vsechny runs, errors, audits, changes a sources. Vi vsechno o vsem a dela poradek.</p>
      </header>
      <main className="flex-1 overflow-y-auto">
        <IntelTabs />
      </main>
    </div>
  )
}
