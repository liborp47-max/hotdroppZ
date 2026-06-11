import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

type CheckStatus = 'ok' | 'warn' | 'error'

type CheckItem = {
  key: 'sources' | 'scout_hq' | 'cluster'
  label: string
  href: string
  ui: CheckStatus
  api: CheckStatus
  note: string
}

function exists(p: string) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function readJsonIfExists(p: string): { ok: boolean; error?: string } {
  if (!exists(p)) return { ok: false, error: 'file-not-found' }
  try {
    JSON.parse(fs.readFileSync(p, 'utf-8'))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'invalid-json' }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const strict = url.searchParams.get('strict') === '1'

  const appRoot = process.cwd()
  const repoRoot = path.resolve(appRoot, '..')
  const aiRoot = path.join(repoRoot, 'ai')

  const sourcesPage = path.join(appRoot, 'app', '(dashboard)', 'sources', 'page.tsx')
  const scoutOverviewPage = path.join(appRoot, 'app', '(dashboard)', 'scout-hq', 'overview', 'page.tsx')
  const clusterPage = path.join(appRoot, 'app', '(dashboard)', 'cluster', 'page.tsx')
  const clusterApiRoute = path.join(appRoot, 'app', 'api', 'cluster', 'pool', 'route.ts')
  const clusterRunner = path.join(aiRoot, 'scout_hq', 'run_cluster_pipeline.py')
  const clusterResults =
    process.env.CLUSTER_RESULTS_PATH ?? path.join(aiRoot, 'scout_hq', 'cluster_results.json')

  const resultsJson = readJsonIfExists(clusterResults)

  const checks: CheckItem[] = [
    {
      key: 'sources',
      label: 'Sources',
      href: '/sources',
      ui: exists(sourcesPage) ? 'ok' : 'error',
      api: 'warn',
      note: exists(sourcesPage) ? 'UI route file exists' : 'Missing UI route file',
    },
    {
      key: 'scout_hq',
      label: 'SCOUT HQ',
      href: '/scout-hq/overview',
      ui: exists(scoutOverviewPage) ? 'ok' : 'error',
      api: 'warn',
      note: exists(scoutOverviewPage) ? 'UI route file exists' : 'Missing UI route file',
    },
    {
      key: 'cluster',
      label: 'Cluster',
      href: '/cluster',
      ui: exists(clusterPage) ? 'ok' : 'error',
      api: exists(clusterApiRoute) && exists(clusterRunner) ? 'ok' : 'error',
      note: exists(clusterApiRoute) && exists(clusterRunner)
        ? 'Cluster UI + Python bridge are configured'
        : 'Cluster UI/API integration incomplete',
    },
  ]

  const allStates = checks.flatMap((c) => [c.ui, c.api])
  const hasError = allStates.includes('error')
  const hasWarn = allStates.includes('warn')
  const status: 'ok' | 'degraded' | 'error' = hasError ? 'error' : hasWarn ? 'degraded' : 'ok'

  const payload = {
    status,
    strict,
    timestamp: new Date().toISOString(),
    core_elements: checks,
    legacy: {
      preserved: true,
      note: 'Legacy pipeline steps are intentionally kept for later use or rebuild',
    },
    filesystem: {
      cluster_results_file: clusterResults,
      cluster_results_valid_json: resultsJson.ok,
      cluster_results_error: resultsJson.ok ? null : resultsJson.error,
    },
    summary: {
      total_checks: allStates.length,
      ok: allStates.filter((s) => s === 'ok').length,
      warn: allStates.filter((s) => s === 'warn').length,
      error: allStates.filter((s) => s === 'error').length,
    },
  }

  if (strict && status !== 'ok') {
    return NextResponse.json(payload, { status: 503 })
  }

  return NextResponse.json(payload)
}
