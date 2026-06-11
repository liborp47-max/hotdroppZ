import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Worker, WorkerRun } from '@/lib/scout/types'

const SEED_FILE = path.join(process.cwd(), 'public', 'seed', 'scout-workers.json')

/**
 * POST /api/scout-hq/run-all
 * Body: { onlyEnabled?: boolean }  // default true
 *
 * Mock for PR-5 — fakes a "Run Scout" trigger across all enabled workers.
 * Returns a run-batch ID + list of triggered worker IDs.
 *
 * Real impl (PR-2) will enqueue worker jobs into the worker queue (lib/scout/core/orchestrator.ts).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { onlyEnabled?: boolean }
    const onlyEnabled = body.onlyEnabled !== false

    const raw = fs.readFileSync(SEED_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as { workers: Worker[]; recentRuns: WorkerRun[] }

    const targets = (parsed.workers ?? []).filter((w) =>
      onlyEnabled ? w.enabled && w.status !== 'auth_pending' : w.status !== 'auth_pending',
    )

    const now = new Date().toISOString()
    const batchId = `batch-${Date.now().toString(36)}`

    return NextResponse.json({
      ok: true,
      batchId,
      triggeredAt: now,
      triggeredWorkers: targets.map((w) => ({
        id: w.id,
        platform: w.platform,
        name: w.name,
      })),
      triggeredCount: targets.length,
      skippedCount: parsed.workers.length - targets.length,
      note: 'Mock — orchestrator wiring lands in PR-2. UI will show simulated progress.',
    })
  } catch (e) {
    console.error('[scout-hq/run-all] error:', e)
    return NextResponse.json({ error: 'Failed to trigger run-all' }, { status: 500 })
  }
}
