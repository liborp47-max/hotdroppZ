'use client'

import { RefreshCw, X, CheckCircle2, Activity } from 'lucide-react'
import type { ArtistIntelRunState } from '@/lib/services/artist-intel-progress'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

export function IntelProgressModal({
  open,
  run,
  onClose,
}: {
  open: boolean
  run: ArtistIntelRunState | null
  onClose: () => void
}) {
  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock (called unconditionally).
  const dialogRef = useModalA11y<HTMLDivElement>(open && !!run, onClose)

  if (!open || !run) return null

  const elapsedSeconds = Math.max(
    0,
    Math.floor(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)
  )
  const currentSources = run.sourcesUsed.length > 0 ? run.sourcesUsed : ['collecting...']
  const findings = run.findings ?? []
  const completedActions = run.completedActions.length > 0 ? run.completedActions : ['No completed actions yet']
  const updatedFields = run.updatedFields.length > 0 ? run.updatedFields : ['No fields updated yet']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Get Intel progress"
        tabIndex={-1}
        className="w-full max-w-xl rounded-2xl border border-white/15 bg-black shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2 text-yellow-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Get Intel Progress</span>
            </div>
            <h3 className="mt-2 text-lg font-bold text-[#E8E8E8]">{run.artistName ?? 'Get Intel Run'}</h3>
            <p className="mt-1 text-sm text-[#A8A8A8]">{run.currentStep}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-[#A8A8A8] transition-colors hover:bg-white/[0.03] backdrop-blur-md hover:text-[#E8E8E8]"
            aria-label="Close intel progress"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">Status</p>
              <p className="mt-1 text-sm font-semibold text-[#E8E8E8]">{run.status}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">Progress</p>
              <p className="mt-1 text-sm font-semibold text-[#E8E8E8]">{run.processed}/{run.total}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">Elapsed</p>
              <p className="mt-1 text-sm font-semibold text-[#E8E8E8]">{elapsedSeconds}s</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">Confidence</p>
              <p className="mt-1 text-sm font-semibold text-[#E8E8E8]">
                {run.confidence == null ? '—' : `${Math.round(run.confidence * 100)}%`}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">
              <Activity className="h-3.5 w-3.5 text-venom-400" />
              What it is doing now
            </div>
            <p className="text-sm text-[#E8E8E8] leading-relaxed">{run.currentStep}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Sources used</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentSources.map((source) => (
                  <span key={source} className="rounded-full border border-white/15 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#D0D0D0]">
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Already completed</h4>
              <ul className="mt-3 space-y-2">
                {completedActions.map((action) => (
                  <li key={action} className="flex items-start gap-2 text-sm text-[#E8E8E8]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00E085] mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Fields touched</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {updatedFields.map((field) => (
                <span key={field} className="rounded-full border border-white/15 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#D0D0D0]">
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Live Findings (What + Source)</h4>
            {findings.length === 0 ? (
              <p className="mt-3 text-sm text-[#A8A8A8]">No findings yet. Agent is still searching.</p>
            ) : (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {findings.slice().reverse().map((finding) => (
                  <div
                    key={`${finding.timestamp}-${finding.source}-${finding.value}`}
                    className="rounded-lg border border-white/10 bg-black/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[#D0D0D0] font-medium">{finding.label}</p>
                      <span className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2 py-0.5 text-[10px] uppercase tracking-wider text-venom-300">
                        {finding.source}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#A8A8A8] break-all">{finding.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">Live Agent Log</h4>
            <div className="mt-3 space-y-2">
              {run.logs.slice().reverse().map((entry) => (
                <div key={`${entry.timestamp}-${entry.message}`} className="rounded-lg border border-white/10 bg-black/70 px-3 py-2">
                  <p className="text-sm text-[#E8E8E8]">{entry.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
