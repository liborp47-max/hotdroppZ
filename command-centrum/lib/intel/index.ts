/**
 * Intel — Central Data Hub public barrel.
 *
 * Consumers:
 *   import { queryEvents, IntelEventBus, getIntelBus, purgeExpired } from '@/lib/intel'
 */

export * from './types.ts'
export {
  IntelEventBus,
  SupabaseAuditSink,
  getIntelBus,
  resetIntelBus,
  emitAudit,
  DEFAULT_BUFFER_MAX,
  DEFAULT_FLUSH_INTERVAL_MS,
  DEFAULT_FLUSH_THRESHOLD,
  type IntelBusOptions,
  type IntelBusStats,
  type IntelEventSink,
} from './event-bus.ts'
export {
  queryEvents,
  getEventById,
  getEventsByCorrelation,
  bucketEventsByHour,
  listRetentionPolicies,
  type QueryResult,
  type TimelineBucket,
} from './query.ts'
export {
  purgeExpired,
  getPolicies,
  findUnsafePolicies,
  type PurgeReport,
} from './retention.ts'
