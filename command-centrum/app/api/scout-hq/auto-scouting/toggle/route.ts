import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { ScoutSystemConfig } from '@/lib/scout/types'

const SEED_FILE = path.join(process.cwd(), 'public', 'seed', 'scout-workers.json')

/**
 * POST /api/scout-hq/auto-scouting/toggle
 * Body: { enabled: boolean, modeNote?: string }
 *
 * Mock for PR-5 — flips the autoScoutingEnabled flag in the seed JSON.
 * Real impl (PR-2/6) will persist into `workers` table / system_config table
 * and actually enable/disable Vercel Cron jobs.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { enabled?: boolean; modeNote?: string }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    const raw = fs.readFileSync(SEED_FILE, 'utf-8')
    const parsed = JSON.parse(raw)

    const newConfig: ScoutSystemConfig = {
      autoScoutingEnabled: body.enabled,
      autoScoutingChangedAt: new Date().toISOString(),
      modeNote:
        body.modeNote ??
        (body.enabled
          ? 'AUTO MODE — cron schedule active.'
          : 'DEV MODE — cron disabled. Use Run Scout to trigger workers manually.'),
    }

    parsed.systemConfig = newConfig
    fs.writeFileSync(SEED_FILE, JSON.stringify(parsed, null, 2), 'utf-8')

    return NextResponse.json({ ok: true, systemConfig: newConfig })
  } catch (e) {
    console.error('[scout-hq/auto-scouting/toggle] error:', e)
    return NextResponse.json({ error: 'Failed to toggle auto-scouting' }, { status: 500 })
  }
}
