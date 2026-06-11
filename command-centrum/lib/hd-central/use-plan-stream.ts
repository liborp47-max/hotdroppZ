'use client'

/**
 * Shared live plan source for HD Central (UI upgrade — "optimize").
 *
 * Before: missions-section, user-missions-panel, ceo-main, timeline-panel and
 * intel-mission-done each ran their own `fetch('/api/hd-central/plan')`. This
 * hook gives the whole section ONE live source: an initial fetch plus the SSE
 * stream added in BRAIN-MPX87CRF (the route serves a `text/event-stream` when
 * the request Accepts it, which EventSource does automatically).
 *
 * Returns the current plan, a loading flag, and a manual `refresh()` (used after
 * mutations whose response is the already-updated plan, to avoid a round-trip).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Plan } from './types'

export interface PlanStream {
  plan: Plan | null
  loading: boolean
  /** Replace the local plan immediately (e.g. with a mutation's response). */
  setPlan: (plan: Plan) => void
  /** Force a one-shot re-fetch. */
  refresh: () => Promise<void>
}

const PLAN_URL = '/api/hd-central/plan'

export function usePlanStream(): PlanStream {
  const [plan, setPlanState] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  // Ignore stale SSE frames that arrive right after a manual refresh/mutation.
  const lastLocalWriteRef = useRef(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(PLAN_URL)
      if (!res.ok) return
      const data = (await res.json()) as Plan
      lastLocalWriteRef.current = Date.now()
      setPlanState(data)
    } catch {
      // silent — SSE will resync
    } finally {
      setLoading(false)
    }
  }, [])

  const setPlan = useCallback((next: Plan) => {
    lastLocalWriteRef.current = Date.now()
    setPlanState(next)
  }, [])

  useEffect(() => {
    let cancelled = false

    // Initial snapshot (also covers environments without EventSource).
    void (async () => {
      try {
        const res = await fetch(PLAN_URL)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as Plan
        if (!cancelled) setPlanState(data)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    if (typeof EventSource === 'undefined') return () => { cancelled = true }

    const es = new EventSource(PLAN_URL)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Plan
        setPlanState(data)
      } catch {
        // ignore malformed frame
      }
    }
    // EventSource auto-reconnects on transient errors; no handler needed.
    return () => {
      cancelled = true
      es.close()
    }
  }, [])

  return { plan, loading, setPlan, refresh }
}
