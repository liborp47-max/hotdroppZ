import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import type { Mission } from '@/lib/hd-central/types'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'
import { auditMissions, renderMissionAuditReport } from '@/lib/hd-central/mission-auditor'

export const runtime = 'nodejs'
export const maxDuration = 60

// SYSTEM/INFO/AUDITS — command-centrum/../../INFO/AUDITS (same anchor as audit-files route).
const MISSION_AUDIT_ROOT = path.resolve(
  process.cwd(),
  '..',
  '..',
  'INFO',
  'AUDITS',
  'MISSION_RELEVANCE_AUDIT',
)

const OFFSET_TAIL = 1000 // Missions outside the recommended queue land beyond this index.

const AuditBodySchema = z
  .object({
    /** When true, persist the recommended order back onto plan.missions[].sequenceIndex. */
    apply: z.boolean().optional(),
  })
  .partial()

function stamp(d: Date): { date: string; time: string } {
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 19).replace(/:/g, '') }
}

/** Best-effort INDEX.md append so the audit corpus scanner picks the new file up. */
function appendIndex(relPath: string, auditId: string): void {
  try {
    const indexPath = path.join(MISSION_AUDIT_ROOT, '..', 'INDEX.md')
    const line = `- [${auditId}](${relPath}) — MISSION_RELEVANCE_AUDIT (auto)\n`
    fs.appendFileSync(indexPath, line, 'utf-8')
  } catch (e) {
    logger.warn('[missions/audit] INDEX append failed', { error: (e as Error).message })
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is allowed (defaults to a dry run that still writes the report).
  }
  const parsed = AuditBodySchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_body', message: 'apply must be boolean', details: parsed.error.issues } },
      { status: 400 },
    )
  }
  const apply = parsed.data.apply ?? false

  const plan = readPlan()
  if (!plan) {
    return NextResponse.json(
      { error: { code: 'plan_unavailable', message: 'plan.json not loaded' } },
      { status: 500 },
    )
  }

  const result = auditMissions(plan.missions)

  // ── write report (markdown + json sidecar) ─────────────────────────────────
  const now = new Date(result.generatedAt)
  const { date, time } = stamp(now)
  const auditId = `AUD-${date.replace(/-/g, '')}-${time}-MISSIONS`
  const dir = path.join(MISSION_AUDIT_ROOT, date)
  const baseName = `auto-mission-audit-${date}-${time}`
  let reportPath: string | null = null
  try {
    fs.mkdirSync(dir, { recursive: true })
    const md = renderMissionAuditReport(result, { auditId, ownerAgent: user.email ?? 'mission-auditor' })
    fs.writeFileSync(path.join(dir, `${baseName}.md`), md, 'utf-8')
    fs.writeFileSync(path.join(dir, `${baseName}.json`), JSON.stringify(result, null, 2), 'utf-8')
    reportPath = `SYSTEM/INFO/AUDITS/MISSION_RELEVANCE_AUDIT/${date}/${baseName}.md`
    appendIndex(`MISSION_RELEVANCE_AUDIT/${date}/${baseName}.md`, auditId)
  } catch (e) {
    logger.error('[missions/audit] report write failed', e)
    return NextResponse.json(
      { error: { code: 'report_write_failed', message: 'Failed to persist audit report' } },
      { status: 500 },
    )
  }

  // ── optionally re-queue missions into the recommended order ────────────────
  let applied = false
  if (apply && result.recommendedOrder.length > 0) {
    const orderIndex = new Map(result.recommendedOrder.map((id, i) => [id, i]))
    try {
      await mutatePlan((current) => {
        let tailCursor = OFFSET_TAIL
        current.missions = current.missions.map((m): Mission => {
          if (orderIndex.has(m.id)) {
            return {
              ...m,
              sequenceIndex: orderIndex.get(m.id)!,
              sequencedAt: now.toISOString(),
              sequencedBy: 'mission-auditor',
            }
          }
          const existing = typeof m.sequenceIndex === 'number' ? m.sequenceIndex : tailCursor++
          return { ...m, sequenceIndex: existing < OFFSET_TAIL ? existing + OFFSET_TAIL : existing }
        })
      })
      applied = true
    } catch (e) {
      if (e instanceof PlanMissingError) {
        return NextResponse.json(
          { error: { code: 'plan_unavailable', message: 'plan.json not loaded' } },
          { status: 500 },
        )
      }
      logger.error('[missions/audit] re-queue write failed', e)
      return NextResponse.json(
        { error: { code: 'write_failed', message: 'Audit written but re-queue failed' }, reportPath },
        { status: 500 },
      )
    }
  }

  logger.info('hd_central_missions_audited', {
    actor: user.email ?? user.id,
    total: result.totalMissions,
    active: result.activeCount,
    counts: result.counts,
    applied,
  })

  return NextResponse.json({
    ok: true,
    applied,
    reportPath,
    generatedAt: result.generatedAt,
    totalMissions: result.totalMissions,
    activeCount: result.activeCount,
    counts: result.counts,
    recommendedOrder: result.recommendedOrder,
    entries: result.entries,
  })
}
