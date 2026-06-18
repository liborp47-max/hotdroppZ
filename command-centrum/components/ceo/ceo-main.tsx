'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Copy, X } from 'lucide-react'
import type { Mission, MissionAuditReport, MissionReport, RunStep, StageId } from '@/lib/hd-central/types'
import { MissionCentrum } from './mission-centrum/mission-centrum'
import { TimelinePanel } from './timeline-panel'
import { LiveProcessPanel } from './live-process-panel'
import { BottomControlPanel } from './bottom-control-panel'
import { PipelineTab } from './pipeline/pipeline-tab'
import { AlertCenter } from './alert-center'
import { TabBar, type TabBarTab } from './tab-bar'
import { Activity, GitBranch, Layers } from 'lucide-react'
import { missionLifecycleStatus, sortByUrgency } from '@/lib/hd-central/lifecycle'
import { buildAuditPopupText, closeAuditPopup } from '@/lib/hd-central/audit-popup'
import { usePlanStream } from '@/lib/hd-central/use-plan-stream'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

type CeoTabId = 'pipeline' | 'mission' | 'audit'

export function CeoMain() {
  // Phase 2: single live plan source shared across HD Central (SSE).
  const { plan, refresh } = usePlanStream()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [runSteps, setRunSteps] = useState<RunStep[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [lastReport, setLastReport] = useState<MissionReport | null>(null)
  const [popupAuditReport, setPopupAuditReport] = useState<MissionAuditReport | null>(null)
  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock for the auditor-report popup.
  const auditPopupRef = useModalA11y<HTMLDivElement>(!!popupAuditReport, () =>
    setPopupAuditReport(closeAuditPopup()),
  )
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [syncingState, setSyncingState] = useState(false)
  const [stateSyncNote, setStateSyncNote] = useState<string | null>(null)
  const [bulkingComplete, setBulkingComplete] = useState(false)
  const [bulkResultNote, setBulkResultNote] = useState<string | null>(null)
  // Lifted from PipelineDiagram so the inline stage detail (Pipeline tab) and
  // the CEO header badge can stay in sync.
  const [selectedStageId, setSelectedStageId] = useState<StageId | null>(null)
  const [activeTab, setActiveTab] = useState<CeoTabId>('pipeline')

  // Mutations re-fetch via the shared stream; selection is maintained reactively
  // (below) so the boolean arg is kept only for call-site compatibility.
  const loadPlan = useCallback(async () => {
    await refresh()
  }, [refresh])

  // Keep a valid selection as the plan changes (initial load, SSE pushes,
  // mutations): preserve the current pick if still selectable, else fall back to
  // the ACTIVE mission, else the most urgent.
  useEffect(() => {
    if (!plan) return
    setSelectedId((prev) => {
      const selectable = sortByUrgency(
        plan.missions.filter(
          (mission) =>
            missionLifecycleStatus(mission) !== 'MISSION_DONE' &&
            mission.inTimeline !== false,
        ),
      )
      if (prev && selectable.some((m) => m.id === prev)) return prev
      const activeId = selectable.find((mission) => missionLifecycleStatus(mission) === 'ACTIVE')?.id ?? null
      return activeId ?? selectable[0]?.id ?? null
    })
  }, [plan])

  const timelineMissions = useMemo(
    () =>
      sortByUrgency(
        (plan?.missions ?? []).filter(
          (mission) =>
            !mission.isDeleted &&
            mission.inTimeline !== false,
        ),
      ),
    [plan?.missions],
  )

  const inboxCount = useMemo(
    () => (plan?.missions ?? []).filter((m) => m.inTimeline === false && !m.isDeleted).length,
    [plan?.missions],
  )

  const selectedMission: Mission | null = useMemo(
    () => timelineMissions.find((mission) => mission.id === selectedId) ?? null,
    [timelineMissions, selectedId],
  )

  const pushRunStep = useCallback((step: RunStep) => {
    setRunSteps((prev) => [...prev, step])
  }, [])

  const streamReportSteps = useCallback(async (report: MissionReport, streamSpeed: 'slow' | 'normal' | 'fast' = 'normal') => {
    const delay = streamSpeed === 'slow' ? 900 : streamSpeed === 'fast' ? 180 : 450
    for (let i = 0; i < report.steps.length; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
      pushRunStep(report.steps[i])
    }
  }, [pushRunStep])

  const solveMissionRequest = useCallback(
    async (
      missionId: string,
      decision: 'A' | 'B' | 'C' | 'solve',
      options: { stepIndex?: number; totalSteps?: number; solveAll?: boolean; reportShown?: boolean; speed?: 'slow' | 'normal' | 'fast' } = {},
    ) => {
      const res = await fetch(`/api/hd-central/mission/${encodeURIComponent(missionId)}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...options }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      return (await res.json()) as {
        report: MissionReport
        mission: Mission
        auditReport?: MissionAuditReport
      }
    },
    [],
  )

  const runRelevanceCheck = useCallback(async (missionId: string) => {
    const res = await fetch(`/api/hd-central/mission/${encodeURIComponent(missionId)}/relevance-check`, {
      method: 'POST',
    })
    if (!res.ok) return null
    return (await res.json()) as {
      missionId: string
      verdict: 'proceed' | 'review' | 'archive'
      score: number
      checkedAt: string
      reasons: string[]
      warnings: string[]
      recommendations: string[]
    }
  }, [])

  const runMission = useCallback(
    async (decision: 'A' | 'B' | 'C' | 'solve', opts?: { skipRelevanceCheck?: boolean }) => {
      if (!selectedMission || isRunning) return
      setIsRunning(true)
      setRunSteps([])
      setLastReport(null)

      try {
        // ── Pre-execution relevance check ──
        if (!opts?.skipRelevanceCheck) {
          pushRunStep({
            ts: new Date().toISOString(),
            level: 'info',
            message: 'Pre-execution relevance check…',
          })
          const check = await runRelevanceCheck(selectedMission.id)
          if (check) {
            pushRunStep({
              ts: new Date().toISOString(),
              level: check.verdict === 'proceed' ? 'done' : 'action',
              message: `Relevance ${check.verdict.toUpperCase()} (score ${check.score}/100)${
                check.warnings.length > 0 ? ` · ${check.warnings.length} warnings` : ''
              }`,
            })
            if (check.verdict !== 'proceed') {
              const summary =
                `Relevance: ${check.verdict.toUpperCase()} (${check.score}/100)\n\n` +
                (check.warnings.length > 0 ? `Warnings:\n- ${check.warnings.join('\n- ')}\n\n` : '') +
                (check.recommendations.length > 0
                  ? `Doporučení:\n- ${check.recommendations.join('\n- ')}\n\n`
                  : '') +
                'Spustit přesto?'
              const proceed = globalThis.confirm(summary)
              if (!proceed) {
                pushRunStep({
                  ts: new Date().toISOString(),
                  level: 'info',
                  message: 'Solve aborted by user (relevance check).',
                })
                setIsRunning(false)
                return
              }
            }
          }
        }

        const data = await solveMissionRequest(selectedMission.id, decision, {
          stepIndex: 1,
          totalSteps: 1,
          reportShown: true,
          speed,
        })

        await streamReportSteps(data.report, speed)

        setLastReport(data.report)
        if (data.auditReport) setPopupAuditReport(data.auditReport)
        await loadPlan()
      } catch (error) {
        console.error('solve failed:', error)
      } finally {
        setIsRunning(false)
      }
    },
    [selectedMission, isRunning, loadPlan, solveMissionRequest, streamReportSteps, runRelevanceCheck, pushRunStep],
  )

  const returnToColdCase = useCallback(async (missionId?: string) => {
    const targetId = missionId ?? selectedMission?.id
    if (!targetId) return
    try {
      const response = await fetch(
        `/api/hd-central/mission/${encodeURIComponent(targetId)}/cold-case`,
        { method: 'POST' },
      )
      if (!response.ok) {
        console.error('cold-case failed:', await response.text())
        return
      }
      await loadPlan()
    } catch (error) {
      console.error('[ceo] returnToColdCase:', error)
    }
  }, [selectedMission?.id, loadPlan])

  const deleteMission = useCallback(async (missionId?: string) => {
    const targetId = missionId ?? selectedMission?.id
    if (!targetId) return
    if (!globalThis.confirm(`Delete mission ${targetId}?`)) return

    try {
      const response = await fetch(`/api/hd-central/mission/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        console.error('delete mission failed:', await response.text())
        return
      }
      await loadPlan()
    } catch (error) {
      console.error('[ceo] deleteMission:', error)
    }
  }, [selectedMission?.id, loadPlan])

  const solveAll = useCallback(async () => {
    if (!plan || isRunning) return

    const solveTargets = sortByUrgency(
      plan.missions.filter(
        (mission) =>
          !mission.isDeleted &&
          !mission.coldCase &&
          mission.inTimeline !== false &&
          missionLifecycleStatus(mission) !== 'MISSION_DONE',
      ),
    )

    if (solveTargets.length === 0) return

    setIsRunning(true)
    setRunSteps([
      {
        ts: new Date().toISOString(),
        level: 'action',
        message: `Solve All started for ${solveTargets.length} missions`,
      },
    ])
    setLastReport(null)

    try {
      for (const [index, mission] of solveTargets.entries()) {
        const data = await solveMissionRequest(mission.id, 'solve', {
          stepIndex: index + 1,
          totalSteps: solveTargets.length,
          solveAll: true,
          reportShown: true,
        })

        await streamReportSteps(data.report)
        setLastReport(data.report)
        if (data.auditReport) setPopupAuditReport(data.auditReport)
        await loadPlan()
      }

      pushRunStep({
        ts: new Date().toISOString(),
        level: 'done',
        message: 'Solve All finished',
      })
    } catch (error) {
      pushRunStep({
        ts: new Date().toISOString(),
        level: 'error',
        message: `Solve All failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      console.error('[ceo] solveAll:', error)
    } finally {
      await loadPlan()
      setIsRunning(false)
    }
  }, [plan, isRunning, solveMissionRequest, streamReportSteps, loadPlan, pushRunStep])

  const refreshTimeline = useCallback(() => {
    void loadPlan()
  }, [loadPlan])

  const syncPipelineState = useCallback(async () => {
    setSyncingState(true)
    setStateSyncNote(null)
    try {
      const res = await fetch('/api/hd-central/pipeline-state/sync', { method: 'POST' })
      if (!res.ok) {
        setStateSyncNote('State sync failed.')
        return
      }
      const data = (await res.json()) as {
        counts: { missions: number; subMissions: number; workers: number; pipelineStages: number }
      }
      setStateSyncNote(
        `State synced: ${data.counts.missions} missions · ${data.counts.subMissions} subs · ${data.counts.workers} workers · ${data.counts.pipelineStages} stages → SYSTEM/INFO/PIPELINE_STATE/`,
      )
    } catch {
      setStateSyncNote('State sync failed (network).')
    } finally {
      setSyncingState(false)
    }
  }, [])

  // Auto-sync state on initial load + after any mission action (debounced via deps)
  useEffect(() => {
    void syncPipelineState()
  }, [syncPipelineState])

  // Re-sync whenever plan.updatedAt changes (after solve, push-to-timeline, etc.)
  useEffect(() => {
    if (!plan?.updatedAt) return
    void syncPipelineState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.updatedAt])

  const bulkCompleteAll = useCallback(async () => {
    if (bulkingComplete) return
    const openCount = (plan?.missions ?? []).filter(
      (m) => !m.isDeleted && (m.lifecycleStatus ?? 'PLAN') !== 'MISSION_DONE',
    ).length
    if (openCount === 0) {
      setBulkResultNote('Žádné otevřené mise — nic k uzavření.')
      return
    }
    if (!globalThis.confirm(`Označit ${openCount} otevřených misí (a všechny jejich sub-mise) jako DONE?`)) {
      return
    }
    setBulkingComplete(true)
    setBulkResultNote(null)
    try {
      const res = await fetch('/api/hd-central/missions/bulk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'ceo-ui', reason: 'Bulk mark-as-done from CEO header' }),
      })
      if (!res.ok) {
        setBulkResultNote('Bulk complete selhal.')
        return
      }
      const data = (await res.json()) as {
        counts: { missionsMarked: number; subMissionsMarked: number; alreadyDone: number; skipped: number }
      }
      setBulkResultNote(
        `Označeno: ${data.counts.missionsMarked} misí · ${data.counts.subMissionsMarked} sub-misí · již done: ${data.counts.alreadyDone} · skip: ${data.counts.skipped}`,
      )
      await loadPlan()
    } catch {
      setBulkResultNote('Bulk complete selhal (network).')
    } finally {
      setBulkingComplete(false)
    }
  }, [bulkingComplete, plan?.missions, loadPlan])

  const copyPopupReport = useCallback(() => {
    if (!popupAuditReport) return
    const text = buildAuditPopupText(popupAuditReport)
    try {
      navigator.clipboard?.writeText(text)
    } catch {}
  }, [popupAuditReport])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-3 border-b border-[#1F1F1F] shrink-0 flex items-center gap-3"
        style={{ background: 'linear-gradient(180deg, #161616 0%, #0F0F0F 100%)' }}>
        <Bot className="h-4 w-4 text-[#00E085]" style={{ filter: 'drop-shadow(0 0 6px rgba(63, 255, 122, 0.55))' }} />
        <span className="section-title">HD Central / CEO</span>
        <span className="text-[10px] text-[#6E6E6E] font-mono">orchestration cockpit</span>

        {/* Speed control */}
        <div className="ml-3 flex items-center gap-1 border border-white/10 rounded-none" title="Streaming speed for Solve">
          <span className="text-[9px] uppercase tracking-widest text-[#6E6E6E] px-1.5">speed</span>
          {(['slow', 'normal', 'fast'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              disabled={isRunning}
              className={
                'px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition-colors ' +
                (speed === s
                  ? 'bg-[rgba(0,224,133,0.14)] text-[#1AEE99]'
                  : 'text-[#A8A8A8] hover:text-[#E8E8E8]') +
                (isRunning ? ' opacity-40 cursor-not-allowed' : '')
              }
            >
              {s}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-[10px] font-mono">
          {plan ? (
            <>
              <span className="text-[#6E6E6E]">
                {plan.missions.filter((m) => !m.isDeleted).length} misí
              </span>
              {inboxCount > 0 && (
                <>
                  <span className="text-[#4A4A4A]">·</span>
                  <a
                    href="/hd-central/ceo/missions"
                    className="text-amber-300 hover:text-amber-200"
                  >
                    {inboxCount} v inboxu
                  </a>
                </>
              )}
              <span className="text-[#4A4A4A]">·</span>
              <span className="text-[#1AEE99] venom-glow">updated {new Date(plan.updatedAt).toLocaleTimeString()}</span>
            </>
          ) : (
            <span className="text-[#6E6E6E]">loading...</span>
          )}
          <button
            type="button"
            onClick={() => void syncPipelineState()}
            disabled={syncingState}
            title="Sync pipeline state files → SYSTEM/INFO/PIPELINE_STATE/"
            className="ml-2 px-2 py-1 border border-white/15 bg-white/[0.03] text-[10px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#1AEE99] hover:border-[#00E085]/40 disabled:opacity-40 inline-flex items-center gap-1"
          >
            {syncingState ? '⟳ syncing' : '⟳ sync state'}
          </button>
          <button
            type="button"
            onClick={() => void bulkCompleteAll()}
            disabled={bulkingComplete || isRunning}
            title="Mark all open missions + sub-missions as DONE (admin bulk action)"
            className="px-2 py-1 border border-[#00E085]/30 bg-[rgba(0,224,133,0.06)] text-[10px] uppercase tracking-widest text-[#1AEE99] hover:bg-[rgba(0,224,133,0.14)] hover:border-[#00E085]/60 disabled:opacity-40 inline-flex items-center gap-1"
          >
            {bulkingComplete ? '… marking' : 'mark all done'}
          </button>
        </div>
      </header>
      {stateSyncNote && (
        <div className="px-6 py-1 text-[10px] text-[#00B4FF] bg-black/40 border-b border-white/[0.04] truncate">
          {stateSyncNote}
        </div>
      )}
      {bulkResultNote && (
        <div className="px-6 py-1 text-[10px] text-[#1AEE99] bg-black/40 border-b border-white/[0.04] truncate">
          {bulkResultNote}
        </div>
      )}

      {/* Critical-failure alert banner — visible across all three CEO tabs.
          Self-hides when there are no active alerts. (UM-CEO #05) */}
      <AlertCenter />

      {/* Browser-style tabs for the three CEO sections. Active tab gets the
          full content area; TimelinePanel + BottomControlPanel remain mounted
          across all tabs so timeline state never blinks on tab switch. */}
      {(() => {
        const tabs: TabBarTab[] = [
          {
            id: 'pipeline',
            label: 'Pipeline',
            icon: <GitBranch className="text-[#00E085]" />,
            badge: selectedStageId ?? `${plan?.missions.filter((m) => !m.isDeleted).length ?? 0} missions`,
            badgeVariant: selectedStageId ? 'venom' : 'neutral',
          },
          {
            id: 'mission',
            label: 'Mission Centrum',
            icon: <Layers className="text-[#1AEE99]" />,
            badge: selectedMission?.id ?? 'none',
            badgeVariant: selectedMission ? 'venom' : 'neutral',
          },
          {
            id: 'audit',
            label: 'Audit / Debug',
            icon: <Activity className={isRunning ? 'text-[#00E085]' : 'text-[#6E6E6E]'} />,
            badge: isRunning ? `${runSteps.length} live` : runSteps.length > 0 ? `${runSteps.length} steps` : 'idle',
            badgeVariant: isRunning ? 'venom' : runSteps.length > 0 ? 'cyan' : 'neutral',
          },
        ]

        return (
          <TabBar
            tabs={tabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as CeoTabId)}
            ariaLabel="CEO sections"
          />
        )
      })()}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 p-4 min-h-0">
          {activeTab === 'pipeline' && (
            <div
              role="tabpanel"
              aria-label="Pipeline"
              className="flex-1 min-h-0 flex flex-col"
            >
              <PipelineTab
                selectedStageId={selectedStageId}
                onSelectStage={setSelectedStageId}
              />
            </div>
          )}

          {activeTab === 'mission' && (
            <div
              role="tabpanel"
              aria-label="Mission Centrum"
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <MissionCentrum
                mission={selectedMission}
                onSolve={runMission}
                onReturnToColdCase={returnToColdCase}
                isRunning={isRunning}
                onPlanChanged={refreshTimeline}
              />
            </div>
          )}

          {activeTab === 'audit' && (
            <div
              role="tabpanel"
              aria-label="Audit / Debug Console"
              className="flex-1 min-h-0 flex flex-col plastic-card rounded-md border border-[#1F1F1F] overflow-hidden"
            >
              <div className="shrink-0 flex items-center gap-2 border-b border-[#1F1F1F] px-4 py-2"
                style={{ background: 'linear-gradient(180deg, rgba(22,22,22,0.85) 0%, rgba(15,15,15,0.85) 100%)' }}>
                <Activity aria-hidden className={`h-3.5 w-3.5 ${isRunning ? 'text-[#00E085]' : 'text-[#6E6E6E]'}`} />
                <span className="section-title">Audit / Debug Console</span>
                <span className="text-[10px] font-mono text-[#6E6E6E] flex items-center gap-1.5">
                  <span>
                    <span className={runSteps.length > 0 ? 'text-[#E8E8E8]' : 'text-[#6E6E6E]'}>
                      {runSteps.length}
                    </span>{' '}
                    steps
                  </span>
                  <span className="text-[#3A3A3A]">·</span>
                  <span className={isRunning ? 'text-[#1AEE99]' : 'text-[#6E6E6E]'}>
                    {isRunning ? 'running' : 'idle'}
                  </span>
                  {lastReport && !isRunning && (
                    <>
                      <span className="text-[#3A3A3A]">·</span>
                      <span className="text-[#A8A8A8]">last: {lastReport.agents.length} agents</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <LiveProcessPanel
                  steps={runSteps}
                  report={lastReport}
                  isRunning={isRunning}
                />
              </div>
            </div>
          )}
        </div>

        <TimelinePanel
          missions={timelineMissions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={refreshTimeline}
          onSolveAll={solveAll}
          onMoveToColdCase={returnToColdCase}
          onDeleteMission={deleteMission}
          isBusy={isRunning}
        />
      </div>

      <BottomControlPanel />

      {popupAuditReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div
            ref={auditPopupRef}
            role="dialog"
            aria-modal="true"
            aria-label="Auditor report"
            tabIndex={-1}
            className="w-full max-w-xl plastic-card border border-[#1F1F1F] outline-none"
          >
            <header className="px-4 py-3 border-b border-[#1F1F1F] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
              <span className="section-title">AUDITOR REPORT</span>
              <span className="ml-auto text-[10px] font-mono text-[#6E6E6E]">{popupAuditReport.missionId}</span>
            </header>

            <div className="p-4 space-y-2 text-[12px]">
              <div className="text-[#D0D0D0]">
                <span className="text-[#6E6E6E] mr-2">Step:</span>
                <span className="font-mono">
                  {popupAuditReport.stepIndex}
                  {typeof popupAuditReport.totalSteps === 'number' ? ` / ${popupAuditReport.totalSteps}` : ''}
                </span>
              </div>
              <div className="text-[#D0D0D0]">
                <span className="text-[#6E6E6E] mr-2">Verdict:</span>
                <span className="font-semibold text-[#00E085]">{popupAuditReport.verdict}</span>
              </div>
              <div className="text-[#D0D0D0]">
                <span className="text-[#6E6E6E] mr-2">Run:</span>
                <span className="font-mono">{popupAuditReport.runId}</span>
              </div>
              <div className="text-[#D0D0D0]">
                <span className="text-[#6E6E6E] mr-2">Timestamp:</span>
                <span>{new Date(popupAuditReport.timestamp).toLocaleString()}</span>
              </div>
              <p className="plastic-card-hi p-3 text-[#A8A8A8] leading-relaxed">{popupAuditReport.summary}</p>
            </div>

            <footer className="px-4 py-3 border-t border-[#1F1F1F] flex items-center justify-end gap-2">
              <button
                onClick={copyPopupReport}
                className="plastic-button px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5"
              >
                <Copy className="h-3 w-3 text-[#00E085]" />
                Copy report
              </button>
              <button
                onClick={() => setPopupAuditReport(closeAuditPopup())}
                className="plastic-button-venom px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5"
              >
                <X className="h-3 w-3" />
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
