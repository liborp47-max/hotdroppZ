'use client'

// Source performance report (UM-SOURCES / SM5). Self-contained: fetches
// /api/sources/performance and renders the most valuable feeds + the artists
// driving engagement. Degrades quietly when there is no data.

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Loader2, RefreshCw } from 'lucide-react'

interface SourcePerf {
  source: string
  scouted: number
  published: number
  conversionRate: number
  engagement: number
  valueScore: number
}
interface ArtistPerf {
  artist: string
  posts: number
  totalViews: number
  avgEngagementRate: number
  engagementScore: number
}
interface ReportPayload {
  sources: SourcePerf[]
  artists: ArtistPerf[]
  topSource: string | null
  topArtist: string | null
  degraded: boolean
}

export function SourcePerformancePanel() {
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sources/performance')
      if (res.ok) setData((await res.json()) as ReportPayload)
    } catch {
      /* silent — read-only report */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sources = (data?.sources ?? []).slice(0, 8)
  const artists = (data?.artists ?? []).slice(0, 8)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#00E085]" />
          <span className="text-sm font-semibold text-[#E8E8E8]">Source Performance</span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
          aria-label="Refresh source performance"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {sources.length === 0 && artists.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] text-[#6E6E6E]">
          {loading ? 'Načítám…' : 'Zatím žádná data (scout_items / feed_posts prázdné nebo DB nedostupné).'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          {/* Most valuable feeds */}
          <div>
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#6E6E6E]">
              Nejhodnotnější feedy
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#6E6E6E] border-b border-white/10">
                  <th className="text-left font-medium px-4 py-1">Source</th>
                  <th className="text-right font-medium px-2 py-1">Conv.</th>
                  <th className="text-right font-medium px-4 py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-b border-white/[0.06]">
                    <td className="px-4 py-1 font-mono text-[#E8E8E8] truncate max-w-[160px]" title={s.source}>{s.source}</td>
                    <td className="px-2 py-1 text-right text-[#A8A8A8]">{(s.conversionRate * 100).toFixed(0)} %</td>
                    <td className="px-4 py-1 text-right text-[#1AEE99]">{s.valueScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Engagement drivers */}
          <div>
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#6E6E6E]">
              Engagement drivers (artists)
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#6E6E6E] border-b border-white/10">
                  <th className="text-left font-medium px-4 py-1">Artist</th>
                  <th className="text-right font-medium px-2 py-1">Posts</th>
                  <th className="text-right font-medium px-4 py-1">Score</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((a) => (
                  <tr key={a.artist} className="border-b border-white/[0.06]">
                    <td className="px-4 py-1 text-[#E8E8E8] truncate max-w-[160px]" title={a.artist}>{a.artist}</td>
                    <td className="px-2 py-1 text-right text-[#A8A8A8]">{a.posts}</td>
                    <td className="px-4 py-1 text-right text-yellow-400">{a.engagementScore.toLocaleString('cs-CZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
