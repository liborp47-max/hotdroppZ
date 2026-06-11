#!/usr/bin/env node
// Bulk-verify all SPEC OPS (user) missions in NOTES/plan.json:
//  - all sub-missions done  → mission → MISSION_DONE (moves to DONE tab)
//  - some incomplete        → parent closed, +1 follow-up spawned (amber)
// Mirrors lib/hd-central/lifecycle.ts → verifyAndCompleteMission, but standalone
// so it can run without the Next.js dev server.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLAN_FILE = path.join(__dirname, '..', 'NOTES', 'plan.json')

const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'))
const now = () => new Date().toISOString()

// A parent may spawn at most ONE +1 follow-up; an un-worked follow-up must never
// be auto-forwarded into an endless +N chain. Mirrors lib/hd-central/lifecycle.ts.
const MAX_FOLLOWUP_LEVEL = 1

function nextFollowUpId(plan, parentId) {
  const existing = new Set(plan.missions.map((m) => m.id))
  const base = `${parentId}+1`
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${parentId}+${n}`)) n++
  return `${parentId}+${n}`
}

function buildFollowUp(parent, incomplete, plan) {
  const id = nextFollowUpId(plan, parent.id)
  const level = (parent.followUpLevel ?? 0) + 1
  const reason =
    `Parent ${parent.id} mělo ${incomplete.length} nedokončených kroků při DONE verifikaci. ` +
    `Tato +${level} mise je seskupuje pro dotažení.`
  const ts = now()
  return {
    ...parent,
    id,
    name: `+${level} ${parent.name}`,
    description: `Follow-up po DONE verifikaci ${parent.id}. ${reason}`,
    rationale: reason,
    status: 'todo',
    lifecycleStatus: 'PLAN',
    createdAt: ts,
    subMissions: incomplete.map((s) => ({ ...s, status: 'todo', completedAt: undefined })),
    auditReport: undefined,
    auditReports: [],
    auditLog: [
      {
        ts,
        event: 'MISSION_ACTIVATED',
        actor: 'SYSTEM',
        note: `Spawned as follow-up of ${parent.id} — ${incomplete.length} unfinished steps`,
      },
    ],
    timelineLog: undefined,
    isDeleted: false,
    deletedAt: undefined,
    isFollowUp: true,
    followUpOf: parent.id,
    followUpReason: reason,
    followUpLevel: level,
    userMission: parent.userMission,
    inTimeline: false,
    sequenceIndex: undefined,
    sequencedAt: undefined,
    sequencedBy: undefined,
    coldCase: false,
  }
}

function closeMission(mission, note) {
  return {
    ...mission,
    lifecycleStatus: 'MISSION_DONE',
    status: 'solved',
    auditLog: [
      ...(mission.auditLog ?? []),
      { ts: now(), event: 'MISSION_DONE', actor: 'SYSTEM', note },
    ],
  }
}

// Park a mission for human review instead of laundering it into MISSION_DONE +
// another +N follow-up.
function parkMission(mission, note) {
  return {
    ...mission,
    lifecycleStatus: 'AUDIT_PENDING',
    status: 'in_progress',
    auditLog: [
      ...(mission.auditLog ?? []),
      { ts: now(), event: 'AUDIT_PENDING', actor: 'SYSTEM', note },
    ],
  }
}

const eligible = plan.missions.filter(
  (m) =>
    !m.isDeleted &&
    m.userMission === true &&
    m.lifecycleStatus !== 'MISSION_DONE',
)

const report = { scanned: eligible.length, completed: [], followUps: [], parked: [], noops: [] }
const newMissions = [...plan.missions]

for (const m of eligible) {
  const subs = m.subMissions ?? []
  const incomplete = subs.filter((s) => (s.status ?? 'todo') !== 'done')

  // Find current index in newMissions
  const idx = newMissions.findIndex((x) => x.id === m.id)
  if (idx === -1) continue

  if (subs.length === 0) {
    newMissions[idx] = closeMission(m, 'Bulk DONE — atomic mission, no sub-missions')
    report.completed.push(m.id)
  } else if (incomplete.length === 0) {
    newMissions[idx] = closeMission(m, `Bulk DONE — all ${subs.length} steps done`)
    report.completed.push(m.id)
  } else if (m.isFollowUp && incomplete.length === subs.length) {
    // Guard 1: un-worked follow-up — do not launder to DONE or spawn next +N.
    newMissions[idx] = parkMission(
      m,
      `Parked — follow-up ${m.id} has 0/${subs.length} steps executed; needs real execution, not another +N.`,
    )
    report.parked.push(m.id)
  } else if (((m.followUpLevel ?? 0) + 1) > MAX_FOLLOWUP_LEVEL) {
    // Guard 2: follow-up depth cap reached — park for human review.
    newMissions[idx] = parkMission(
      m,
      `Parked — follow-up depth cap (${MAX_FOLLOWUP_LEVEL}) reached; ${incomplete.length} steps need human review.`,
    )
    report.parked.push(m.id)
  } else {
    // close parent, spawn exactly one +1
    const planSnap = { ...plan, missions: newMissions }
    const followUp = buildFollowUp(m, incomplete, planSnap)
    newMissions[idx] = closeMission(
      m,
      `Bulk DONE — ${incomplete.length}/${subs.length} steps unfinished, forwarded to ${followUp.id}`,
    )
    newMissions.push(followUp)
    report.followUps.push({ parent: m.id, child: followUp.id, unfinished: incomplete.length })
  }
}

const out = { ...plan, missions: newMissions, updatedAt: now() }
fs.writeFileSync(PLAN_FILE, JSON.stringify(out, null, 2), 'utf-8')

console.log(JSON.stringify(
  {
    scanned: report.scanned,
    completed: report.completed.length,
    followUps: report.followUps.length,
    parked: report.parked.length,
    totalMissionsAfter: out.missions.length,
    completedIds: report.completed,
    followUpDetail: report.followUps,
    parkedIds: report.parked,
  },
  null,
  2,
))
