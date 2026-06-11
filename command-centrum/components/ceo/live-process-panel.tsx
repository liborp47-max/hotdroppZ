'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { RunStep, MissionReport } from '@/lib/hd-central/types'
import { Copy, CheckCircle2, FileText, Users, Wrench, Terminal } from 'lucide-react'

const LEVEL_COLORS: Record<string, string> = {
  info: '#6E6E6E',
  action: '#00E085',
  test: '#00B4FF',
  done: '#1AEE99',
  error: '#FF5A5A',
}

function detectAgent(message: string): string | null {
  // Match @agent-id at start or after standard separators
  const m = message.match(/(^|\s)@([a-z0-9-]+)/i)
  if (m) return m[2]
  // Match agent name followed by colon (e.g. "plan-manager: ...")
  const m2 = message.match(/^([a-z][a-z0-9-]+):\s/)
  if (m2 && m2[1].length > 2) return m2[1]
  return null
}

function detectSubMissionProgress(steps: RunStep[]): { current: number; total: number } | null {
  // Find latest [X/N] pattern
  let last: { current: number; total: number } | null = null
  for (const s of steps) {
    const m = s.message.match(/\[(\d+)\/(\d+)\]/)
    if (m) last = { current: parseInt(m[1], 10), total: parseInt(m[2], 10) }
  }
  return last
}

export function LiveProcessPanel({
  steps,
  report,
  isRunning,
}: {
  steps: RunStep[]
  report: MissionReport | null
  isRunning: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [steps.length])

  const copyReport = () => {
    if (!report) return
    try { navigator.clipboard?.writeText(JSON.stringify(report, null, 2)) } catch {}
  }

  const progress = useMemo(() => detectSubMissionProgress(steps), [steps])
  const activeAgent = useMemo(() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const agent = detectAgent(steps[i].message)
      if (agent) return agent
    }
    return null
  }, [steps])

  const progressPct = progress ? (progress.current / progress.total) * 100 : 0

  return (
    <div className="flex h-80 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3.5 py-1.5">
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <span className="hd-live h-1.5 w-1.5" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#00E085]">running</span>
          </div>
        )}
        {!isRunning && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E6E]">idle</span>
        )}

        {/* Active agent badge */}
        {isRunning && activeAgent && (
          <span
            className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[10px] font-mono text-[#1AEE99]"
            title="Currently active agent"
          >
            <Users className="h-2.5 w-2.5" />
            @{activeAgent}
          </span>
        )}

        {/* Step counter */}
        <span className="ml-auto text-[10px] font-mono text-[#6E6E6E]">{steps.length} steps</span>

        {report && (
          <button
            onClick={copyReport}
            className="plastic-button px-2 py-0.5 text-[10px] flex items-center gap-1 font-mono"
            title="Copy full report JSON"
          >
            <Copy className="h-3 w-3 text-[#00E085]" /> copy
          </button>
        )}
      </header>

      {/* Sub-mission progress bar */}
      {isRunning && progress && (
        <div className="px-3.5 py-1.5 border-b border-[#1F1F1F] bg-black/30 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#A8A8A8] mb-1">
            <span>
              sub-mission{' '}
              <span className="text-[#1AEE99]">
                {progress.current}/{progress.total}
              </span>
            </span>
            <span className="text-[#6E6E6E]">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1 w-full bg-white/[0.04] overflow-hidden border border-white/5">
            <div
              className="h-full bg-[#00E085] transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                boxShadow: '0 0 8px rgba(0,224,133,0.6)',
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={ref}
        className="flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[11px] leading-relaxed"
        style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #050505 100%)' }}
      >
        {steps.length === 0 && !report && (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 py-6 text-center">
            <div
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02]"
            >
              <Terminal className="h-4 w-4 text-[#3A3A3A]" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E6E]">
                console standby
              </div>
              <div className="text-[10px] text-[#4A4A4A]">
                Awaiting mission. Click GO on a selected mission to start streaming.
              </div>
            </div>
          </div>
        )}
        {steps.map((s, i) => {
          const isLatest = i === steps.length - 1 && isRunning
          const agent = detectAgent(s.message)
          return (
            <div
              key={i}
              className={`flex gap-2 ${isLatest ? 'bg-[rgba(0,224,133,0.04)] -mx-3.5 px-3.5 border-l-2 border-[#00E085]/45' : ''}`}
            >
              <span className="text-[#4A4A4A] shrink-0">
                [{new Date(s.ts).toLocaleTimeString()}]
              </span>
              <span
                className="shrink-0 uppercase font-bold w-12"
                style={{ color: LEVEL_COLORS[s.level] }}
              >
                {s.level}
              </span>
              {agent && (
                <span className="shrink-0 text-[#1AEE99] font-mono text-[10px] mt-0.5">
                  @{agent}
                </span>
              )}
              <span className="text-[#D0D0D0] flex-1 min-w-0 break-words">{s.message}</span>
              {s.file && <span className="text-[#6E6E6E] italic">({s.file})</span>}
            </div>
          )
        })}

        {report && !isRunning && (
          <div className="mt-2.5 pt-2.5 border-t border-[#1F1F1F] space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="h-3 w-3 text-[#00E085]" />
              <span className="text-[#00E085] uppercase tracking-widest font-semibold text-[10px]">
                Report written
              </span>
              <FileText className="h-3 w-3 text-[#00B4FF]" />
              <span className="text-[#00B4FF] blue-glow text-[10px]">
                SYSTEM/INFO/MISSIONS/{report.runId}.md
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-[#A8A8A8] flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Users className="h-2.5 w-2.5 text-[#1AEE99]" />
                {report.agents.length} agents
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-2.5 w-2.5 text-[#00B4FF]" />
                {report.tools.length} tools
              </span>
              <span>·</span>
              <span>{report.steps.length} steps</span>
              <span>·</span>
              <span>
                {Math.round(
                  (new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()) /
                    1000,
                )}
                s duration
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
