import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Worker, WorkerPlatform, WorkerRun, WorkerSource } from '@/lib/scout/types'

const SEED_FILE = path.join(process.cwd(), 'public', 'seed', 'scout-workers.json')

function readSeed() {
  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf-8')
    return JSON.parse(raw) as { workers: Worker[]; sources: WorkerSource[]; recentRuns: WorkerRun[] }
  } catch {
    return { workers: [], sources: [], recentRuns: [] }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params
  const platformKey = platform.replace(/-/g, '_') as WorkerPlatform
  const seed = readSeed()
  const worker = seed.workers.find((w) => w.platform === platformKey)
  if (!worker) return NextResponse.json({ error: `Worker '${platform}' not found` }, { status: 404 })

  const sources = seed.sources.filter((s) => s.workerId === worker.id)
  const runs = seed.recentRuns.filter((r) => r.workerId === worker.id).slice(0, 50)

  return NextResponse.json({ worker, sources, runs })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params
  const body = (await request.json()) as { enabled?: boolean }
  // Mock — would persist to DB in PR-1. Return optimistic OK.
  return NextResponse.json({
    ok: true,
    platform,
    appliedPatch: body,
    note: 'Mock endpoint — real DB write lands in PR-1 (workers table).',
  })
}
