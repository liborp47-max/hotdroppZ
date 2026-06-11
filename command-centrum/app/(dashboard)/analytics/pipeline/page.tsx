import { createAdminClient, createClient } from '@/lib/supabase/server'
import { BarChart3, Clock, DollarSign, Zap, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

type CostSummaryRow = {
  stage: string
  run_count: number | null
  total_cost_usd: number | null
  total_tokens: number | null
  avg_duration_ms: number | null
}

type StageHealthRow = {
  stage: string
  status: string | null
  processed: number | null
  kept: number | null
  discarded: number | null
  error_message: string | null
}

type DiscardStatRow = {
  filter_reason: string
  count: number
}

type StageRunRow = {
  id: string
  stage: string
  status: string
  processed: number | null
  kept: number | null
  cost_usd: number | null
  tokens_used: number | null
  started_at: string | null
}

function timeAgo(ts: string) {
  const now = Date.now()
  const then = new Date(ts).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function PipelineAnalyticsPage() {
  const db = createAdminClient() ?? (await createClient())

  const [
    { data: stageRuns },
    { data: health },
    { data: queues },
    { data: costSummary },
    { data: discardStats },
  ] = await Promise.all([
    db.from('pipeline_stage_runs').select('*').order('started_at', { ascending: false }).limit(50),
    db.from('pipeline_stage_health').select('*').order('stage'),
    db.from('pipeline_queue_counts').select('*').single(),
    db.from('pipeline_cost_summary').select('*').order('stage'),
    db.from('filter_discard_stats').select('*').order('count desc'),
  ])

  const totalCost = costSummary?.reduce((sum, row) => sum + (row.total_cost_usd || 0), 0) ?? 0
  const totalTokens = costSummary?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) ?? 0

  const stageColors: Record<string, string> = {
    filter:    'bg-blue-500/15 text-blue-400',
    translator:'bg-purple-500/15 text-purple-400',
    curator:   'bg-green-500/15 text-[#00E085]',
    cluster:   'bg-amber-500/15 text-amber-400',
    enrichment:'bg-indigo-500/15 text-indigo-400',
    writer:    'bg-venom-500/15 text-venom-400',
    feed:      'bg-cyan-500/15 text-cyan-400',
    multilang: 'bg-pink-500/15 text-pink-400',
    monetizer: 'bg-[#00E085]/15 text-[#00E085]',
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#E8E8E8] flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-venom-500" />
          Pipeline Analytics
        </h1>
        <p className="text-sm text-[#A8A8A8] mt-1">
          Real-time performance, cost, and throughput across all pipeline stages
        </p>
      </div>

      {/* Queue Health */}
      <section>
        <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">Queue Health</h2>
        <div className="grid grid-cols-7 gap-3">
          {queues && Object.entries(queues)
            .filter(([key]) => key !== 'total')
            .map(([stage, count]) => (
              <div key={stage} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                <div className="text-xs text-[#A8A8A8] mb-1 capitalize">{stage}</div>
                <div className="text-2xl font-bold text-[#E8E8E8]">{Number(count) || 0}</div>
              </div>
            ))}
        </div>
      </section>

      {/* Cost Summary */}
      <section>
        <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">AI Cost (Last 7 Days)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#A8A8A8]">Total Spend</span>
              <DollarSign className="h-4 w-4 text-[#00E085]" />
            </div>
            <p className="text-2xl font-bold text-[#E8E8E8]">${totalCost.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#A8A8A8]">Total Tokens</span>
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-[#E8E8E8]">{totalTokens.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#A8A8A8]">Avg Tokens/Run</span>
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-[#E8E8E8]">
              {costSummary?.length ? Math.round(totalTokens / costSummary.length).toLocaleString() : 0}
            </p>
          </div>
        </div>
      </section>

      {/* Cost by Stage */}
      {costSummary && costSummary.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">Cost by Stage</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Stage</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Runs</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Cost (USD)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Tokens</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {costSummary.map((row: CostSummaryRow) => (
                  <tr key={row.stage} className="border-b border-white/10 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${stageColors[row.stage] || 'bg-white/[0.05] text-[#A8A8A8]'}`}>
                        {row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">{row.run_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">${row.total_cost_usd?.toFixed(4) || '0.0000'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">{row.total_tokens?.toLocaleString() || 0}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-[#A8A8A8]">{row.avg_duration_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Stage Health + Recent Runs */}
      <section className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">Stage Health (Latest)</h2>
          <div className="space-y-2">
            {health?.map((h: StageHealthRow) => (
              <div key={h.stage} className="flex items-center gap-3 px-3 py-2 border border-white/10 bg-white/[0.025]">
                <span className={`w-2 h-2 rounded-full ${
                  h.status === 'complete' ? 'bg-green-500' :
                  h.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="text-xs font-medium text-[#D0D0D0] capitalize w-24">{h.stage}</span>
                <span className="text-xs text-[#A8A8A8]">
                  {h.processed} processed · {h.kept} kept · {h.discarded} discarded
                </span>
                {h.error_message && (
                  <span className="text-xs text-red-400 truncate" title={h.error_message}>Error</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">Filter Discard Reasons</h2>
          {discardStats && discardStats.length > 0 ? (
            <div className="space-y-2">
              {discardStats.slice(0, 5).map((d: DiscardStatRow) => (
                <div key={d.filter_reason} className="flex items-center gap-3">
                  <span className="text-xs text-[#A8A8A8] w-32 truncate">{d.filter_reason}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-white/[0.10]"
                      style={{ width: `${(d.count / discardStats[0]?.count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[#D0D0D0] w-12 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6E6E6E]">No discard data yet.</p>
          )}
        </div>
      </section>

      {/* Recent Stage Runs Table */}
      <section>
        <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-3">Recent Stage Runs</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Processed</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Kept</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Cost</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Tokens</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Started</th>
              </tr>
            </thead>
            <tbody>
              {stageRuns?.slice(0, 20).map((run: StageRunRow) => (
                <tr key={run.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${stageColors[run.stage] || 'bg-white/[0.05] text-[#A8A8A8]'}`}>
                      {run.stage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {run.status === 'complete' ? (
                      <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
                    ) : run.status === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-400" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">{run.processed}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">{run.kept}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">${run.cost_usd?.toFixed(4) || '0.0000'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#D0D0D0]">{run.tokens_used?.toLocaleString() || 0}</td>
                  <td className="px-4 py-2.5 text-xs text-[#A8A8A8]">
                    {run.started_at ? timeAgo(run.started_at) : '—'}
                  </td>
                </tr>
              ))}
              {(!stageRuns || stageRuns.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">
                    No stage runs recorded yet. Run the pipeline to begin collecting analytics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
