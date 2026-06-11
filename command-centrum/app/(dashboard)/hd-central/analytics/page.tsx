import { BarChart2 } from 'lucide-react'
import { AnalyticsClient } from '@/components/analytics/analytics-client'

export const metadata = {
  title: 'Analytics | HD Central',
  description: 'CEO-facing analytics: state report → UPDATE → decisions',
}

export default function HdCentralAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#5C9A72] font-semibold">
          <BarChart2 className="h-3 w-3" />
          <span>HD Central / Analytics</span>
        </div>
        <h1 className="text-2xl font-bold text-[#E8E8E8] mt-1">Analytics</h1>
        <p className="text-sm text-[#A8A8A8] mt-1">
          Stav HotDroppZ na jeden klik — UPDATE vygeneruje stručné, faktické shrnutí a co se změnilo.
        </p>
      </header>
      <main className="flex-1 overflow-y-auto">
        <AnalyticsClient />
      </main>
    </div>
  )
}
