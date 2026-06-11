'use client'

import { useCallback, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Play, Snowflake, Wand2 } from 'lucide-react'
import type { Mission } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'
import { PromptDialog } from '@/components/ceo/prompt-dialog'

interface ActionStripProps {
  mission: Mission
  onSolve: (decision: 'A' | 'B' | 'C' | 'solve') => void
  onReturnToColdCase: () => void
  isRunning: boolean
  onPlanChanged?: () => void
}

interface MissionPromptResponse {
  output: string
  qualityScore?: number
  targetModule?: string
  agents?: string[]
  tools?: string[]
}

export function ActionStrip({
  mission,
  onSolve,
  onReturnToColdCase,
  isRunning,
  onPlanChanged,
}: ActionStripProps) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptResp, setPromptResp] = useState<MissionPromptResponse | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)

  const lifecycleStatus = mission.lifecycleStatus ?? 'PLAN'
  const done = lifecycleStatus === 'MISSION_DONE'
  // UM-MISSION_TRUTH_GATE renderer harmony — SIMULATED_ONLY must visually
  // distinguish from MISSION_DONE (amber, not green). Re-actions still allowed.
  const simulatedOnly = lifecycleStatus === 'SIMULATED_ONLY'
  const showPush = mission.inTimeline === false

  const handlePrompt = useCallback(async () => {
    setPromptOpen(true)
    setPromptLoading(true)
    setPromptResp(null)
    try {
      const res = await fetch(
        `/api/hd-central/mission/${encodeURIComponent(mission.id)}/prompt`,
        { method: 'POST' },
      )
      if (!res.ok) {
        setPromptResp({ output: `Error ${res.status}: ${await res.text()}` })
        return
      }
      const data = (await res.json()) as MissionPromptResponse
      setPromptResp(data)
    } catch (e) {
      setPromptResp({ output: `Network error: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setPromptLoading(false)
    }
  }, [mission.id])

  const handlePush = useCallback(async () => {
    setPushing(true)
    setPushError(null)
    try {
      const res = await fetch('/api/hd-central/missions/push-to-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'one', missionIds: [mission.id] }),
      })
      if (!res.ok) {
        setPushError(`Push failed (${res.status})`)
        return
      }
      onPlanChanged?.()
    } catch (e) {
      setPushError(`Push failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPushing(false)
    }
  }, [mission.id, onPlanChanged])

  const handleMarkDone = useCallback(async () => {
    setMarking(true)
    setMarkError(null)
    try {
      const res = await fetch('/api/hd-central/missions/bulk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [mission.id],
          actor: 'CEO',
          reason: 'Mark as done from Mission Centrum',
        }),
      })
      if (!res.ok) {
        setMarkError(`Mark done failed (${res.status})`)
        return
      }
      onPlanChanged?.()
    } catch (e) {
      setMarkError(`Mark done failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setMarking(false)
    }
  }, [mission.id, onPlanChanged])

  return (
    <section className="plastic-card-hi flex flex-col gap-3 p-3">
      {/* Title row */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
            <span className="font-mono text-[#A8A8A8]">{mission.id}</span>
            {mission.moduleId && (
              <>
                <span className="text-[#3A3A3A]">·</span>
                <span className="font-mono text-[#A8A8A8]">{mission.moduleId}</span>
              </>
            )}
            {mission.reportPath && (
              <>
                <span className="text-[#3A3A3A]">·</span>
                <span className="font-mono text-[#00B4FF] normal-case tracking-normal">
                  {mission.reportPath}
                </span>
              </>
            )}
          </div>
          <h2 className="mt-0.5 text-base font-bold leading-tight text-[#E8E8E8]">
            {mission.name}
          </h2>
        </div>
      </div>

      {/* Pills row */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest">
        {mission.priority && (
          <InfoBadge term={`priority-${mission.priority}`}>
            <span className="plastic-chip px-2 py-0.5 font-semibold text-[#00E085]">
              {mission.priority}
            </span>
          </InfoBadge>
        )}
        {mission.phase && (
          <InfoBadge term={`phase-${mission.phase}`}>
            <span className="plastic-chip px-2 py-0.5 font-semibold text-[#00B4FF]">
              {mission.phase}
            </span>
          </InfoBadge>
        )}
        {typeof mission.urgencyScore === 'number' && (
          <InfoBadge term="urgency-score">
            <span className="plastic-chip px-2 py-0.5 font-mono text-[#F59E0B]">
              U {mission.urgencyScore}
            </span>
          </InfoBadge>
        )}
        <InfoBadge term={`mission-status-${lifecycleStatus}`}>
          <span
            className={`plastic-chip px-2 py-0.5 font-semibold ${
              done
                ? 'text-[#1AEE99] border-[#00E085]/40'
                : simulatedOnly
                  ? 'text-[#FFB020] border-[#FFB020]/50'
                  : 'text-[#E8E8E8]'
            }`}
          >
            {lifecycleStatus}
          </span>
        </InfoBadge>
        {(mission.domains ?? []).map((d) => (
          <span
            key={d}
            className="plastic-chip px-2 py-0.5 font-mono text-[#A8A8A8]"
            title={`Domain: ${d}`}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSolve('solve')}
          disabled={isRunning || done}
          aria-label="Solve mission"
          className="plastic-button-venom flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <Play aria-hidden className="h-3.5 w-3.5" />
          {isRunning ? 'Running…' : 'Solve'}
        </button>
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={marking || done}
          aria-label="Mark mission as done"
          className="plastic-button flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#00E085] disabled:opacity-40"
          style={{ borderColor: 'rgba(0, 224, 133, 0.35)' }}
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
          {marking ? 'Marking…' : done ? 'Done' : 'Mark done'}
        </button>
        <button
          type="button"
          onClick={handlePrompt}
          disabled={promptLoading}
          aria-label="Generate mission prompt"
          className="plastic-button flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <Wand2 aria-hidden className="h-3.5 w-3.5 text-[#00B4FF]" />
          Prompt
        </button>
        {/* AUD-UX-001: removed redundant "Go" button — it was an exact alias of
            Solve (onSolve('solve')), duplicating the action with a second label. */}
        <button
          type="button"
          onClick={onReturnToColdCase}
          disabled={isRunning || !!mission.coldCase || done}
          aria-label="Return to cold case"
          className="plastic-button flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <Snowflake aria-hidden className="h-3.5 w-3.5 text-[#A8A8A8]" />
          Cold-case
        </button>
        {showPush && (
          <button
            type="button"
            onClick={handlePush}
            disabled={pushing}
            aria-label="Push to timeline"
            className="plastic-button flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#00E085] disabled:opacity-40"
          >
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
            {pushing ? 'Pushing…' : 'Push to timeline'}
          </button>
        )}
        {pushError && (
          <span className="text-[10px] font-mono text-[#FF6B6B]">{pushError}</span>
        )}
        {markError && (
          <span className="text-[10px] font-mono text-[#FF6B6B]">{markError}</span>
        )}
      </div>

      <PromptDialog
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        title={mission.name}
        subtitle={mission.id}
        prompt={promptResp?.output ?? null}
        loading={promptLoading}
        qualityScore={promptResp?.qualityScore}
        targetModule={promptResp?.targetModule}
        agents={promptResp?.agents}
        tools={promptResp?.tools}
      />
    </section>
  )
}
