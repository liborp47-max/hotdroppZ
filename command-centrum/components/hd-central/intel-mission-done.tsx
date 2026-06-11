'use client'

import { useEffect, useState } from 'react'
import type { Mission, Plan } from '@/lib/hd-central/types'
import { missionLifecycleStatus, sortByUrgency } from '@/lib/hd-central/lifecycle'

export function IntelMissionDone() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/hd-central/plan')
        if (!response.ok) return

        const plan = (await response.json()) as Plan
        if (cancelled) return

        // UM-MISSION_TRUTH_GATE renderer harmony — show MISSION_DONE +
        // SIMULATED_ONLY (visually distinguished below); SIMULATED_ONLY must
        // never silently disappear from CEO intel.
        const terminalStates: Array<ReturnType<typeof missionLifecycleStatus>> = ['MISSION_DONE', 'SIMULATED_ONLY']
        const done = sortByUrgency(
          plan.missions.filter(
            (mission) => !mission.isDeleted && terminalStates.includes(missionLifecycleStatus(mission)),
          ),
        )
        setMissions(done)
      } catch (error) {
        console.error('[intel] load mission done:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-[#A8A8A8]">Loading mission reports...</p>
  }

  if (missions.length === 0) {
    return <p className="text-sm text-[#A8A8A8]">No resolved missions yet in MISSION_DONE.</p>
  }

  return (
    <div className="space-y-2 w-full max-w-3xl">
      {missions.map((mission) => {
        const lc = missionLifecycleStatus(mission)
        const isSim = lc === 'SIMULATED_ONLY'
        return (
          <details
            key={mission.id}
            className={`border ${
              isSim ? 'border-[#FFB020]/30 bg-[#1A1408]' : 'border-[#1A1A1A] bg-[#0C140F]'
            }`}
          >
            <summary className="list-none cursor-pointer px-4 py-3 flex items-center gap-3 text-sm">
              <span className={`font-mono ${isSim ? 'text-[#C49032]' : 'text-[#5C9A72]'}`}>{mission.id}</span>
              <span className="text-[#E8E8E8] truncate">{mission.name}</span>
              <span
                className={`ml-auto text-[11px] font-mono ${
                  isSim ? 'text-[#FFB020]' : 'text-[#A8A8A8]'
                }`}
              >
                {isSim ? 'SIMULATED_ONLY' : 'MISSION DONE'}
              </span>
            </summary>
            <div className={`px-4 pb-4 text-sm space-y-2 ${isSim ? 'text-[#E8C68A]' : 'text-[#A4C8AE]'}`}>
              <p>{mission.auditReport?.summary ?? mission.purpose}</p>
              <div className="text-[12px] text-[#A8A8A8] space-y-1">
                <p>Verdict: {mission.auditReport?.verdict ?? 'Neovereno'}</p>
                <p>Timestamp: {mission.auditReport?.timestamp ? new Date(mission.auditReport.timestamp).toLocaleString() : 'Neovereno'}</p>
                <p>Report path: {mission.reportPath ?? 'Neovereno'}</p>
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
