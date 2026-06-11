import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { runArtistIntelBulk, runArtistIntelForArtist } from '@/lib/services/artist-intel-agent'
import type { ArtistIntelAgentConfig } from '@/lib/services/artist-intel-agent'
import {
  finishArtistIntelRun,
  getArtistIntelRun,
  startArtistIntelRun,
  updateArtistIntelRun,
} from '@/lib/services/artist-intel-progress'

const SINGLE_REQUEST_TIMEOUT_MS = 90_000

type BulkRunState = {
  stopRequested: boolean
  startedAt: number
}

const BULK_RUNS = new Map<string, BulkRunState>()
const BULK_RUN_TTL_MS = 10 * 60 * 1000

function cleanupBulkRuns() {
  const now = Date.now()
  for (const [runId, state] of BULK_RUNS.entries()) {
    if (now - state.startedAt > BULK_RUN_TTL_MS) {
      BULK_RUNS.delete(runId)
    }
  }
}

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')
  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  }

  const run = getArtistIntelRun(runId)
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  return NextResponse.json(run)
}

// ─── POST /api/artist/enrich ──────────────────────────────────────────────────
// Body: { artistId: string }          → enrich single artist
// Body: { bulk: true, limit?: number, mode?: 'full' | 'missing' | 'update' } → get intel in bulk

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  const body = await req.json().catch(() => ({})) as {
    artistId?: string
    bulk?: boolean
    limit?: number
    mode?: 'full' | 'missing' | 'update'
    runId?: string
    stop?: boolean
    refreshGallery?: boolean
    agentConfig?: Partial<ArtistIntelAgentConfig> | null
  }

  // ── Single artist ────────────────────────────────────────────────────────────
  if (body.artistId) {
    const runId = body.runId ?? crypto.randomUUID()
    startArtistIntelRun({
      runId,
      mode: 'single',
      total: 1,
      artistName: null,
      currentStep: 'Starting single Get Intel run...',
      sourcesUsed: [],
      completedActions: [],
      updatedFields: [],
      confidence: null,
    })

    const timeoutResult = {
      id: body.artistId,
      name: 'unknown',
      processed: false,
      updated: false,
      updated_fields: [],
      sources: [],
      confidence: 0,
      error: `Single get-intel timeout (${SINGLE_REQUEST_TIMEOUT_MS}ms)`,
    }

    const result = await Promise.race([
      runArtistIntelForArtist(db, body.artistId, body.mode ?? 'full', {
        refreshGallery: body.refreshGallery === true,
        config: body.agentConfig ?? null,
        onProgress: ({ artistName, currentStep, sourcesUsed, findings, completedActions, updatedFields, confidence }) => {
          updateArtistIntelRun(runId, {
            artistName: artistName ?? null,
            currentStep,
            processed: 0,
            total: 1,
            sourcesUsed: sourcesUsed ?? [],
            findings: findings
              ? findings.map((item) => ({ ...item, timestamp: Date.now() }))
              : undefined,
            completedActions: completedActions ?? [],
            updatedFields: updatedFields ?? [],
            confidence: confidence ?? null,
            log: currentStep,
          })
        },
      }),
      new Promise<typeof timeoutResult>((resolve) => {
        setTimeout(() => resolve(timeoutResult), SINGLE_REQUEST_TIMEOUT_MS)
      }),
    ])

    if (!result.processed) {
      finishArtistIntelRun(runId, 'error', result.error ?? 'Artist not found', {
        artistName: result.name,
        processed: 0,
        total: 1,
        sourcesUsed: result.sources,
        completedActions: result.processed ? ['Resolved artist profile'] : [],
        updatedFields: result.updated_fields,
        confidence: result.confidence,
      })
      return NextResponse.json({ error: result.error ?? 'Artist not found', run_id: runId }, { status: 404 })
    }
    finishArtistIntelRun(runId, 'completed', `Completed ${result.name}`, {
      artistName: result.name,
      processed: 1,
      total: 1,
      sourcesUsed: result.sources,
      completedActions: [
        'Collected source data',
        'Updated profile fields',
        'Updated platform links',
        'Saved metadata evidence',
        'Refreshed image assets',
      ],
      updatedFields: result.updated_fields,
      confidence: result.confidence,
    })
    return NextResponse.json({ ...result, run_id: runId })
  }

  // ── Bulk get-intel run for active artists ────────────────────────────────────
  if (body.bulk) {
    cleanupBulkRuns()

    if (body.stop) {
      if (!body.runId) {
        return NextResponse.json({ error: 'runId is required for stop action' }, { status: 400 })
      }

      const run = BULK_RUNS.get(body.runId)
      if (!run) {
        return NextResponse.json({ stopped: false, message: 'Run not found or already finished' })
      }

      run.stopRequested = true
      BULK_RUNS.set(body.runId, run)
      return NextResponse.json({ stopped: true, runId: body.runId })
    }

    const runId = body.runId ?? crypto.randomUUID()
    BULK_RUNS.set(runId, { stopRequested: false, startedAt: Date.now() })
    startArtistIntelRun({
      runId,
      mode: 'bulk',
      total: Math.min(body.limit ?? 100, 200),
      artistName: null,
      currentStep: 'Starting bulk Get Intel run...',
      sourcesUsed: [],
      completedActions: [],
      updatedFields: [],
      confidence: null,
    })

    try {
      const summary = await runArtistIntelBulk(db, {
        limit: body.limit ?? 100,
        mode: body.mode ?? 'full',
        config: body.agentConfig ?? null,
        shouldStop: () => BULK_RUNS.get(runId)?.stopRequested === true,
        onProgress: ({ artistName, currentStep, processed, total, sourcesUsed, findings, completedActions, updatedFields, confidence }) => {
          updateArtistIntelRun(runId, {
            artistName: artistName ?? null,
            currentStep,
            processed: processed ?? 0,
            total: total ?? Math.min(body.limit ?? 100, 200),
            sourcesUsed: sourcesUsed ?? [],
            findings: findings
              ? findings.map((item) => ({ ...item, timestamp: Date.now() }))
              : undefined,
            completedActions: completedActions ?? [],
            updatedFields: updatedFields ?? [],
            confidence: confidence ?? null,
            log: currentStep,
          })
        },
      })

      finishArtistIntelRun(
        runId,
        summary.stopped_early ? 'stopped' : 'completed',
        summary.stopped_early ? (summary.stop_reason ?? 'Stopped early') : 'Bulk Get Intel completed',
        {
          processed: summary.processed,
          total: summary.total,
          sourcesUsed: [],
          completedActions: [
            summary.stopped_early ? (summary.stop_reason ?? 'Stopped early') : 'Bulk Get Intel completed',
          ],
          updatedFields: [],
          confidence: null,
        }
      )

      return NextResponse.json({ ...summary, run_id: runId })
    } finally {
      BULK_RUNS.delete(runId)
    }
  }

  return NextResponse.json({ error: 'Provide artistId or bulk:true' }, { status: 400 })
}
