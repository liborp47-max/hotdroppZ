// scripts/hdua-mission-status.mjs
// Update an HDUA mission's status + lifecycle + append an audit-log entry, and
// optionally flip a sub-mission's status. Keeps NOTES/plan.json the system of record.
//
// Usage:
//   node scripts/hdua-mission-status.mjs <missionId> <status> [lifecycleStatus] [note]
//   node scripts/hdua-mission-status.mjs <missionId> --sub <subId> <subStatus>
// status: todo|in_progress|blocked|done|solved   lifecycle: PLAN|...|MISSION_DONE

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.resolve(__dirname, '..', 'NOTES', 'plan.json')
const NOW = new Date().toISOString()

const [, , missionId, a, b, c] = process.argv
if (!missionId) {
  console.error('missing missionId')
  process.exit(1)
}

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const m = plan.missions.find((x) => x.id === missionId)
if (!m) {
  console.error('mission not found:', missionId)
  process.exit(1)
}

if (a === '--sub') {
  const sub = (m.subMissions || []).find((sm) => sm.id === b)
  if (!sub) {
    console.error('sub not found:', b)
    process.exit(1)
  }
  sub.status = c
  if (c === 'done') sub.completedAt = NOW
  console.log(`${missionId} sub ${b} -> ${c}`)
} else {
  m.status = a
  if (b) m.lifecycleStatus = b
  m.auditLog = m.auditLog || []
  m.auditLog.push({ ts: NOW, event: 'MISSION_STATUS', actor: 'claude-code', note: c || `status=${a}${b ? ` lifecycle=${b}` : ''}` })
  if (a === 'done' || a === 'solved') m.completedAt = NOW
  console.log(`${missionId} -> status=${a}${b ? ` lifecycle=${b}` : ''}`)
}

plan.updatedAt = NOW
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2))
