import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type {
  ScoutHqSummary,
  ScoutSystemConfig,
  Worker,
  WorkerCategory,
  WorkerRun,
} from '@/lib/scout/types'

const SEED_FILE = path.join(process.cwd(), 'public', 'seed', 'scout-workers.json')
const CATEGORIES: WorkerCategory[] = ['music', 'social', 'media', 'signals']

const DEFAULT_SYSTEM_CONFIG: ScoutSystemConfig = {
  autoScoutingEnabled: false,
  modeNote: 'DEV MODE — cron disabled. Use Run Scout to trigger workers manually.',
}

function readSeed(): {
  workers: Worker[]
  recentRuns: WorkerRun[]
  systemConfig: ScoutSystemConfig
} {
  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      workers: parsed.workers ?? [],
      recentRuns: parsed.recentRuns ?? [],
      systemConfig: { ...DEFAULT_SYSTEM_CONFIG, ...(parsed.systemConfig ?? {}) },
    }
  } catch {
    return { workers: [], recentRuns: [], systemConfig: DEFAULT_SYSTEM_CONFIG }
  }
}

export async function GET() {
  const { workers, recentRuns, systemConfig } = readSeed()

  const itemsToday = workers.reduce((s, w) => s + (w.kpi?.itemsToday ?? 0), 0)
  const errorsToday = workers.reduce((s, w) => s + (w.kpi?.errorsToday ?? 0), 0)
  const workersGreen = workers.filter((w) => w.health === 'green').length
  const workersAmber = workers.filter((w) => w.health === 'amber').length
  const workersRed = workers.filter((w) => w.health === 'red').length
  const workersAuthPending = workers.filter((w) => w.status === 'auth_pending').length

  const byCategory = Object.fromEntries(
    CATEGORIES.map((cat) => {
      const inCat = workers.filter((w) => w.category === cat)
      return [
        cat,
        {
          count: inCat.length,
          itemsToday: inCat.reduce((s, w) => s + (w.kpi?.itemsToday ?? 0), 0),
          healthy: inCat.filter((w) => w.health === 'green').length,
        },
      ]
    }),
  ) as ScoutHqSummary['byCategory']

  // YouTube quota (single-worker pool in REV 3)
  const ytWorker = workers.find((w) => w.platform === 'youtube' && w.quota)
  const ytQuota = ytWorker?.quota

  const summary: ScoutHqSummary = {
    workers,
    totals: {
      workersTotal: workers.length,
      workersGreen,
      workersAmber,
      workersRed,
      workersAuthPending,
      itemsToday,
      errorsToday,
    },
    byCategory,
    recentRuns: recentRuns.slice(0, 12),
    ytQuota,
    systemConfig,
  }

  return NextResponse.json(summary)
}
