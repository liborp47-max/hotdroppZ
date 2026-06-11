'use client'

import { useMemo } from 'react'
import { AlertTriangle, Activity, Database, Gauge, Layers } from 'lucide-react'
import { useLiveMetrics, type LiveMetrics } from './use-live-metrics'

// ─────────────────────────────────────────────────────────────────────────────
// LiveDashboardStrip
// Compact horizontal status strip rendered above the pipeline chain.
// Polls /api/hd-central/pipeline-state/live-metrics every 10s.
// Four sections: Queues · Throughput · Schema · Active.
// ─────────────────────────────────────────────────────────────────────────────

const VENOM = '#1AEE99'
const VENOM_DEEP = '#00E085'
const AMBER = '#F59E0B'
const RED = '#FF6B6B'
const MUTED = '#A8A8A8'
const SUBTLE = '#6E6E6E'

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'never'
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`
  return String(n)
}

function shortHash(s: string | null | undefined): string {
  if (!s) return '—'
  if (s.length <= 8) return s
  return `${s.slice(0, 6)}…`
}

interface SchemaBadge {
  color: string
  label: string
}

function pickSchemaBadge(h: LiveMetrics['schemaHealth']): SchemaBadge {
  if (!h.available) return { color: RED, label: 'unavailable' }
  const tIso = h.latestVersionAt
  if (!tIso) return { color: AMBER, label: 'no version recorded' }
  const ageMs = Date.now() - new Date(tIso).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  if (!Number.isFinite(ageMs)) return { color: AMBER, label: 'unknown age' }
  if (ageMs > sevenDaysMs) return { color: AMBER, label: 'stale' }
  return { color: VENOM_DEEP, label: 'healthy' }
}

interface QueueChipProps {
  label: string
  value: number
}

function QueueChip({ label, value }: QueueChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1"
      title={`${label}: ${value}`}
    >
      <span className="font-mono text-[13px] tabular-nums text-[#1AEE99]">
        {formatCompact(value)}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">{label}</span>
    </span>
  )
}

interface SectionProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  className?: string
}

function Section({ icon, title, children, className }: SectionProps) {
  return (
    <div
      className={
        'flex min-w-0 flex-col gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2 ' +
        (className ?? '')
      }
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
        <span className="text-[#A8A8A8]" aria-hidden>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Loading live metrics"
      className="plastic-card-hi rounded-lg border border-white/[0.06] px-3 py-2"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="h-[88px] rounded-md border border-white/[0.06] bg-white/[0.02] motion-safe:animate-pulse"
          />
        ))}
      </div>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="plastic-card-hi flex items-center gap-3 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-3 py-2 text-[11px] text-[#FFB3B3]"
    >
      <AlertTriangle aria-hidden className="h-4 w-4" />
      <span>Failed to load live metrics.</span>
      <span className="truncate text-[10px] text-[#FFB3B3]/70">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto rounded border border-white/[0.15] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#E8E8E8] hover:bg-white/[0.06]"
      >
        retry
      </button>
    </div>
  )
}

export function LiveDashboardStrip() {
  const { data, error, isLoading, refresh } = useLiveMetrics()

  const schemaBadge = useMemo<SchemaBadge | null>(() => {
    if (!data) return null
    return pickSchemaBadge(data.schemaHealth)
  }, [data])

  if (isLoading && !data) return <Skeleton />

  if (error && !data) {
    return <ErrorBanner message={error.message} onRetry={() => void refresh()} />
  }

  if (!data) return <Skeleton />

  const q = data.queues

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Live pipeline dashboard"
      className="plastic-card-hi rounded-lg border border-white/[0.06] px-3 py-2"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {/* Queues */}
        <Section icon={<Layers className="h-3 w-3" />} title="Queues">
          <div className="flex flex-wrap items-center gap-1.5">
            <QueueChip label="SCOUTED" value={q.SCOUTED} />
            <QueueChip label="TRANSLATED" value={q.TRANSLATED} />
            <QueueChip label="CURATED" value={q.CURATED} />
            <QueueChip label="enrich" value={q.clusters_pending_enrichment} />
            <QueueChip label="writer" value={q.clusters_pending_writer} />
            <QueueChip label="publish" value={q.posts_pending_publish} />
            <QueueChip label="multilang" value={q.posts_pending_multilang} />
            <QueueChip label="monetize" value={q.posts_pending_monetizer} />
          </div>
        </Section>

        {/* Throughput */}
        <Section icon={<Gauge className="h-3 w-3" />} title="Throughput (24h)">
          <div className="flex items-baseline gap-4">
            <div className="flex flex-col">
              <span className="font-mono text-[18px] tabular-nums text-[#1AEE99]">
                {formatCompact(data.throughput.scout_items_last_24h)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">scout items</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[18px] tabular-nums text-[#1AEE99]">
                {formatCompact(data.throughput.posts_last_24h)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#A8A8A8]">posts</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[13px] tabular-nums text-[#A8A8A8]">
                {formatCompact(data.throughput.scout_items_last_1h)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#6E6E6E]">scout 1h</span>
            </div>
          </div>
        </Section>

        {/* Schema */}
        <Section icon={<Database className="h-3 w-3" />} title="Schema">
          {schemaBadge ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full motion-safe:animate-pulse"
                  style={{ backgroundColor: schemaBadge.color, boxShadow: `0 0 6px ${schemaBadge.color}` }}
                />
                <span style={{ color: schemaBadge.color }}>{schemaBadge.label}</span>
              </div>
              {data.schemaHealth.available ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono text-[#A8A8A8]">
                  <span>tables=<span className="text-[#E8E8E8]">{data.schemaHealth.tableCount ?? '—'}</span></span>
                  <span>v=<span className="text-[#E8E8E8]">{timeAgo(data.schemaHealth.latestVersionAt)}</span></span>
                  <span>checksum=<span className="text-[#E8E8E8]">{shortHash(data.schemaHealth.currentChecksum)}</span></span>
                </div>
              ) : (
                <p className="text-[10px] text-[#6E6E6E]">schema_health view unavailable</p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-[#6E6E6E]">—</p>
          )}
        </Section>

        {/* Active runs */}
        <Section icon={<Activity className="h-3 w-3" />} title="Active">
          <div className="flex items-baseline gap-4">
            <div className="flex flex-col">
              <span
                className="font-mono text-[22px] tabular-nums"
                style={{
                  color: data.activeRunsCount > 0 ? VENOM : SUBTLE,
                  textShadow: data.activeRunsCount > 0 ? `0 0 8px ${VENOM_DEEP}` : undefined,
                }}
              >
                {data.activeRunsCount}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                running
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[12px] tabular-nums" style={{ color: MUTED }}>
                {timeAgo(data.generatedAt)}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: SUBTLE }}>
                last sync
              </span>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-auto rounded border border-white/[0.10] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#A8A8A8] hover:border-[#00E085]/40 hover:text-[#1AEE99]"
              aria-label="Refresh live metrics"
            >
              refresh
            </button>
          </div>
        </Section>
      </div>
    </section>
  )
}
