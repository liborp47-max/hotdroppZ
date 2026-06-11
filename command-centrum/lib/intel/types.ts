/**
 * Intel — Central Data Hub types.
 *
 * Source of truth: supabase/schema-intel.sql
 *
 * Shape matches `intel_events` VIEW columns. Producers (event-bus.ts) emit
 * IntelEventInput; consumers (query.ts, UI) read IntelEvent.
 *
 * Forward-compat: shape is a superset — when upstream tables add columns,
 * VIEW exposes them in `metadata` jsonb without breaking the type.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type IntelEventKind =
  | 'pipeline_run'
  | 'worker_run'
  | 'scout_run'
  | 'audit_record'
  | 'api_error'
  | 'model_call'

export type IntelSeverity = 'info' | 'warn' | 'error' | 'critical'

/** Row shape from intel_events VIEW. */
export interface IntelEvent {
  id: string
  kind: IntelEventKind
  sourceTable: string
  stage: string | null
  status: string | null
  severity: IntelSeverity
  actor: string
  correlationId: string | null
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

/** Insert shape for intel_audit_records — used by event-bus.flush(). */
export interface IntelAuditInput {
  source: string
  actor: string
  action: string
  severity?: IntelSeverity
  message: string
  correlationId?: string
  metadata?: Record<string, unknown>
}

/** Generic event emit shape — buffered before flush. */
export interface IntelEventInput {
  kind: IntelEventKind
  source: string
  actor?: string
  action: string
  severity?: IntelSeverity
  message: string
  correlationId?: string
  metadata?: Record<string, unknown>
  emittedAt?: string
}

export interface IntelEventFilter {
  kinds?: IntelEventKind[]
  severities?: IntelSeverity[]
  stages?: string[]
  actor?: string
  correlationId?: string
  /** ISO timestamp lower bound (started_at). */
  since?: string
  /** ISO timestamp upper bound (started_at). */
  until?: string
  /** Free-text needle matched against message + actor + stage. */
  q?: string
  limit?: number
  /** Offset for pagination. */
  offset?: number
}

export interface IntelEventBatch {
  total: number
  events: IntelEvent[]
}

export interface RetentionPolicy {
  source: string
  retentionDays: number | null
  description: string | null
}

export interface PurgeResult {
  source: string
  purgedCount: number
}

export type IntelDb = Pick<SupabaseClient, 'from' | 'rpc'>
