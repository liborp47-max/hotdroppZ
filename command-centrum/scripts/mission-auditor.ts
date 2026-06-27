/**
 * Mission Auditor — headless worker.
 *
 * CLI sibling of POST /api/hd-central/missions/audit. Runs the same
 * `auditMissions` engine over the live plan, writes a MISSION_RELEVANCE_AUDIT
 * report, and (with --apply) re-queues active missions into the recommended
 * technical order by rewriting plan.missions[].sequenceIndex.
 *
 * Usage (from command-centrum/):
 *   npm run audit:missions            # dry run — writes report only
 *   npm run audit:missions -- --apply # also persist the new queue order
 *
 * Single source of truth: lib/hd-central/mission-auditor.ts (shared with the route).
 */
import fs from 'fs'
import path from 'path'
import { readPlan, writePlanAtomic } from '../lib/hd-central/plan-store.ts'
import { auditMissions, renderMissionAuditReport } from '../lib/hd-central/mission-auditor.ts'
import type { Mission } from '../lib/hd-central/types.ts'

const OFFSET_TAIL = 1000

const apply = process.argv.includes('--apply')

function fail(msg: string): never {
  console.error(`[mission-auditor] ${msg}`)
  process.exit(1)
}

const plan = readPlan()
if (!plan) fail('plan.json not found / unparseable')

const result = auditMissions(plan.missions)
const now = new Date(result.generatedAt)
const date = now.toISOString().slice(0, 10)
const time = now.toISOString().slice(11, 19).replace(/:/g, '')
const auditId = `AUD-${date.replace(/-/g, '')}-${time}-MISSIONS`

const reportRoot = path.resolve(
  process.cwd(),
  '..',
  '..',
  'INFO',
  'AUDITS',
  'MISSION_RELEVANCE_AUDIT',
  date,
)
fs.mkdirSync(reportRoot, { recursive: true })
const baseName = `auto-mission-audit-${date}-${time}`
const md = renderMissionAuditReport(result, { auditId, ownerAgent: 'mission-auditor (worker)' })
fs.writeFileSync(path.join(reportRoot, `${baseName}.md`), md, 'utf-8')
fs.writeFileSync(path.join(reportRoot, `${baseName}.json`), JSON.stringify(result, null, 2), 'utf-8')

// Best-effort INDEX append.
try {
  const indexPath = path.resolve(process.cwd(), '..', '..', 'INFO', 'AUDITS', 'INDEX.md')
  fs.appendFileSync(
    indexPath,
    `- [${auditId}](MISSION_RELEVANCE_AUDIT/${date}/${baseName}.md) — MISSION_RELEVANCE_AUDIT (worker)\n`,
    'utf-8',
  )
} catch {
  // non-fatal
}

let applied = false
if (apply && result.recommendedOrder.length > 0) {
  const orderIndex = new Map(result.recommendedOrder.map((id, i) => [id, i]))
  let tailCursor = OFFSET_TAIL
  plan.missions = plan.missions.map((m): Mission => {
    if (orderIndex.has(m.id)) {
      return {
        ...m,
        sequenceIndex: orderIndex.get(m.id)!,
        sequencedAt: now.toISOString(),
        sequencedBy: 'mission-auditor (worker)',
      }
    }
    const existing = typeof m.sequenceIndex === 'number' ? m.sequenceIndex : tailCursor++
    return { ...m, sequenceIndex: existing < OFFSET_TAIL ? existing + OFFSET_TAIL : existing }
  })
  plan.version = (plan.version ?? 0) + 1
  plan.updatedAt = now.toISOString()
  writePlanAtomic(plan)
  applied = true
}

const c = result.counts
console.log(`[mission-auditor] ${result.totalMissions} missions · ${result.activeCount} active`)
console.log(
  `[mission-auditor] KEEP ${c.KEEP} UPDATE ${c.UPDATE} MERGE ${c.MERGE} PAUSE ${c.PAUSE} ` +
    `ARCHIVE ${c.ARCHIVE} DONE ${c.DONE} DELETE ${c.DELETE}`,
)
console.log(`[mission-auditor] report → SYSTEM/INFO/AUDITS/MISSION_RELEVANCE_AUDIT/${date}/${baseName}.md`)
console.log(`[mission-auditor] re-queue ${applied ? 'APPLIED' : 'skipped (dry run; pass --apply)'}`)
