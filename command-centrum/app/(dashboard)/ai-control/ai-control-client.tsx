'use client'

import { useState, useTransition } from 'react'
import {
  Loader2, Play, CheckCircle2, AlertCircle, Zap,
  Globe, Brain, GitMerge, PenLine, ShieldCheck,
  ChevronDown, Activity, Cpu, Clock, TrendingUp,
  ToggleLeft, ToggleRight, Copy, RefreshCw,
  Heart, FileText, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { EnrichedStepConfig, ProviderType, ProviderStatus } from '@/lib/ai/registry'
import type { UsageStats } from '@/lib/ai/usage'
import type { TestResult } from '@/app/api/ai/test/route'
import { ProviderPerformancePanel } from './provider-performance-panel'

// ─── Icon helpers ─────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ElementType> = {
  translation:  Globe,
  curator:      Brain,
  cluster:      GitMerge,
  writer:       PenLine,
  final_editor: ShieldCheck,
}

const STEP_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  translation:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  curator:      { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  cluster:      { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  writer:       { color: 'text-[#00E085]',  bg: 'bg-[rgba(0,224,133,0.10)]',  border: 'border-green-500/20'  },
  final_editor: { color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20'   },
}

// ─── Type badges ──────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ProviderType }) {
  const map: Record<ProviderType, { label: string; className: string }> = {
    'local-rules': { label: 'Local · Rules',  className: 'bg-white/[0.05] text-[#A8A8A8] border-white/15' },
    'local-free':  { label: 'Local · Free',   className: 'bg-[rgba(0,224,133,0.10)] text-[#00E085] border-green-500/20' },
    'cloud-free':  { label: 'Cloud · Free',   className: 'bg-venom-500/10 text-venom-400 border-venom-500/20' },
    'cloud-paid':  { label: 'Cloud · Paid',   className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }
  const { label, className } = map[type]
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', className)}>
      {label}
    </span>
  )
}

function StatusDot({ status }: { status: ProviderStatus }) {
  return (
    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', {
      'bg-green-500 animate-pulse': status === 'active',
      'bg-white/[0.10]':                status === 'not-configured',
      'bg-red-500':                 status === 'error',
      'bg-white/[0.08]':                status === 'disabled',
    })} />
  )
}

// ─── Test status badge ────────────────────────────────────────────────────────

function TestBadge({ result }: { result: TestResult | null }) {
  if (!result) return null
  const map = {
    working:        { icon: CheckCircle2, color: 'text-[#00E085]', label: `OK · ${result.latency_ms}ms` },
    slow:           { icon: Clock,        color: 'text-yellow-400', label: `Slow · ${result.latency_ms}ms` },
    failed:         { icon: AlertCircle,  color: 'text-red-400',   label: 'Failed' },
    'not-configured': { icon: AlertCircle, color: 'text-[#A8A8A8]',  label: 'Not configured' },
  }
  const { icon: Icon, color, label } = map[result.status]
  return (
    <span className={cn('flex items-center gap-1 text-[11px]', color)}>
      <Icon className="h-3 w-3 shrink-0" />{label}
    </span>
  )
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  config,
  testResult,
  onTest,
  onSwitch,
  testing,
  switching,
}: {
  config: EnrichedStepConfig
  testResult: TestResult | null
  onTest: () => void
  onSwitch: (provider: string) => void
  testing: boolean
  switching: boolean
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDetail, setShowDetail]     = useState(false)

  const Icon   = STEP_ICONS[config.step] ?? Cpu
  const colors = STEP_COLORS[config.step] ?? { color: 'text-[#A8A8A8]', bg: 'bg-white/[0.05]', border: 'border-white/15' }

  const selected  = config.activeProvider
  const providers = config.providers

  const systemHealthColor =
    testResult?.status === 'working'        ? 'border-[#00E085]/35'
    : testResult?.status === 'slow'         ? 'border-yellow-500/30'
    : testResult?.status === 'failed'       ? 'border-red-500/30'
    : testResult?.status === 'not-configured' ? 'border-white/15'
    : colors.border

  return (
    <div className={cn('rounded-xl border bg-white/[0.03] backdrop-blur-md overflow-hidden transition-all', systemHealthColor)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className={cn('flex items-center justify-center w-8 h-8 shrink-0', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.color)} />
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#E8E8E8]">{config.label}</span>
            <TypeBadge type={selected.type} />
          </div>
          <p className="text-[11px] text-[#6E6E6E] mt-0.5">{config.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <TestBadge result={testResult} />

          {/* Test button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onTest}
            disabled={testing || switching}
            className="text-[11px] h-7 px-2.5 border-white/15 text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/20 disabled:opacity-40"
          >
            {testing
              ? <><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />Testing…</>
              : <><Play className="h-2.5 w-2.5 mr-1 fill-current" />Test</>
            }
          </Button>

          {/* Expand */}
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-[#6E6E6E] hover:text-[#A8A8A8] transition-colors p-1"
          >
            {showDetail ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Provider row */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-white/10 bg-black/20">
        <StatusDot status={selected.status} />
        <span className="text-[12px] text-[#D0D0D0] font-medium">{selected.displayName}</span>
        {selected.model && (
          <span className="text-[10px] text-[#6E6E6E] font-mono">{selected.model}</span>
        )}
        <span className="text-[10px] text-[#404040]">·</span>
        <span className="text-[10px] text-[#6E6E6E] capitalize">{selected.latency}</span>

        {/* Provider switcher */}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={switching}
            className="flex items-center gap-1.5 text-[11px] text-[#A8A8A8] hover:text-[#D0D0D0] border border-white/10 hover:border-white/15 px-2.5 py-1 transition-colors disabled:opacity-40"
          >
            {switching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
            Switch
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-56 border border-white/15 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-black/50 z-20 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/10">
                <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">Select provider</p>
              </div>
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSwitch(p.id); setShowDropdown(false) }}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors',
                    p.id === selected.id && 'bg-white/[0.04]'
                  )}
                >
                  <StatusDot status={p.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#E8E8E8]">{p.displayName}</span>
                       {p.id === selected.id && (
                         <span className="text-[9px] text-venom-400 border border-venom-500/30 px-1 py-0.5">active</span>
                       )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TypeBadge type={p.type} />
                      <span className={cn('text-[10px] font-medium', {
                        'text-[#00E085]': p.status === 'active',
                        'text-[#6E6E6E]':  p.status === 'not-configured',
                        'text-red-400':   p.status === 'error',
                      })}>
                        {p.status === 'active'          ? 'available'
                          : p.status === 'not-configured' ? 'not configured'
                          : p.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {showDetail && (
        <div className="border-t border-white/10 px-4 py-3 bg-black/30 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
            {[
              { label: 'Pipeline endpoint', value: config.pipelineEndpoint },
              { label: 'Fallback',          value: providers.find((p) => p.id === config.fallback)?.displayName ?? config.fallback },
              { label: 'Cost',              value: selected.cost },
              { label: 'Latency',           value: selected.latency },
              ...(selected.requiresEnv
                ? [{ label: 'Requires env', value: selected.requiresEnv.join(', ') }]
                : []),
              ...(selected.requiresLocal
                ? [{ label: 'Requires local', value: selected.requiresLocal }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-[#6E6E6E]">{label}</span>
                <span className="text-[#A8A8A8] font-mono text-right break-all">{value}</span>
              </div>
            ))}
          </div>
          {selected.notes && (
            <p className="text-[11px] text-[#6E6E6E] italic border-l border-white/15 pl-3">
              {selected.notes}
            </p>
          )}
          {testResult?.message && (
            <div className={cn(
              'flex items-start gap-2 text-[11px] px-3 py-2 border',
              testResult.status === 'working'          && 'text-[#00E085] bg-[rgba(0,224,133,0.10)] border-green-500/20',
              testResult.status === 'slow'             && 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
              testResult.status === 'failed'           && 'text-red-400 bg-red-500/10 border-red-500/20',
              testResult.status === 'not-configured'   && 'text-[#A8A8A8] bg-white/[0.04] border-white/15',
            )}>
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="flex-1">{testResult.message}</span>
              <button
                onClick={() => navigator.clipboard.writeText(testResult.message)}
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <Copy className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Usage stats bar ──────────────────────────────────────────────────────────

function UsagePanel({ usage }: { usage: UsageStats }) {
  const stats = [
    { label: 'Total requests',    value: usage.total_requests.toLocaleString(),          color: 'text-[#E8E8E8]' },
     { label: 'Total tokens',      value: usage.total_tokens.toLocaleString(),            color: 'text-venom-400' },
    { label: 'Est. cost',         value: `$${usage.total_cost_usd.toFixed(4)}`,          color: 'text-yellow-400' },
    { label: 'Last 24h requests', value: usage.last_24h_requests.toLocaleString(),       color: 'text-blue-400' },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <span className="text-[11px] font-semibold text-[#A8A8A8] uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-3 w-3" />Usage Statistics
        </span>
        <span className="text-[10px] text-[#404040]">All time</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/[0.06]/60">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-[#6E6E6E] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {usage.summary.length > 0 && (
        <div className="border-t border-white/10">
          <div className="divide-y divide-white/[0.06]/50">
            {usage.summary.map((row) => (
              <div key={`${row.step}:${row.provider}`}
                className="flex items-center gap-4 px-4 py-2 text-[11px]">
                <span className="w-24 text-[#A8A8A8] font-medium">{row.step}</span>
                <span className="w-28 text-[#A8A8A8]">{row.provider}</span>
                <span className="text-[#6E6E6E] tabular-nums">{row.total_requests.toLocaleString()} req</span>
                <span className="text-[#404040]">·</span>
                <span className="text-[#6E6E6E] tabular-nums">{row.total_tokens.toLocaleString()} tok</span>
                {row.avg_latency_ms > 0 && (
                  <>
                    <span className="text-[#404040]">·</span>
                    <span className="text-[#6E6E6E] tabular-nums">{Math.round(row.avg_latency_ms)}ms avg</span>
                  </>
                )}
                {row.error_count > 0 && (
                  <span className="text-red-400 ml-auto">{row.error_count} err</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── System health bar ────────────────────────────────────────────────────────

function SystemHealth({ steps }: { steps: EnrichedStepConfig[] }) {
  const activeCount = steps.filter((s) => s.activeProvider.status === 'active').length
  const freeCount   = steps.filter((s) => s.activeProvider.cost === 'free').length
  const paidCount   = steps.filter((s) => s.activeProvider.cost === 'paid').length

  const healthColor =
    activeCount === steps.length ? 'text-[#00E085]'
    : activeCount > 0            ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', {
          'bg-green-500 animate-pulse':  activeCount === steps.length,
          'bg-yellow-500 animate-pulse': activeCount > 0 && activeCount < steps.length,
          'bg-red-500':                  activeCount === 0,
        })} />
        <span className={cn('text-sm font-semibold', healthColor)}>
          {activeCount}/{steps.length} steps active
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-[#A8A8A8]">
        <ToggleRight className="h-3.5 w-3.5 text-[#00E085]" />{freeCount} free
      </div>
      {paidCount > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
          <ToggleLeft className="h-3.5 w-3.5" />{paidCount} paid
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#6E6E6E]">
        <Zap className="h-3 w-3 text-yellow-500/70" />
        Free-first architecture — paid AI disabled by default
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function AiControlClient({
  initialSteps,
  initialUsage,
}: {
  initialSteps: EnrichedStepConfig[]
  initialUsage: UsageStats
}) {
  const [steps, setSteps]   = useState<EnrichedStepConfig[]>(initialSteps)
  const [usage, setUsage]   = useState<UsageStats>(initialUsage)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting]   = useState<Record<string, boolean>>({})
  const [switching, setSwitching] = useState<Record<string, boolean>>({})
  const [, startTransition]   = useTransition()
  const [refreshing, setRefreshing] = useState(false)

  async function handleTest(step: string) {
    setTesting((prev) => ({ ...prev, [step]: true }))
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      })
      const result = await res.json() as TestResult
      setTestResults((prev) => ({ ...prev, [step]: result }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [step]: {
          step,
          provider: 'unknown',
          status: 'failed',
          latency_ms: 0,
          message: (err as Error).message,
        },
      }))
    } finally {
      setTesting((prev) => ({ ...prev, [step]: false }))
    }
  }

  async function handleSwitch(step: string, provider: string) {
    setSwitching((prev) => ({ ...prev, [step]: true }))
    try {
      const res = await fetch('/api/ai/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, provider }),
      })
      if (!res.ok) return

      // Refresh provider list from server
      const refreshed = await fetch('/api/ai/providers')
      if (refreshed.ok) {
        const data = await refreshed.json() as { steps: EnrichedStepConfig[] }
        setSteps(data.steps)
        // Clear test result for this step since provider changed
        setTestResults((prev) => {
          const next = { ...prev }
          delete next[step]
          return next
        })
      }
    } finally {
      setSwitching((prev) => ({ ...prev, [step]: false }))
    }
  }

  async function handleTestAll() {
    for (const step of steps) {
      await handleTest(step.step)
    }
  }

  async function refreshUsage() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/ai/usage')
      if (res.ok) {
        const data = await res.json() as UsageStats
        setUsage(data)
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* System health */}
      <SystemHealth steps={steps} />

      {/* Test all button */}
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-[#A8A8A8] uppercase tracking-wider">
          AI Steps
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestAll}
            disabled={Object.values(testing).some(Boolean)}
            className="text-[11px] h-7 px-3 border-white/15 text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/20 gap-1.5"
          >
            <Zap className="h-3 w-3" />Test All
          </Button>
        </div>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {steps.map((config) => (
          <StepCard
            key={config.step}
            config={config}
            testResult={testResults[config.step] ?? null}
            onTest={() => handleTest(config.step)}
            onSwitch={(provider) => handleSwitch(config.step, provider)}
            testing={testing[config.step] ?? false}
            switching={switching[config.step] ?? false}
          />
        ))}
      </div>

      {/* Provider legend */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="text-[10px] font-semibold text-[#6E6E6E] uppercase tracking-wider mb-2.5">Provider types</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {[
            { label: 'Local · Rules',  desc: 'No AI, deterministic, always available',    className: 'text-[#A8A8A8]' },
            { label: 'Local · Free',   desc: 'Self-hosted AI (Ollama, LibreTranslate)',   className: 'text-[#00E085]' },
             { label: 'Cloud · Free',   desc: 'Free-tier cloud API (Groq)',                className: 'text-venom-400' },
            { label: 'Cloud · Paid',   desc: 'Paid cloud API (OpenAI) — disabled by default', className: 'text-red-400' },
          ].map(({ label, desc, className }) => (
            <div key={label}>
              <p className={cn('font-medium mb-0.5', className)}>{label}</p>
              <p className="text-[#404040]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Usage stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-[#A8A8A8] uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-3 w-3" />Usage & Performance
        </h2>
        <button
          onClick={refreshUsage}
          disabled={refreshing}
          className="flex items-center gap-1 text-[11px] text-[#6E6E6E] hover:text-[#A8A8A8] transition-colors"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>
      <UsagePanel usage={usage} />
      <ProviderPerformancePanel />

      {/* Health Monitor */}
      <HealthMonitor />

      {/* Prompt Registry */}
      <PromptRegistry />
    </div>
  )
}

// ─── Health Monitor ────────────────────────────────────────────────────────────

type HealthResult = { provider: string; status: 'healthy' | 'degraded' | 'down'; latency_ms: number; error?: string }

const PINGABLE_PROVIDERS = [
  { id: 'groq',           label: 'Groq · llama-3.1-8b' },
  { id: 'ollama_mistral', label: 'Ollama · Mistral 7B'  },
  { id: 'ollama_llama3',  label: 'Ollama · Llama 3.2'   },
]

function HealthMonitor() {
  const [results, setResults] = useState<Record<string, HealthResult>>({})
  const [pinging, setPinging] = useState<Record<string, boolean>>({})

  async function ping(providerId: string) {
    setPinging(prev => ({ ...prev, [providerId]: true }))
    try {
      const res = await fetch('/api/ai/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      })
      if (res.ok) {
        const data = await res.json() as HealthResult
        setResults(prev => ({ ...prev, [providerId]: data }))
      }
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [providerId]: { provider: providerId, status: 'down', latency_ms: 0, error: (err as Error).message },
      }))
    } finally {
      setPinging(prev => ({ ...prev, [providerId]: false }))
    }
  }

  async function pingAll() {
    for (const p of PINGABLE_PROVIDERS) await ping(p.id)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <span className="text-[11px] font-semibold text-[#A8A8A8] uppercase tracking-wider flex items-center gap-1.5">
          <Heart className="h-3 w-3 text-red-400" />Health Monitor
        </span>
        <button
          onClick={pingAll}
          disabled={Object.values(pinging).some(Boolean)}
          className="flex items-center gap-1 text-[11px] text-[#6E6E6E] hover:text-[#D0D0D0] transition-colors disabled:opacity-40"
        >
          <Zap className="h-2.5 w-2.5" />Ping All
        </button>
      </div>
      <div className="divide-y divide-white/[0.06]/60">
        {PINGABLE_PROVIDERS.map(({ id, label }) => {
          const r   = results[id]
          const busy = pinging[id]
          return (
            <div key={id} className="flex items-center gap-3 px-4 py-2.5 text-[11px]">
              <span className={cn('w-2 h-2 rounded-full shrink-0', {
                'bg-green-500':              r?.status === 'healthy',
                'bg-yellow-500 animate-pulse': r?.status === 'degraded',
                'bg-red-500':                r?.status === 'down',
                'bg-white/[0.08]':               !r,
              })} />
              <span className="flex-1 text-[#D0D0D0]">{label}</span>
              {r && (
                <>
                  <span className={cn('font-mono', {
                    'text-[#00E085]':  r.status === 'healthy',
                    'text-yellow-400': r.status === 'degraded',
                    'text-red-400':    r.status === 'down',
                  })}>
                    {r.status}
                  </span>
                  {r.latency_ms > 0 && (
                    <span className="text-[#6E6E6E] tabular-nums">{r.latency_ms}ms</span>
                  )}
                  {r.error && (
                    <span className="text-red-400 truncate max-w-48" title={r.error}>{r.error}</span>
                  )}
                </>
              )}
              <button
                onClick={() => ping(id)}
                disabled={busy}
                className="ml-auto text-[#6E6E6E] hover:text-[#D0D0D0] transition-colors disabled:opacity-40"
              >
                {busy
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <ChevronRight className="h-3 w-3" />
                }
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Prompt Registry ──────────────────────────────────────────────────────────

type PromptEntry = { key: string; module: string; prompt_text: string; chars: number; source: string }

const MODULE_COLORS: Record<string, string> = {
  translation: 'text-yellow-400',
  curator:     'text-purple-400',
  writer:      'text-[#00E085]',
  multilang:   'text-teal-400',
  enrichment:  'text-blue-400',
  monetizer:   'text-orange-400',
  other:       'text-[#A8A8A8]',
}

function PromptRegistry() {
  const [prompts, setPrompts]     = useState<PromptEntry[]>([])
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)

  async function loadPrompts() {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/prompts')
      if (res.ok) {
        setPrompts(await res.json() as PromptEntry[])
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const byModule = prompts.reduce<Record<string, PromptEntry[]>>((acc, p) => {
    ;(acc[p.module] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <span className="text-[11px] font-semibold text-[#A8A8A8] uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-[#A8A8A8]" />Prompt Registry
        </span>
        <button
          onClick={loadPrompts}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-[#6E6E6E] hover:text-[#D0D0D0] transition-colors disabled:opacity-40"
        >
          {loading
            ? <><Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />Loading…</>
            : loaded ? <><RefreshCw className="h-2.5 w-2.5 mr-1" />Refresh</>
            : 'Load prompts'
          }
        </button>
      </div>

      {!loaded && !loading && (
        <p className="text-[11px] text-[#404040] text-center py-6">Click "Load prompts" to view the active prompt registry</p>
      )}

      {loaded && (
        <div className="divide-y divide-white/[0.04]">
          {Object.entries(byModule).sort().map(([module, entries]) => (
            <div key={module}>
              <div className="px-4 py-1.5 bg-black/30">
                <span className={cn('text-[10px] font-semibold uppercase tracking-widest', MODULE_COLORS[module] ?? 'text-[#A8A8A8]')}>
                  {module}
                </span>
              </div>
              {entries.map((p) => (
                <div key={p.key} className="border-t border-white/10">
                  <button
                    onClick={() => setExpanded(expanded === p.key ? null : p.key)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="flex-1 text-[12px] text-[#D0D0D0] font-mono">{p.key}</span>
                    <span className="text-[10px] text-[#6E6E6E] tabular-nums">{p.chars.toLocaleString()} chars</span>
                    <span className="text-[10px] text-[#404040] border border-white/10 px-1.5 py-0.5">{p.source}</span>
                    <ChevronDown className={cn('h-3 w-3 text-[#6E6E6E] transition-transform', expanded === p.key && 'rotate-180')} />
                  </button>
                  {expanded === p.key && (
                    <div className="px-4 pb-3">
                      <div className="relative">
                        <pre className="text-[10px] text-[#A8A8A8] bg-black p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                          {p.prompt_text}
                        </pre>
                        <button
                          onClick={() => navigator.clipboard.writeText(p.prompt_text).catch(() => {})}
                          className="absolute top-2 right-2 text-[#404040] hover:text-[#A8A8A8] transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
