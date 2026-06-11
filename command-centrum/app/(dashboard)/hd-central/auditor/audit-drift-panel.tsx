'use client'

// Distribution drift panel (UM-AUDITOR / SM3). Self-contained: fetches
// /api/hd-central/audit-drift and renders how the pipeline-stage / model-usage /
// content-quality mix shifted vs the 7-day baseline. Quiet when no drift.

import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

interface DriftAlert {
  dimension: string
  key: string
  baselineShare: number
  currentShare: number
  deltaPoints: number
  severity: 'warn' | 'critical'
  detail: string
}
interface DriftPayload {
  alerts: DriftAlert[]
  dimensions: string[]
  counts: { critical: number; warn: number }
  degraded: boolean
}

const DIM_LABEL: Record<string, string> = {
  pipeline_distribution: 'Pipeline distribuce',
  model_usage: 'Model usage',
  content_quality: 'Content quality',
}

export function AuditDriftPanel() {
  const [data, setData] = useState<DriftPayload | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hd-central/audit-drift')
      if (res.ok) setData((await res.json()) as DriftPayload)
    } catch {
      /* silent — read-only */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const alerts = data?.alerts ?? []

  return (
    <div className="mx-6 my-4 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#5C9A72]" />
          <span className="text-sm font-semibold text-[#E8E8E8]">Drift detection</span>
          <span className="text-[10px] text-[#6E6E6E]">24h vs 7d baseline</span>
          {data && (data.counts.critical > 0 || data.counts.warn > 0) && (
            <span className="text-[10px] text-amber-300">
              {data.counts.critical} crit · {data.counts.warn} warn
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
          aria-label="Refresh drift"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="px-4 py-5 text-center text-[11px] text-[#6E6E6E]">
          {loading ? 'Načítám…' : 'Žádný významný drift v distribuci (nebo nedostatek dat).'}
        </div>
      ) : (
        <div className="px-4 py-2 space-y-1.5">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={
                'flex items-start gap-2 text-[11px] px-2 py-1.5 rounded border ' +
                (a.severity === 'critical'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300')
              }
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{DIM_LABEL[a.dimension] ?? a.dimension} · {a.key}</span>
                <span className="ml-2 tabular-nums">{a.deltaPoints > 0 ? '+' : ''}{a.deltaPoints} b.</span>
                <div className="text-[#C8C8C8]">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
