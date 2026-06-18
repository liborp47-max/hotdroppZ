import { NextResponse } from 'next/server'
import fs from 'fs'
import type { Plan } from '@/lib/hd-central/types'
// path no longer needed — PLAN_FILE comes from the shared store.
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { validatePlanPayload } from '@/lib/hd-central/plan-schema'
import { PLAN_FILE, mutatePlan } from '@/lib/hd-central/plan-store'

// SSE keep-alive interval — comment frames stop idle proxies dropping the stream.
const HEARTBEAT_MS = 25_000
// fs.watch can fire several events per write; collapse them into one push.
const WATCH_DEBOUNCE_MS = 200

export const dynamic = 'force-dynamic'

function emptyPlan(): Plan {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    missions: [],
    tasks: [],
  }
}

function readPlan(): Plan {
  if (!fs.existsSync(PLAN_FILE)) return emptyPlan()
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
    if (!Array.isArray(parsed.missions)) {
      return { ...emptyPlan(), ...parsed, missions: [], tasks: parsed.tasks ?? [] }
    }
    return { ...parsed, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }
  } catch {
    return emptyPlan()
  }
}

// Live plan stream (BRAIN-MPX87CRF). Pushes the normalized plan on first
// connect and again whenever NOTES/plan.json changes — the Mission Timeline
// gets real-time mission progress without polling. Read-only: it never writes
// the plan (writing would re-trigger fs.watch into a feedback loop).
function streamPlan(request: Request): Response {
  const encoder = new TextEncoder()
  let watcher: fs.FSWatcher | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (plan: Plan) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(plan)}\n\n`))
        } catch {
          /* controller already closed */
        }
      }
      const pushCurrent = () => {
        try {
          send(normalizePlan(readPlan()))
        } catch (e) {
          console.error('[plan] stream read error:', e)
        }
      }

      pushCurrent() // initial snapshot

      try {
        watcher = fs.watch(PLAN_FILE, () => {
          if (debounce) clearTimeout(debounce)
          debounce = setTimeout(pushCurrent, WATCH_DEBOUNCE_MS)
        })
      } catch {
        /* file may not exist yet — heartbeat keeps the connection open */
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          /* closed */
        }
      }, HEARTBEAT_MS)

      const close = () => {
        if (debounce) clearTimeout(debounce)
        if (heartbeat) clearInterval(heartbeat)
        if (watcher) {
          try {
            watcher.close()
          } catch {
            /* ignore */
          }
          watcher = null
        }
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      if (debounce) clearTimeout(debounce)
      if (heartbeat) clearInterval(heartbeat)
      if (watcher) {
        try {
          watcher.close()
        } catch {
          /* ignore */
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx) so frames flush immediately.
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function GET(request: Request) {
  // EventSource sends `Accept: text/event-stream` → serve the live stream.
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return streamPlan(request)
  }
  try {
    // AUD-DATA-001: GET is a PURE READ. It previously called writePlan() on every
    // read, which (a) triggered the route's own fs.watch SSE push (churn loop) and
    // (b) opened a lost-write race against concurrent PUTs. normalizePlan is
    // deterministic, so the normalized view is recomputed per read without persisting.
    const plan = normalizePlan(readPlan())
    return NextResponse.json(plan)
  } catch (e) {
    console.error('[plan] GET error:', e)
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const raw = (await request.json()) as unknown
    // AUD-CODE-002: validate structure with zod before trusting the payload.
    const check = validatePlanPayload(raw)
    if (!check.success) {
      return NextResponse.json(
        { error: 'Invalid plan payload', issues: check.error.issues.slice(0, 5) },
        { status: 400 },
      )
    }
    const body = raw as Plan // structure validated; use original to preserve all fields
    // Serialized + atomic write via the shared store. noBump: this PUT carries its
    // own version (client-managed full-plan save), and createIfMissing preserves
    // the original first-save-bootstraps-the-file behavior.
    const merged = await mutatePlan(
      (current) => {
        const next = normalizePlan({
          version: body.version || 1,
          updatedAt: new Date().toISOString(),
          missions: body.missions,
        })
        return {
          ...next,
          tasks: Array.isArray(body.tasks) ? body.tasks : (current.tasks ?? []),
          lastPlanRun: body.lastPlanRun ?? next.lastPlanRun,
        }
      },
      { noBump: true, createIfMissing: true },
    )
    return NextResponse.json(merged)
  } catch (e) {
    console.error('[plan] PUT error:', e)
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
  }
}
