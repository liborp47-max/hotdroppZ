'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, TrendingDown, Cpu, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  FunnelReport,
  ModelPerfReport,
  Anomaly,
} from '@/lib/analytics/pipeline-insights'

type InsightsResponse = {
  funnel: FunnelReport | { error: string }
  modelPerf: ModelPerfReport | { error: string }
  anomalies: Anomaly[] | { error: string }
  generatedAt: string
}

const SEVERITY_STYLE: Record<Anomaly['severity'], string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
}

function pct(n: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (n / max) * 100))
}

function FunnelSection({ data }: { data: FunnelReport }) {
  const max = Math.max(1, ...data.steps.map((s) => s.processed))
  return (
    <section className="plastic-card space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-[#1AEE99]" />
          <h2 className="text-sm font-semibold text-[#E8E8E8]">Pipeline funnel — posledních {data.windowDays} dní</h2>
        </div>
        <Badge className="border-white/15 bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#A8A8A8]">
          Celkový výtěžek: {data.overallYieldPct}%
        </Badge>
      </header>

      <ul className="space-y-2">
        {data.steps.map((s) => (
          <li key={s.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono uppercase tracking-wider text-[#D0D0D0]">{s.stage}</span>
              <span className="text-[#A8A8A8]">
                {s.kept.toLocaleString()} / {s.processed.toLocaleString()}
                {s.dropOffPct > 0 && (
                  <span className="ml-2 text-amber-300">↓ {s.dropOffPct}% drop</span>
                )}
                {s.errorRate > 0 && (
                  <span className="ml-2 text-red-300">⚠ {s.errorRate}% err</span>
                )}
              </span>
            </div>
            <div className="relative h-4 overflow-hidden rounded bg-white/[0.04]">
              <div
                className="absolute inset-y-0 left-0 bg-[#1AEE99]/30"
                style={{ width: `${pct(s.processed, max)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#1AEE99]/70"
                style={{ width: `${pct(s.kept, max)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModelPerfSection({ data }: { data: ModelPerfReport }) {
  if (data.providers.length === 0) {
    return (
      <section className="plastic-card p-4 text-sm text-[#A8A8A8]">
        <Cpu className="mr-2 inline h-4 w-4" /> Model performance — žádná data za posledních {data.windowDays} dní.
      </section>
    )
  }

  return (
    <section className="plastic-card space-y-3 p-4">
      <header className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-[#1AEE99]" />
        <h2 className="text-sm font-semibold text-[#E8E8E8]">Model performance — posledních {data.windowDays} dní</h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
              <th className="pb-2 pr-3">Provider</th>
              <th className="pb-2 pr-3 text-right">Requesty</th>
              <th className="pb-2 pr-3 text-right">Tokeny</th>
              <th className="pb-2 pr-3 text-right">Cena $</th>
              <th className="pb-2 pr-3 text-right">$/1k tok</th>
              <th className="pb-2 pr-3 text-right">Lat. ms</th>
              <th className="pb-2 text-right">Úspěšnost</th>
            </tr>
          </thead>
          <tbody className="text-[#D0D0D0]">
            {data.providers.map((p) => (
              <tr key={p.provider} className="border-t border-white/[0.06]">
                <td className="py-1.5 pr-3 font-mono">{p.provider}</td>
                <td className="py-1.5 pr-3 text-right">{p.requests.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right">{p.totalTokens.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right">{p.totalCostUsd.toFixed(4)}</td>
                <td className="py-1.5 pr-3 text-right">{p.costPerThousandTokens.toFixed(4)}</td>
                <td className="py-1.5 pr-3 text-right">{p.avgLatencyMs}</td>
                <td className={`py-1.5 text-right ${p.successRate < 90 ? 'text-amber-300' : 'text-[#1AEE99]'}`}>
                  {p.successRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AnomaliesSection({ items }: { items: Anomaly[] }) {
  return (
    <section className="plastic-card space-y-3 p-4">
      <header className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#1AEE99]" />
        <h2 className="text-sm font-semibold text-[#E8E8E8]">Anomálie — last 24h vs 7-day baseline</h2>
        <Badge className="ml-auto border-white/15 bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#A8A8A8]">
          {items.length} {items.length === 1 ? 'nález' : items.length < 5 ? 'nálezy' : 'nálezů'}
        </Badge>
      </header>

      {items.length === 0 ? (
        <p className="text-xs text-[#A8A8A8]">Vše v normě. Žádné výrazné odchylky proti baseline.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className={`rounded border px-3 py-2 text-xs ${SEVERITY_STYLE[a.severity]}`}>
              <div className="flex items-center justify-between gap-2 font-semibold">
                <span>{a.title}</span>
                <span className="text-[10px] uppercase">{a.severity}</span>
              </div>
              <p className="mt-1 text-[#E0E0E0]/80">{a.detail}</p>
              <p className="mt-1 text-[#A8A8A8]">Doporučení: {a.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function PipelineInsights() {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/insights?days=7', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as InsightsResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načtení selhalo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-4 text-xs text-[#A8A8A8]">
        <Loader2 className="h-4 w-4 animate-spin" /> Načítám pipeline insights…
      </p>
    )
  }

  if (error) {
    return (
      <p className="flex items-center gap-2 rounded border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" /> {error}
        <Button variant="outline" size="sm" className="ml-2 h-7 gap-1 text-[10px]" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" /> Zkusit znovu
        </Button>
      </p>
    )
  }

  if (!data) return null

  const funnel = 'error' in data.funnel ? null : data.funnel
  const modelPerf = 'error' in data.modelPerf ? null : data.modelPerf
  const anomalies = Array.isArray(data.anomalies) ? data.anomalies : []

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px]" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" /> Obnovit
        </Button>
      </div>
      {anomalies.length > 0 && <AnomaliesSection items={anomalies} />}
      {funnel && <FunnelSection data={funnel} />}
      {modelPerf && <ModelPerfSection data={modelPerf} />}
      {anomalies.length === 0 && <AnomaliesSection items={[]} />}
    </div>
  )
}
