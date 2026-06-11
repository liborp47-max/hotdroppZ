import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { generateStateReport } from '@/lib/hd-central/state-report'
import type { Plan, StateReport } from '@/lib/hd-central/types'

// HD Analytics — state reports. UPDATE generates a fresh plain-language
// snapshot of HotDroppZ and persists it to SYSTEM/INFO/ANALYTICS so other
// tools / processes / agents can read it.

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')
const REPORT_DIR = path.join(process.cwd(), '..', '..', 'INFO', 'ANALYTICS')
const MAX_REPORTS = 100

function readPlan(): Plan {
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
}

function readReports(): StateReport[] {
  if (!fs.existsSync(REPORT_DIR)) return []
  const out: StateReport[] = []
  for (const f of fs.readdirSync(REPORT_DIR)) {
    if (!f.startsWith('report-') || !f.endsWith('.json')) continue
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(REPORT_DIR, f), 'utf-8')) as StateReport)
    } catch {
      // skip corrupt file
    }
  }
  return out.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
}

function writeReport(report: StateReport) {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })
  const safe = report.id.replace(/[^A-Za-z0-9_-]/g, '')
  fs.writeFileSync(
    path.join(REPORT_DIR, `report-${safe}.json`),
    JSON.stringify(report, null, 2),
    'utf-8',
  )
  const files = fs
    .readdirSync(REPORT_DIR)
    .filter((f) => f.startsWith('report-') && f.endsWith('.json'))
    .sort()
  if (files.length > MAX_REPORTS) {
    for (const f of files.slice(0, files.length - MAX_REPORTS)) {
      try {
        fs.unlinkSync(path.join(REPORT_DIR, f))
      } catch {
        // ignore
      }
    }
  }
}

// GET — list all reports (newest first) + the latest.
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const reports = readReports()
    return NextResponse.json({ reports, latest: reports[0] ?? null })
  } catch (e) {
    console.error('[analytics] GET error:', e)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}

// POST — run UPDATE: generate a fresh state report, persist it, return it.
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json().catch(() => ({}))) as { trigger?: 'manual' | 'auto' }
    const trigger = body.trigger === 'auto' ? 'auto' : 'manual'
    const prev = readReports()[0] ?? null
    const report = generateStateReport(readPlan(), prev, trigger)
    writeReport(report)
    return NextResponse.json({ report })
  } catch (e) {
    console.error('[analytics] POST error:', e)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
