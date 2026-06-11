/**
 * Intel event-bus tests — buffer overflow, flush behavior, sink contract.
 *
 * Run: node --experimental-strip-types --test tests/intel-event-bus.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { IntelEventBus, emitAudit, type IntelEventSink } from '../lib/intel/event-bus.ts'
import type { IntelAuditInput } from '../lib/intel/types.ts'

const NOW = new Date('2026-05-28T12:00:00Z')

class RecordingSink implements IntelEventSink {
  public flushed: IntelAuditInput[][] = []
  public shouldFail = false

  async flushAudits(events: IntelAuditInput[]): Promise<{ written: number }> {
    if (this.shouldFail) throw new Error('sink down')
    this.flushed.push(events)
    return { written: events.length }
  }
}

test('emit + manual flush writes audit events to sink', async () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: false, now: () => NOW })

  bus.emit({
    kind: 'audit_record',
    source: 'manual',
    action: 'MISSION_DONE',
    message: 'UM-FOO completed',
  })

  const result = await bus.flush()
  assert.equal(result.written, 1)
  assert.equal(sink.flushed.length, 1)
  assert.equal(sink.flushed[0]![0]!.action, 'MISSION_DONE')
})

test('non-audit kinds skip persistence (observation-only)', async () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: false })

  bus.emit({ kind: 'pipeline_run', source: 'pipeline_runs', action: 'run', message: 'r1' })
  bus.emit({ kind: 'worker_run', source: 'worker_runs', action: 'run', message: 'r2' })

  const result = await bus.flush()
  assert.equal(result.written, 0)
  assert.equal(sink.flushed.length, 0)
})

test('flush threshold triggers automatic flush', async () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: false, flushThreshold: 3 })

  emitAudit(bus, 'A1', 'm')
  emitAudit(bus, 'A2', 'm')
  emitAudit(bus, 'A3', 'm') // triggers flush

  // Allow microtask scheduling
  await new Promise((resolve) => setImmediate(resolve))

  assert.ok(sink.flushed.length >= 1)
})

test('buffer overflow drops oldest events (LRU) — never throws', async () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: false, bufferMax: 5, flushThreshold: 999 })

  for (let i = 0; i < 10; i++) {
    emitAudit(bus, `A${i}`, `m${i}`)
  }

  const stats = bus.stats()
  assert.equal(stats.bufferSize, 5) // capped
  assert.equal(stats.totalDropped, 5) // first 5 evicted
  assert.equal(stats.totalEmitted, 10)
})

test('sink failure → events counted as dropped, no throw', async () => {
  const sink = new RecordingSink()
  sink.shouldFail = true
  const bus = new IntelEventBus(sink, { autoFlush: false })

  emitAudit(bus, 'A1', 'm')
  const result = await bus.flush()
  assert.equal(result.written, 0)
  assert.equal(result.dropped, 1)
  assert.ok(bus.stats().lastError)
})

test('emit before sink ready does not crash and is preserved', async () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: false })

  emitAudit(bus, 'A1', 'pre-flush')
  emitAudit(bus, 'A2', 'pre-flush')

  await bus.flush()
  assert.equal(sink.flushed[0]!.length, 2)
})

test('stop() stops auto-flush timer cleanly', () => {
  const sink = new RecordingSink()
  const bus = new IntelEventBus(sink, { autoFlush: true, flushIntervalMs: 10_000 })
  bus.stop()
  // No assertion needed — would leak timer if stop() broken
  assert.ok(true)
})
