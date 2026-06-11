'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Mission } from '@/lib/hd-central/types'
import { ActionStrip } from './action-strip'
import { MetaGrid } from './meta-grid'
import { PipelineLink } from './pipeline-link'
import { SubMissionList } from './sub-mission-list'
import { SubMissionDetail } from './sub-mission-detail'

export interface MissionCentrumProps {
  mission: Mission | null
  onSolve: (decision: 'A' | 'B' | 'C' | 'solve') => void
  onReturnToColdCase: () => void
  isRunning: boolean
  /** Optional callback invoked after a "Push to timeline" succeeds, so the parent can refresh plan state. */
  onPlanChanged?: () => void
}

/**
 * Mission Centrum — full-width refactor of MissionDetailsPanel (PR-6).
 *
 * Layout (top → bottom):
 *  1. ActionStrip  — id/name + pills + SOLVE / PROMPT / GO / Cold-case / Push buttons
 *  2. PipelineLink — "Affects pipeline: [scout] [filter]" cross-link chips
 *  3. MetaGrid     — Problem | Why | Status & owner (3 plastic-card-hi boxes)
 *  4. SubMissionList     — listbox of sub-missions
 *  5. SubMissionDetail   — 4-box detail + history mini-timeline for the selected sub
 */
export function MissionCentrum({
  mission,
  onSolve,
  onReturnToColdCase,
  isRunning,
  onPlanChanged,
}: MissionCentrumProps) {
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)

  // Auto-select first sub-mission whenever the mission changes.
  useEffect(() => {
    setSelectedSubId(mission?.subMissions?.[0]?.id ?? null)
  }, [mission?.id])

  const selectedSub = useMemo(
    () => mission?.subMissions?.find((s) => s.id === selectedSubId) ?? null,
    [mission?.subMissions, selectedSubId],
  )

  if (!mission) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center px-6 py-8 text-[12px] italic text-[#6E6E6E]">
        Select a mission from the timeline →
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <ActionStrip
        mission={mission}
        onSolve={onSolve}
        onReturnToColdCase={onReturnToColdCase}
        isRunning={isRunning}
        onPlanChanged={onPlanChanged}
      />
      <PipelineLink mission={mission} />
      <MetaGrid mission={mission} />
      <SubMissionList
        mission={mission}
        selectedSubId={selectedSubId}
        onSelect={setSelectedSubId}
      />
      {selectedSub && <SubMissionDetail mission={mission} sub={selectedSub} />}
    </div>
  )
}
