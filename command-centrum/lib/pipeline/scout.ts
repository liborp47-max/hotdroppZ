/**
 * Scout Pipeline - Data Discovery Phase
 * Input:  active RSS sources (scout_sources)
 * Output: raw scout_items persisted with status 'SCOUTED'
 * Purpose: fetch + parse RSS/Atom/JSON feeds, dedupe, persist raw items.
 */

import { createAdminClient, createClient } from '../supabase/server'
import { logger } from '../logger'
import { withRetryAndTimeout } from '../utils/retry'
import { parseFeed, type FeedItem } from '../services/rss-parser'
import { isUrlSafe } from '../utils/ssrf-guard'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export interface ScoutResult {
  stageStatus: 'degraded' | 'completed'
  notImplemented: boolean
  reason?: string
  itemsFound: number
  itemsInserted: number
  errors: string[]
  durationMs: number
}

interface ScoutSourceRow {
  id: string
  name: string
  url: string
  category: string | null
  lang: string | null
}

const FETCH_TIMEOUT_MS = 15000
const FETCH_MAX_RETRIES = 2
const USER_AGENT = 'HotDroppZ-Scout/1.0 (+https://hotdroppz.com)'

/** RFC822 / ISO date string -> ISO 8601, or null when unparseable. */
function normalizeDate(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Fetch one feed URL with per-source timeout + retry, then parse it. */
async function fetchAndParse(url: string): Promise<FeedItem[]> {
  // AUD-SEC-002: defense-in-depth SSRF block (sources are admin-curated, but a
  // bad/compromised source must not let the server reach internal/metadata hosts).
  const safe = isUrlSafe(url)
  if (!safe.ok) throw new Error(`blocked: unsafe feed url (${safe.reason})`)
  const body = await withRetryAndTimeout(
    async () => {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      // 'network'/'timeout' in the message opt the error into the retry policy.
      if (!res.ok) throw new Error(`network: HTTP ${res.status}`)
      return res.text()
    },
    {
      maxRetries: FETCH_MAX_RETRIES,
      timeoutMs: FETCH_TIMEOUT_MS,
      timeoutMessage: 'timeout: RSS fetch exceeded limit',
    },
  )
  return parseFeed(body)
}

/** Record the fetch outcome back onto the scout_sources row. */
async function markSource(
  db: PipelineDbClient,
  id: string,
  found: number,
  health: 'ok' | 'error',
  errorMessage: string | null,
): Promise<void> {
  try {
    await db
      .from('scout_sources')
      .update({
        last_fetched_at: new Date().toISOString(),
        total_items_found: found,
        health,
        error_message: errorMessage,
      })
      .eq('id', id)
  } catch (e) {
    logger.warn('Scout: failed to update scout_sources row', { id, error: String(e) })
  }
}

const STARVATION_THRESHOLD_MS = 5 * 60 * 1000

interface ScoutRunMetrics {
  status: 'complete' | 'error'
  itemsFound: number
  itemsInserted: number
  errorCount: number
  durationMs: number
  errorMessage: string | null
}

/** Open a scout_runs row at the start of a run. Best-effort — returns the row id. */
async function logScoutRunStart(db: PipelineDbClient, sourcesCount: number): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('scout_runs')
      .insert({ status: 'running', triggered_by: 'pipeline', sources_count: sourcesCount })
      .select('id')
      .single()
    if (error) {
      logger.warn('Scout: failed to open scout_runs row', { error: error.message })
      return null
    }
    return (data as { id: string } | null)?.id ?? null
  } catch (e) {
    logger.warn('Scout: failed to open scout_runs row', { error: String(e) })
    return null
  }
}

/**
 * Close the scout_runs row with final metrics. Best-effort; if the
 * items_inserted / error_count columns are not present yet (migration
 * 20260521000000 not applied) it degrades to the core columns.
 */
async function logScoutRunFinish(
  db: PipelineDbClient,
  runId: string | null,
  m: ScoutRunMetrics,
): Promise<void> {
  if (!runId) return
  const core = {
    status: m.status,
    completed_at: new Date().toISOString(),
    duration_ms: m.durationMs,
    items_found: m.itemsFound,
    error_message: m.errorMessage,
  }
  const full = { ...core, items_inserted: m.itemsInserted, error_count: m.errorCount }
  try {
    const { error } = await db.from('scout_runs').update(full).eq('id', runId)
    if (error) {
      await db.from('scout_runs').update(core).eq('id', runId)
      logger.warn('Scout: scout_runs metrics columns missing — logged core only', {
        detail: error.message,
      })
    }
  } catch (e) {
    try {
      await db.from('scout_runs').update(core).eq('id', runId)
    } catch {
      logger.warn('Scout: failed to close scout_runs row', { error: String(e) })
    }
  }
}

/**
 * Filter-starvation alert. Warns when there are 0 scout_items in SCOUTED
 * status and the last scout run is older than 5 minutes — i.e. the Filter
 * stage has had nothing to filter for too long. Exported so a monitor cron
 * can call it independently of a Scout run.
 */
export async function checkScoutStarvation(
  db: PipelineDbClient,
): Promise<{ scoutedCount: number; starved: boolean }> {
  try {
    const { count } = await db
      .from('scout_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'SCOUTED')
    const scoutedCount = count ?? 0
    if (scoutedCount > 0) return { scoutedCount, starved: false }

    const { data } = await db
      .from('scout_runs')
      .select('started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(1)
    const last = ((data ?? []) as Array<{ started_at: string; completed_at: string | null }>)[0]
    const ref = last?.completed_at ?? last?.started_at ?? null
    const ageMs = ref ? Date.now() - Date.parse(ref) : Number.POSITIVE_INFINITY
    const starved = ageMs > STARVATION_THRESHOLD_MS

    if (starved) {
      logger.warn('SCOUT STARVATION: 0 SCOUTED items — Filter has nothing to filter', {
        lastRunAgeMin: Number.isFinite(ageMs) ? Math.round(ageMs / 60_000) : null,
        thresholdMin: 5,
      })
    }
    return { scoutedCount: 0, starved }
  } catch (e) {
    logger.warn('Scout starvation check failed', { error: String(e) })
    return { scoutedCount: 0, starved: false }
  }
}

/**
 * Scout pipeline — ingest active RSS sources, dedupe, persist raw scout items.
 * Per-source failures are isolated so one broken feed cannot abort the run.
 */
export async function runScoutPipeline(db: PipelineDbClient): Promise<ScoutResult> {
  const startTime = Date.now()
  logger.info('Scout pipeline started')
  const errors: string[] = []
  let itemsFound = 0
  let itemsInserted = 0
  let runId: string | null = null

  try {
    // Starvation check — flag if the pipeline has been dry for >5 min.
    await checkScoutStarvation(db)

    // 1) Ingest — load active RSS sources.
    const { data: sourceData, error: sourceErr } = await db
      .from('scout_sources')
      .select('id, name, url, category, lang')
      .eq('active', true)
    if (sourceErr) throw new Error(`Failed to load scout_sources: ${sourceErr.message}`)
    const sources = (sourceData ?? []) as ScoutSourceRow[]
    runId = await logScoutRunStart(db, sources.length)

    if (sources.length === 0) {
      logger.warn('Scout pipeline: no active RSS sources configured')
      await logScoutRunFinish(db, runId, {
        status: 'complete',
        itemsFound: 0,
        itemsInserted: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
        errorMessage: null,
      })
      return {
        stageStatus: 'completed',
        notImplemented: false,
        reason: 'No active RSS sources configured.',
        itemsFound: 0,
        itemsInserted: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      }
    }

    // 2) Fetch + parse each source — failures isolated per source.
    const candidates: Array<{ source: ScoutSourceRow; item: FeedItem }> = []
    for (const src of sources) {
      try {
        const feedItems = await fetchAndParse(src.url)
        itemsFound += feedItems.length
        for (const item of feedItems) candidates.push({ source: src, item })
        await markSource(db, src.id, feedItems.length, 'ok', null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${src.name}: ${msg}`)
        await markSource(db, src.id, 0, 'error', msg)
      }
    }

    // 3) Dedupe within the batch by url AND title fingerprint. scout_items has
    //    TWO partial unique indexes: (url) and (title_fingerprint) where status
    //    <> 'discarded'. title_fingerprint is generated as
    //    lower(substring(trim(title),1,60)) — two different urls sharing the
    //    same leading title therefore collide. Deduping by url alone let such a
    //    pair through and the whole batch insert failed (SCOUT-PERSIST fix).
    const fingerprint = (title: string | null | undefined) =>
      (title ?? '').trim().toLowerCase().slice(0, 60)
    const seenUrls = new Set<string>()
    const seenFps = new Set<string>()
    const unique = candidates.filter(({ item }) => {
      if (!item.url || seenUrls.has(item.url)) return false
      const fp = fingerprint(item.title)
      if (fp && seenFps.has(fp)) return false
      seenUrls.add(item.url)
      if (fp) seenFps.add(fp)
      return true
    })

    // 4) Drop items already persisted (by url OR by non-discarded fingerprint).
    let fresh = unique
    if (unique.length > 0) {
      const urls = unique.map((c) => c.item.url)
      const fps = unique.map((c) => fingerprint(c.item.title)).filter(Boolean)
      const [{ data: byUrl }, { data: byFp }] = await Promise.all([
        db.from('scout_items').select('url').in('url', urls),
        db
          .from('scout_items')
          .select('title_fingerprint')
          .neq('status', 'discarded')
          .in('title_fingerprint', fps),
      ])
      const existingUrls = new Set(
        ((byUrl ?? []) as Array<{ url: string | null }>)
          .map((r) => r.url)
          .filter((u): u is string => Boolean(u)),
      )
      const existingFps = new Set(
        ((byFp ?? []) as Array<{ title_fingerprint: string | null }>)
          .map((r) => r.title_fingerprint)
          .filter((f): f is string => Boolean(f)),
      )
      fresh = unique.filter(
        (c) => !existingUrls.has(c.item.url) && !existingFps.has(fingerprint(c.item.title)),
      )
    }

    // 5) Persist new raw items as SCOUTED. A late duplicate (concurrent run, or a
    //    collision the pre-checks missed) must not drop the whole batch — fall
    //    back to row-by-row, skipping unique violations (Postgres code 23505).
    if (fresh.length > 0) {
      const rows = fresh.map(({ source, item }) => ({
        source: source.name,
        url: item.url,
        title: item.title,
        content: item.content,
        raw_content: item.content,
        category: source.category ?? 'culture',
        language: source.lang ?? 'en-us',
        status: 'SCOUTED',
        published_at: normalizeDate(item.pubDate),
      }))
      const { error: insertErr, count } = await db
        .from('scout_items')
        .insert(rows, { count: 'exact' })
      if (insertErr) {
        logger.warn('Scout: bulk insert hit a conflict, retrying row-by-row', {
          error: insertErr.message,
        })
        let inserted = 0
        for (const row of rows) {
          const { error: rowErr } = await db.from('scout_items').insert(row)
          if (!rowErr) inserted++
          else if (rowErr.code !== '23505')
            errors.push(`persist ${row.url}: ${rowErr.message}`)
        }
        itemsInserted = inserted
      } else {
        itemsInserted = count ?? rows.length
      }
    }

    const result: ScoutResult = {
      stageStatus: errors.length === sources.length ? 'degraded' : 'completed',
      notImplemented: false,
      itemsFound,
      itemsInserted,
      errors,
      durationMs: Date.now() - startTime,
    }
    logger.info('Scout pipeline completed', {
      sources: sources.length,
      itemsFound,
      itemsInserted,
      errorCount: errors.length,
      durationMs: result.durationMs,
    })
    await logScoutRunFinish(db, runId, {
      status: result.stageStatus === 'degraded' ? 'error' : 'complete',
      itemsFound,
      itemsInserted,
      errorCount: errors.length,
      durationMs: result.durationMs,
      errorMessage: errors.length > 0 ? errors.join('; ').slice(0, 500) : null,
    })
    return result
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.error('Scout pipeline failed', error)
    await logScoutRunFinish(db, runId, {
      status: 'error',
      itemsFound,
      itemsInserted,
      errorCount: errors.length,
      durationMs: Date.now() - startTime,
      errorMessage: error.message.slice(0, 500),
    })
    throw error
  }
}

/**
 * Get raw scout items ready for the Filter stage (status SCOUTED, oldest first).
 */
export async function getScoutItemsForFilter(
  db: PipelineDbClient,
  limit: number = 500,
): Promise<Array<{ id: string; title: string; content: string; source: string; url: string }>> {
  try {
    const { data, error } = await db
      .from('scout_items')
      .select('id, title, content, source, url')
      .eq('status', 'SCOUTED')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) {
      logger.error('Failed to fetch scout items', new Error(error.message))
      return []
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      content: String(r.content ?? ''),
      source: String(r.source ?? ''),
      url: String(r.url ?? ''),
    }))
  } catch (err) {
    logger.error('Failed to fetch scout items', err as Error)
    return []
  }
}
