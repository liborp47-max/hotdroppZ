/**
 * Snapshot Reliability Gate (PM-MISS-002).
 *
 * The analytics/mission snapshot (analytics-snapshot.ts) is rebuilt on every
 * sync, but nothing decided whether it was trustworthy — so confidence could
 * stand on stale or incomplete data. This module is that gate: ONE evaluator
 * that runs on the composed snapshot and returns an explicit `ok` / `degraded`
 * verdict with concrete reasons.
 *
 *   - Freshness gate    — snapshot age + upstream data freshness vs a 24h SLO.
 *   - Completeness gate — required fields present, internal status consistency,
 *                         and upstream data-dependency availability (warnings).
 *
 * Pure + framework-free (only the snapshot type) → unit-testable under
 * `tsx --test`. The snapshot route attaches the verdict so the UI/clients see a
 * degraded snapshot for what it is.
 */
import type { AnalyticsSnapshot, AnalyticsHealthState } from './analytics-snapshot'

export type SnapshotReliabilityState = 'ok' | 'degraded'

export type SnapshotReliabilityCode =
  | 'STALE_GENERATED' // snapshot generatedAt older than the SLO (e.g. a stale cache)
  | 'STALE_DATA' // upstream stage data freshness exceeds the SLO
  | 'MISSING_FIELDS' // required snapshot fields absent / invalid
  | 'STATUS_INCONSISTENT' // contradictory internal states (e.g. blocked > active)
  | 'DEPENDENCY_UNAVAILABLE' // an upstream data source / view was unavailable

export interface SnapshotReason {
  code: SnapshotReliabilityCode
  message: string
}

export interface SnapshotReliability {
  state: SnapshotReliabilityState
  /** Concrete reasons — empty iff state is `ok`. */
  reasons: SnapshotReason[]
  freshness: {
    sloHours: number
    /** now − generatedAt, in hours. null when generatedAt is invalid. */
    ageHours: number | null
    /** Max stage data-freshness (staleness) in hours. null when no stages. */
    dataFreshnessHours: number | null
    withinSlo: boolean
  }
  completeness: {
    ok: boolean
    missingFields: string[]
    inconsistencies: string[]
    unavailableDependencies: string[]
  }
}

export const SNAPSHOT_FRESHNESS_SLO_HOURS = 24

const HEALTH_STATES: ReadonlySet<AnalyticsHealthState> = new Set<AnalyticsHealthState>([
  'green',
  'amber',
  'red',
  'unknown',
])
const CONTRACT_STATES = new Set(['pass', 'warn', 'fail'])

/** Warnings that mean the snapshot stands on incomplete upstream data. */
const DEPENDENCY_WARNING = /unavailable|degraded|not reachable|query failed|no sampled/i

export interface SnapshotReliabilityContext {
  now?: Date
  /** Override the freshness SLO (defaults to 24h). */
  sloHours?: number
}

const HOUR_MS = 3_600_000

/**
 * Single source of truth for whether a snapshot is trustworthy. Any reason →
 * `degraded`. Deterministic + side-effect free.
 */
export function evaluateSnapshotReliability(
  snapshot: AnalyticsSnapshot,
  ctx: SnapshotReliabilityContext = {},
): SnapshotReliability {
  const now = ctx.now ?? new Date()
  const sloHours = ctx.sloHours ?? SNAPSHOT_FRESHNESS_SLO_HOURS
  const reasons: SnapshotReason[] = []

  const missingFields: string[] = []
  const inconsistencies: string[] = []
  const unavailableDependencies: string[] = []

  // ── completeness: required fields ─────────────────────────────────────────
  const generatedMs = Date.parse(snapshot?.generatedAt ?? '')
  const generatedValid = Number.isFinite(generatedMs)
  if (!generatedValid) missingFields.push('generatedAt')
  if (!CONTRACT_STATES.has(snapshot?.contractStatus as string)) missingFields.push('contractStatus')

  const mh = snapshot?.sections?.missionHealth
  if (!mh) {
    missingFields.push('sections.missionHealth')
  } else {
    if (typeof mh.confidencePercent !== 'number' || !Number.isFinite(mh.confidencePercent)) {
      missingFields.push('sections.missionHealth.confidencePercent')
    }
    if (!HEALTH_STATES.has(mh.healthState)) missingFields.push('sections.missionHealth.healthState')
  }
  if (!snapshot?.sections?.auditRisk) missingFields.push('sections.auditRisk')
  if (!snapshot?.sections?.intelTrends) missingFields.push('sections.intelTrends')
  if (!snapshot?.sections?.testSignal) missingFields.push('sections.testSignal')

  // ── completeness: status consistency ──────────────────────────────────────
  if (mh) {
    if (typeof mh.confidencePercent === 'number' && (mh.confidencePercent < 0 || mh.confidencePercent > 100)) {
      inconsistencies.push(`confidencePercent ${mh.confidencePercent} out of range 0–100`)
    }
    if (typeof mh.activeMissions === 'number' && typeof mh.blockedMissions === 'number' && mh.blockedMissions > mh.activeMissions) {
      inconsistencies.push(`blockedMissions ${mh.blockedMissions} > activeMissions ${mh.activeMissions}`)
    }
    // healthState 'green' must not coexist with a clearly red signal.
    if (mh.healthState === 'green' && typeof mh.confidencePercent === 'number' && mh.confidencePercent < 50) {
      inconsistencies.push(`healthState green contradicts confidence ${mh.confidencePercent}%`)
    }
  }
  if (snapshot?.contractStatus === 'fail') {
    inconsistencies.push('contract status = fail (missing source/owner rows)')
  }

  // ── completeness: upstream dependency availability ────────────────────────
  for (const w of snapshot?.warnings ?? []) {
    if (DEPENDENCY_WARNING.test(w)) unavailableDependencies.push(w)
  }

  // ── freshness gate ────────────────────────────────────────────────────────
  const ageHours = generatedValid ? Math.max(0, round2((now.getTime() - generatedMs) / HOUR_MS)) : null
  const dataFreshnessHours = mh?.freshnessHours ?? null
  const ageStale = ageHours != null && ageHours > sloHours
  const dataStale = dataFreshnessHours != null && dataFreshnessHours > sloHours
  const withinSlo = !ageStale && !dataStale

  // ── assemble reasons (→ degraded) ─────────────────────────────────────────
  if (ageStale) {
    reasons.push({ code: 'STALE_GENERATED', message: `Snapshot je starý ${ageHours} h (SLO ${sloHours} h).` })
  }
  if (dataStale) {
    reasons.push({ code: 'STALE_DATA', message: `Data stage jsou stará ${dataFreshnessHours} h (SLO ${sloHours} h).` })
  }
  if (missingFields.length) {
    reasons.push({ code: 'MISSING_FIELDS', message: `Chybí/neplatná pole: ${missingFields.join(', ')}.` })
  }
  if (inconsistencies.length) {
    reasons.push({ code: 'STATUS_INCONSISTENT', message: `Nekonzistence: ${inconsistencies.join('; ')}.` })
  }
  if (unavailableDependencies.length) {
    reasons.push({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: `Nedostupné zdroje dat: ${unavailableDependencies.join('; ')}.`,
    })
  }

  return {
    state: reasons.length > 0 ? 'degraded' : 'ok',
    reasons,
    freshness: { sloHours, ageHours, dataFreshnessHours, withinSlo },
    completeness: {
      ok: missingFields.length === 0 && inconsistencies.length === 0 && unavailableDependencies.length === 0,
      missingFields,
      inconsistencies,
      unavailableDependencies,
    },
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
