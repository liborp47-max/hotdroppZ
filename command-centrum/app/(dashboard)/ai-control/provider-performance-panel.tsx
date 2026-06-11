'use client'

// Provider performance dashboard + budget alerts (UM-AI_CONTROL / SM5 + SM3).
// Self-contained: fetches /api/ai/performance and renders per-provider metrics,
// a day trend, and any token/cost budget alerts. Degrades quietly when empty.

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, TrendingUp } from 'lucide-react'

interface ProviderPerf {
  provider: string
  calls: number
  successRate: number
  avgLatencyMs: number
  totalTokens: number
  totalCostUsd: number
  costPerToken: number
}
interface TrendPoint {
  day: string
  calls: number
  successRate: number
  avgLatencyMs: number
  totalCostUsd: number
}
interface BudgetAlert {
  kind: string
  severity: 'info' | 'warning' | 'critical'
  usedPct: number
  title: string
  detail: string
  recommendation: string
}
interface PerformancePayload {
  performance: ProviderPerf[]
  trend: TrendPoint[]
  budget: { alerts: BudgetAlert[] }
  degraded: boolean
}

export function ProviderPerformancePanel() {
  const [data, setData] = useState<PerformancePayload | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/performance')
      if (res.ok) setData((await res.json()) as PerformancePayload)
    } catch {
      /* silent — dashboard is read-only */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const perf = data?.performance ?? []
  const alerts = data?.budget.alerts ?? []

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#00E085]" />
          <span className="text-sm font-semibold text-[#E8E8E8]">Provider Performance</span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[#A8A8A8] hover:text-[#E8E8E8] disabled:opacity-40"
          aria-label="Refresh performance"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Budget alerts (SM3) */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 space-y-1.5 border-b border-white/10">
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
                <div className="font-semibold">{a.title} ({a.usedPct} %)</div>
                <div className="text-[#C8C8C8]">{a.detail}</div>
                <div className="text-[#A8A8A8] mt-0.5">{a.recommendation}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-provider metrics (SM5) */}
      {perf.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] text-[#6E6E6E]">
          {loading ? 'Načítám…' : 'Zatím žádná usage data (ai_usage_logs prázdné nebo DB nedostupné).'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#6E6E6E] border-b border-white/10">
                <th className="text-left font-medium px-4 py-1.5">Provider</th>
                <th className="text-right font-medium px-2 py-1.5">Calls</th>
                <th className="text-right font-medium px-2 py-1.5">Success</th>
                <th className="text-right font-medium px-2 py-1.5">Avg latency</th>
                <th className="text-right font-medium px-2 py-1.5">$/1k tok</th>
                <th className="text-right font-medium px-4 py-1.5">Total $</th>
              </tr>
            </thead>
            <tbody>
              {perf.map((p) => (
                <tr key={p.provider} className="border-b border-white/[0.06]">
                  <td className="px-4 py-1.5 font-mono text-[#E8E8E8]">{p.provider}</td>
                  <td className="px-2 py-1.5 text-right text-[#A8A8A8]">{p.calls}</td>
                  <td
                    className={
                      'px-2 py-1.5 text-right ' +
                      (p.successRate >= 0.95 ? 'text-[#1AEE99]' : p.successRate >= 0.8 ? 'text-amber-300' : 'text-red-300')
                    }
                  >
                    {(p.successRate * 100).toFixed(0)} %
                  </td>
                  <td className="px-2 py-1.5 text-right text-[#A8A8A8]">{p.avgLatencyMs} ms</td>
                  <td className="px-2 py-1.5 text-right text-yellow-400">${(p.costPerToken * 1000).toFixed(4)}</td>
                  <td className="px-4 py-1.5 text-right text-yellow-400">${p.totalCostUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compact day trend (SM5) */}
      {(data?.trend.length ?? 0) > 0 && (
        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-[#6E6E6E] flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[#A8A8A8]">Trend:</span>
          {data!.trend.slice(-7).map((t) => (
            <span key={t.day} title={`${t.calls} calls · ${(t.successRate * 100).toFixed(0)}% success · ${t.avgLatencyMs}ms · $${t.totalCostUsd.toFixed(4)}`}>
              {t.day.slice(5)}: {(t.successRate * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
