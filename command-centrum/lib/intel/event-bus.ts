/**
 * Intel Event Bus — in-memory ring buffer with DB flush.
 *
 * Plan-manager risks honored:
 *   #1 Memory volatility — MAX_BUFFER + autoFlushIntervalMs documented;
 *      buffer overrun drops oldest events (LRU-style) NOT crashes
 *   #6 Producer coupling — producers emit normalized IntelEventInput shape;
 *      bus owns the persisted-form translation
 *
 * No Redis/Kafka — same in-memory fallback pattern as SRL kernel cache.
 * Pluggable via IntelEventSink interface so a Redis adapter can drop in
 * without touching producers.
 *
 * Default behavior:
 *   - Producers call `bus.emit(event)` synchronously (zero-await)
 *   - Bus appends to ring buffer (max 1000 events)
 *   - Auto-flush every 10s OR when buffer hits 100 events
 *   - Flush writes to intel_audit_records for 'audit_record' kind events;
 *     other kinds are observation-only (already persisted in source tables)
 */

import type {
  IntelAuditInput,
  IntelDb,
  IntelEventInput,
  IntelSeverity,
} from './types.ts'

export const DEFAULT_BUFFER_MAX = 1000
export const DEFAULT_FLUSH_INTERVAL_MS = 10_000
export const DEFAULT_FLUSH_THRESHOLD = 100

export interface IntelEventSink {
  /** Persist a batch of audit events. Other kinds are observation-only. */
  flushAudits(events: IntelAuditInput[]): Promise<{ written: number }>
}

export interface IntelBusOptions {
  bufferMax?: number
  flushIntervalMs?: number
  flushThreshold?: number
  /** Now provider — injectable for tests. */
  now?: () => Date
  /** Auto-flush timer disabled when false. Default true. */
  autoFlush?: boolean
}

export interface IntelBusStats {
  bufferSize: number
  totalEmitted: number
  totalFlushed: number
  totalDropped: number
  lastFlushAt: string | null
  lastError: string | null
}

interface BufferedEvent extends IntelEventInput {
  emittedAt: string
}

export class IntelEventBus {
  private buffer: BufferedEvent[] = []
  private sink: IntelEventSink
  private opts: Required<Omit<IntelBusOptions, 'now' | 'autoFlush'>> & {
    now: () => Date
    autoFlush: boolean
  }
  private timer: ReturnType<typeof setInterval> | null = null
  private totalEmitted = 0
  private totalFlushed = 0
  private totalDropped = 0
  private lastFlushAt: string | null = null
  private lastError: string | null = null

  constructor(sink: IntelEventSink, options: IntelBusOptions = {}) {
    this.sink = sink
    this.opts = {
      bufferMax: options.bufferMax ?? DEFAULT_BUFFER_MAX,
      flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      flushThreshold: options.flushThreshold ?? DEFAULT_FLUSH_THRESHOLD,
      now: options.now ?? (() => new Date()),
      autoFlush: options.autoFlush ?? true,
    }
    if (this.opts.autoFlush && typeof setInterval !== 'undefined') {
      this.timer = setInterval(() => {
        void this.flush().catch(() => {
          // sink errors already captured into lastError
        })
      }, this.opts.flushIntervalMs)
      if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
        (this.timer as { unref?: () => void }).unref?.()
      }
    }
  }

  emit(event: IntelEventInput): void {
    this.totalEmitted += 1
    const buffered: BufferedEvent = {
      ...event,
      emittedAt: event.emittedAt ?? this.opts.now().toISOString(),
    }
    this.buffer.push(buffered)
    if (this.buffer.length > this.opts.bufferMax) {
      // Drop oldest (LRU) — graceful overflow, no crash
      const overflow = this.buffer.length - this.opts.bufferMax
      this.totalDropped += overflow
      this.buffer.splice(0, overflow)
    }
    if (this.buffer.length >= this.opts.flushThreshold) {
      // Fire-and-forget — caller doesn't wait
      void this.flush().catch(() => undefined)
    }
  }

  async flush(): Promise<{ written: number; dropped: number }> {
    if (this.buffer.length === 0) return { written: 0, dropped: 0 }

    const batch = this.buffer.splice(0, this.buffer.length)

    // Only audit_record kind events persist via flush; other kinds were
    // already written by their source producers (pipeline_runs, etc).
    const audits = batch
      .filter((e) => e.kind === 'audit_record')
      .map(toAuditInput)

    if (audits.length === 0) {
      this.lastFlushAt = this.opts.now().toISOString()
      return { written: 0, dropped: 0 }
    }

    try {
      const { written } = await this.sink.flushAudits(audits)
      this.totalFlushed += written
      this.lastFlushAt = this.opts.now().toISOString()
      return { written, dropped: 0 }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      // Drop on persistent failure — caller can re-emit at higher layer if needed
      this.totalDropped += audits.length
      return { written: 0, dropped: audits.length }
    }
  }

  stats(): IntelBusStats {
    return {
      bufferSize: this.buffer.length,
      totalEmitted: this.totalEmitted,
      totalFlushed: this.totalFlushed,
      totalDropped: this.totalDropped,
      lastFlushAt: this.lastFlushAt,
      lastError: this.lastError,
    }
  }

  /** Stop the auto-flush timer. Tests + clean shutdown. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Default sink — writes to intel_audit_records via Supabase
// ────────────────────────────────────────────────────────────────────────────

export class SupabaseAuditSink implements IntelEventSink {
  private db: IntelDb

  constructor(db: IntelDb) {
    this.db = db
  }

  async flushAudits(events: IntelAuditInput[]): Promise<{ written: number }> {
    if (events.length === 0) return { written: 0 }
    try {
      const rows = events.map((e) => ({
        source: e.source,
        actor: e.actor,
        action: e.action,
        severity: e.severity ?? 'info',
        message: e.message,
        correlation_id: e.correlationId ?? null,
        metadata: e.metadata ?? {},
      }))
      const { error } = await this.db.from('intel_audit_records').insert(rows)
      if (error) {
        // Fix MAJOR-1 (sub-09 audit): propagate so bus.stats() counts as dropped
        // and lastError is set. Silent swallow hides audit-log loss from operators.
        const msg = (error as { message?: string }).message ?? String(error)
        throw new Error(`SupabaseAuditSink.flushAudits: ${msg}`)
      }
      return { written: events.length }
    } catch (err) {
      // Re-throw so IntelEventBus.flush() catches → records lastError + dropped count.
      // (Without this re-throw the bus would treat the failure as silent success.)
      throw err instanceof Error ? err : new Error(String(err))
    }
  }
}

/** Process-singleton bus + sink getters — lazy, test-overridable. */
let _bus: IntelEventBus | null = null

export function getIntelBus(db?: IntelDb): IntelEventBus {
  if (_bus) return _bus
  if (!db) throw new Error('getIntelBus: first call requires a db reference')
  _bus = new IntelEventBus(new SupabaseAuditSink(db))
  return _bus
}

/** Tests + shutdown hook. */
export function resetIntelBus(): void {
  if (_bus) {
    _bus.stop()
    _bus = null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function toAuditInput(e: BufferedEvent): IntelAuditInput {
  return {
    source: e.source,
    actor: e.actor ?? 'system',
    action: e.action,
    severity: e.severity,
    message: e.message,
    correlationId: e.correlationId,
    metadata: e.metadata,
  }
}

/** Convenience emit — for callers that don't want to instantiate IntelEventInput. */
export function emitAudit(
  bus: IntelEventBus,
  action: string,
  message: string,
  opts?: {
    source?: string
    actor?: string
    severity?: IntelSeverity
    correlationId?: string
    metadata?: Record<string, unknown>
  },
): void {
  bus.emit({
    kind: 'audit_record',
    source: opts?.source ?? 'manual',
    actor: opts?.actor,
    action,
    severity: opts?.severity ?? 'info',
    message,
    correlationId: opts?.correlationId,
    metadata: opts?.metadata,
  })
}
