/**
 * HD State Report engine.
 *
 * Deterministic — reads the real plan (missions, sub-missions, audit log) and
 * produces a plain-language, factual snapshot of where HotDroppZ stands plus
 * a diff against the previous report. No AI, no guessing: every number is
 * computed from data, so the CEO report is always reproducible and honest.
 */
import type { Mission, Plan, StateReport, StateReportChange, StateReportMetrics } from './types'

function activeMissions(plan: Plan): Mission[] {
  return (plan.missions ?? []).filter((m) => !m.isDeleted)
}

function isDone(m: Mission): boolean {
  return m.lifecycleStatus === 'MISSION_DONE'
}

function isActive(m: Mission): boolean {
  return !isDone(m) && (m.lifecycleStatus === 'ACTIVE' || m.status === 'in_progress')
}

function missionCompletedAt(m: Mission): string | null {
  const doneEvents = (m.auditLog ?? []).filter((e) => e.event === 'MISSION_DONE')
  if (doneEvents.length > 0) return doneEvents[doneEvents.length - 1].ts
  const subTs = (m.subMissions ?? [])
    .map((s) => s.completedAt)
    .filter((t): t is string => typeof t === 'string')
    .sort()
  return subTs.length > 0 ? subTs[subTs.length - 1] : null
}

function computeMetrics(missions: Mission[]): StateReportMetrics {
  const subs = missions.flatMap((m) => m.subMissions ?? [])
  const done = missions.filter(isDone).length
  const active = missions.filter(isActive).length
  return {
    missionsTotal: missions.length,
    missionsDone: done,
    missionsActive: active,
    missionsTodo: Math.max(0, missions.length - done - active),
    subMissionsTotal: subs.length,
    subMissionsDone: subs.filter((s) => s.status === 'done').length,
    subMissionsBlocked: subs.filter((s) => s.status === 'blocked').length,
    completionPct: subs.length
      ? Math.round((subs.filter((s) => s.status === 'done').length / subs.length) * 100)
      : 0,
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace('T', ' ')
}

function recentActivity(missions: Mission[], limit = 10): string[] {
  const entries: { ts: string; text: string }[] = []
  for (const m of missions) {
    for (const e of m.auditLog ?? []) {
      entries.push({ ts: e.ts, text: `${m.name}: ${e.note ?? e.event}` })
    }
  }
  entries.sort((a, b) => b.ts.localeCompare(a.ts))
  return entries.slice(0, limit).map((e) => `${fmtDate(e.ts)} — ${e.text}`)
}

/** Build a fresh state report; `prev` (if any) drives the change diff. */
export function generateStateReport(
  plan: Plan,
  prev: StateReport | null,
  trigger: 'manual' | 'auto' = 'manual',
): StateReport {
  const now = new Date().toISOString()
  const missions = activeMissions(plan)
  const m = computeMetrics(missions)
  const donePct = m.missionsTotal ? Math.round((m.missionsDone / m.missionsTotal) * 100) : 0

  const doneMissions = missions.filter(isDone).map((mi) => {
    const subs = mi.subMissions ?? []
    return {
      id: mi.id,
      name: mi.name,
      completedAt: missionCompletedAt(mi),
      subDone: subs.filter((s) => s.status === 'done').length,
      subTotal: subs.length,
    }
  })

  const summary =
    `HotDroppZ má ${m.missionsTotal} misí. ` +
    `Dokončeno ${m.missionsDone} (${donePct} %), rozpracováno ${m.missionsActive}, čeká ${m.missionsTodo}. ` +
    `Sub-úkoly: splněno ${m.subMissionsDone} z ${m.subMissionsTotal} (${m.completionPct} %). ` +
    (m.subMissionsBlocked > 0
      ? `Pozor — ${m.subMissionsBlocked} sub-úkolů je blokovaných a drží postup.`
      : `Žádné blokované sub-úkoly, plán je průchozí.`)

  const bullets = [
    `Mise: ${m.missionsTotal} celkem — ${m.missionsDone} hotovo, ${m.missionsActive} běží, ${m.missionsTodo} čeká`,
    `Sub-úkoly: ${m.subMissionsDone} z ${m.subMissionsTotal} splněno (${m.completionPct} %)`,
    m.subMissionsBlocked > 0
      ? `Blokováno: ${m.subMissionsBlocked} sub-úkolů potřebuje zásah`
      : `Blokováno: nic`,
    `Dokončené mise v archivu: ${doneMissions.length}`,
  ]

  const recommendations: string[] = []
  if (m.subMissionsBlocked > 0)
    recommendations.push(`Odblokovat ${m.subMissionsBlocked} blokovaných sub-úkolů — bez toho se postup zastaví.`)
  if (m.missionsActive === 0 && m.missionsTodo > 0)
    recommendations.push(`Žádná mise teď neběží — vyber prioritní misi ze SPEC OPS a spusť ji.`)
  else if (m.missionsTodo > 0)
    recommendations.push(`Naplánovat / spustit dalších ${m.missionsTodo} čekajících misí.`)
  if (m.completionPct >= 80)
    recommendations.push(`Dokončenost je vysoká (${m.completionPct} %) — uzavřít hotové mise a spustit audit.`)
  if (recommendations.length === 0)
    recommendations.push(`Stav je stabilní — pokračovat podle běžícího plánu.`)

  const changesSincePrev: StateReportChange[] = []
  if (prev) {
    const pairs: [string, number, number][] = [
      ['Dokončené mise', prev.metrics.missionsDone, m.missionsDone],
      ['Rozpracované mise', prev.metrics.missionsActive, m.missionsActive],
      ['Splněné sub-úkoly', prev.metrics.subMissionsDone, m.subMissionsDone],
      ['Blokované sub-úkoly', prev.metrics.subMissionsBlocked, m.subMissionsBlocked],
      ['Celkem misí', prev.metrics.missionsTotal, m.missionsTotal],
    ]
    for (const [label, before, after] of pairs) {
      if (before !== after)
        changesSincePrev.push({ kind: 'changed', label, before: String(before), after: String(after) })
    }
    const prevDoneIds = new Set(prev.doneMissions.map((d) => d.id))
    for (const d of doneMissions) {
      if (!prevDoneIds.has(d.id))
        changesSincePrev.push({ kind: 'added', label: `Nově dokončená mise: ${d.name}` })
    }
    if (changesSincePrev.length === 0)
      changesSincePrev.push({ kind: 'changed', label: 'Beze změny od minulého updatu.' })
  }

  return {
    id: `rep-${now.replace(/[:.]/g, '-')}`,
    generatedAt: now,
    trigger,
    summary,
    bullets,
    recentActivity: recentActivity(missions),
    recommendations,
    metrics: m,
    doneMissions,
    changesSincePrev,
    prevReportId: prev?.id ?? null,
  }
}
