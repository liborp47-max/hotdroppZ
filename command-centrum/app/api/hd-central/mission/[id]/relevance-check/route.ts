import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Mission, Plan } from '@/lib/hd-central/types'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

export type RelevanceVerdict = 'proceed' | 'review' | 'archive'

export interface RelevanceCheckResult {
  missionId: string
  verdict: RelevanceVerdict
  score: number              // 0-100, lower = less relevant
  checkedAt: string
  reasons: string[]
  warnings: string[]
  recommendations: string[]
}

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return null
  }
}

function ageInDays(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 86_400_000
}

/**
 * Pre-execution relevance check.
 *
 * Fast deterministic rules (< 100ms). Real AI check (PR-2 backend) bude volat
 * Claude Haiku s mission context + recent audits + active missions; pro PR-5 mock
 * stačí pravidla podle deterministických signálů.
 *
 * Rules:
 *  1. Mission > 30d old without progress       → review (stale)
 *  2. Sub-missions all done                     → archive (already complete)
 *  3. Duplicate moduleId with another active   → review (potential dup)
 *  4. Has explicit `archived` or `superseded`  → archive
 *  5. Module path references stale paths       → review
 *  6. Blocker references unresolved deps       → review
 *  7. ACTIVE mission contradicts recent audit  → review (manual decide)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const mission = plan.missions.find((m) => m.id === id)
    if (!mission) {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    const reasons: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []
    let score = 100

    // Rule 1: stale
    const created = ageInDays(mission.createdAt)
    if (created !== null && created > 30) {
      score -= 25
      warnings.push(`Mise je stará ${Math.round(created)} dní bez progressu.`)
      recommendations.push('Zkontroluj relevanci vs recent audit decisions.')
    }

    // Rule 2: sub-missions all done
    const subs = mission.subMissions ?? []
    if (subs.length > 0) {
      const doneSubs = subs.filter((s) => 'status' in s && (s as { status?: string }).status === 'done').length
      const pct = (doneSubs / subs.length) * 100
      if (pct === 100) {
        score = 10
        warnings.push(`Všech ${subs.length} sub-misí je hotových — mise by měla být označená jako MISSION_DONE.`)
        recommendations.push('Mark mission as MISSION_DONE manually nebo spusť Solve s reportShown=true.')
      } else if (pct >= 80) {
        score -= 10
        reasons.push(`${doneSubs}/${subs.length} sub-misí hotovo (${Math.round(pct)} %).`)
      }
    }

    // Rule 3: duplicate moduleId
    const dupModuleId = plan.missions.filter(
      (m) =>
        m.id !== mission.id &&
        !m.isDeleted &&
        m.moduleId &&
        m.moduleId === mission.moduleId,
    )
    if (dupModuleId.length > 0) {
      score -= 15
      warnings.push(
        `Detekováno ${dupModuleId.length} dalších misí se stejným moduleId: ${dupModuleId
          .map((m) => m.id)
          .join(', ')}.`,
      )
      recommendations.push('Zvaž merge nebo archiv jedné z duplikátních misí.')
    }

    // Rule 4: explicit archived flag
    const auditLog = mission.auditLog ?? []
    const hasArchiveEvent = auditLog.some(
      (e) => e.event === 'RETURNED_TO_COLD_CASE' || e.event === 'MISSION_DELETED',
    )
    if (mission.coldCase) {
      score -= 30
      warnings.push('Mise je v Cold Case — předtím odsunuta.')
      recommendations.push('Ověř že důvody pro Cold Case stále platí.')
    }
    if (hasArchiveEvent) {
      reasons.push('Audit log obsahuje archive/cold-case event.')
    }

    // Rule 5: stale module paths
    if (mission.modulePath) {
      const stalePaths = ['scout-hq/overview', 'scout-hq/droppz', 'scout-hq/feed']
      if (stalePaths.some((p) => mission.modulePath?.includes(p))) {
        score -= 15
        warnings.push('Mission path odkazuje na legacy scout-hq routes (overview/droppz/feed) — superseded by REV 3.')
        recommendations.push('Update modulePath na nový scout-hq layout (workers/[platform]).')
      }
      if (mission.modulePath.includes('genius') && mission.moduleId !== 'GENIUS') {
        // Genius worker odstraněn v REV 3 free-sources decision
        if (mission.moduleId === 'GENIUS_WORKER') {
          score -= 40
          warnings.push('Genius worker byl removed v REV 3 free-sources decision (2026-05-16).')
          recommendations.push('Archive — Genius dnes spadá pod Charts aggregator + Magazines worker.')
        }
      }
    }

    // Rule 6: explicit blockedBy / unresolved deps
    const blockedBy = (mission as Mission & { blockedBy?: string[] }).blockedBy ?? []
    if (blockedBy.length > 0) {
      const unresolved = blockedBy.filter((depId) => {
        const dep = plan.missions.find((m) => m.id === depId)
        return !dep || dep.status !== 'solved'
      })
      if (unresolved.length > 0) {
        score -= 20
        warnings.push(`${unresolved.length} blocker mise nejsou vyřešené: ${unresolved.join(', ')}.`)
        recommendations.push('Vyřeš blockery dříve než spustíš tuto misi.')
      }
    }

    // Rule 7: priority sanity
    if (mission.priority === 'P0' && created !== null && created > 7) {
      score -= 10
      warnings.push('P0 mise stará > 7 dní — pravděpodobně překrytá novými prioritami.')
    }

    // Rule 8: decision contradiction scan
    // VYPNUTÉ zdroje + dropped patterns from 06-decision-free-sources.md (Scout REV 3)
    const droppedKeywords: Array<{ keyword: string; reason: string }> = [
      { keyword: 'Instagram', reason: 'Instagram Worker je auth_pending (Meta Business approval čeká).' },
      { keyword: 'TikTok', reason: 'TikTok Worker je auth_pending (TikTok Business approval čeká).' },
      { keyword: 'Twitter', reason: 'Twitter/X API zrušeno v REV 3 (paid tier > $100/měs).' },
      { keyword: 'X API', reason: 'X (Twitter) API zrušeno v REV 3.' },
      { keyword: 'Billboard', reason: 'Billboard partnership zrušen (free Charts aggregator místo toho).' },
      { keyword: 'web scraping', reason: 'Web scraping zrušen v REV 3 (ToS + 403/429 risk).' },
      { keyword: 'scrape', reason: 'Scraping zrušen v REV 3.' },
    ]
    const textToScan = `${mission.name} ${mission.purpose ?? ''} ${mission.description ?? ''} ${
      mission.importantInfo ?? ''
    }`.toLowerCase()
    const droppedHits = droppedKeywords.filter((d) => textToScan.includes(d.keyword.toLowerCase()))
    if (droppedHits.length > 0) {
      score -= 35 * droppedHits.length
      droppedHits.forEach((d) =>
        warnings.push(`Decision contradiction: "${d.keyword}" — ${d.reason}`),
      )
      recommendations.push('Archive nebo přepiš scope, aby respektoval recent decision records.')
    }

    // Rule 9: empty auto-generated package detection
    const hasFileTaskPattern = /FILE-[a-f0-9-]+-TASK/i.test(mission.description ?? '')
    if (hasFileTaskPattern && subs.length === 0) {
      score = Math.min(score, 20)
      warnings.push('Auto-generated package shell (FILE-TASK reference) bez submissions — pravděpodobně noise.')
      recommendations.push('Delete pokud žádný actionable scope.')
    }

    // Final verdict
    const verdict: RelevanceVerdict =
      score >= 70 ? 'proceed' : score >= 30 ? 'review' : 'archive'

    if (verdict === 'proceed') {
      reasons.push('Všechny kontroly OK, mise je relevantní — bezpečně spustit.')
    } else if (verdict === 'review') {
      reasons.push('Mise vyžaduje review před spuštěním — viz warnings.')
    } else {
      reasons.push('Mise by měla být archivována nebo nahrazena — viz warnings.')
    }

    const result: RelevanceCheckResult = {
      missionId: mission.id,
      verdict,
      score: Math.max(0, Math.min(100, score)),
      checkedAt: new Date().toISOString(),
      reasons,
      warnings,
      recommendations,
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[mission/relevance-check] error:', e)
    return NextResponse.json({ error: 'Failed to run relevance check' }, { status: 500 })
  }
}
