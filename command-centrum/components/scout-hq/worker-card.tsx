'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Loader2, Pause, Play, Settings as SettingsIcon } from 'lucide-react'
import Link from 'next/link'
import type { Worker } from '@/lib/scout/types'
import { tokensFor } from './platform-tokens'
import { PlatformIcon } from './platform-icon'
import { HealthPill } from './health-pill'
import { Sparkline } from './sparkline'

export function WorkerCard({
  worker,
  initialExpanded = false,
  onRunNow,
  isBusy,
  autoScoutingEnabled = true,
}: {
  worker: Worker
  initialExpanded?: boolean
  onRunNow?: (worker: Worker) => Promise<void> | void
  isBusy?: boolean
  autoScoutingEnabled?: boolean
}) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const tokens = tokensFor(worker.platform)
  const detailHref = `/scout-hq/workers/${tokens.slug}`
  const isAuthPending = worker.status === 'auth_pending'

  const usagePct = worker.quota
    ? Math.min(100, Math.round((worker.quota.workerUsed / worker.quota.limit) * 100))
    : null

  const handleHeader = () => setExpanded((v) => !v)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleHeader()
    }
  }

  return (
    <article
      className="plastic-card-interactive group relative overflow-hidden"
      style={{ borderLeft: `2px solid ${tokens.primary}` }}
    >
      {/* Header (clickable to expand) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Toggle ${worker.name}`}
        onClick={handleHeader}
        onKeyDown={onKey}
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
      >
        <PlatformIcon platform={worker.platform} className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#E8E8E8]">{worker.name}</span>
            <span className="text-[10px] font-mono text-[#6E6E6E] uppercase">{tokens.label}</span>
          </div>
          <p className="text-[10px] font-mono text-[#A8A8A8] mt-0.5 truncate">
            {worker.sourceCount} sources · items 24h {worker.kpi.itemsToday} · err{' '}
            {worker.kpi.errorsToday}
            {usagePct !== null && (
              <span className={`ml-2 ${usagePct >= 80 ? 'text-amber-300' : ''}`}>
                · quota {usagePct} %
              </span>
            )}
          </p>
        </div>
        <HealthPill health={worker.health} status={worker.status} />
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#6E6E6E] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#6E6E6E] shrink-0" />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3 bg-white/[0.015]">
          <p className="text-[11px] text-[#A8A8A8] leading-snug">{worker.description}</p>

          {/* Auth-pending banner */}
          {isAuthPending && (
            <div className="border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300 flex items-start gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold uppercase tracking-widest text-[10px]">Auth pending</p>
                <p className="text-[#FFD7A0] mt-0.5 leading-snug">
                  {worker.blockerNote ?? 'Platform vyžaduje approval. Worker scaffold je ready.'}
                </p>
              </div>
            </div>
          )}

          {/* Gateway badge */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#6E6E6E]">
            <span className="px-1.5 py-0.5 border border-white/10 bg-white/[0.03]">
              gateway: <span className="text-[#A8A8A8]">{worker.config.gatewayId}</span>
            </span>
            {worker.config.secretRef && (
              <span className="px-1.5 py-0.5 border border-white/10 bg-white/[0.03]">
                secret: <span className="text-[#A8A8A8]">{worker.config.secretRef}</span>
              </span>
            )}
          </div>

          {/* 4 mini-tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-center">
            <MiniTile label="last run" value={formatRelative(worker.lastRunAt)} />
            <MiniTile label="items 24h" value={String(worker.kpi.itemsToday)} />
            <MiniTile
              label="err 24h"
              value={String(worker.kpi.errorsToday)}
              tone={worker.kpi.errorsToday > 0 ? 'warn' : 'default'}
            />
            <MiniTile
              label={autoScoutingEnabled ? 'next run' : 'next run'}
              value={autoScoutingEnabled ? formatRelative(worker.nextRunAt, 'in') : 'manual'}
              tone={autoScoutingEnabled ? 'default' : 'warn'}
            />
          </div>

          {/* Sparkline + schedule */}
          <div className="flex items-center justify-between gap-3 border border-white/10 px-2.5 py-2 bg-white/[0.03]">
            <div className="text-[10px] font-mono text-[#6E6E6E]">
              schedule <span className="text-[#D0D0D0]">{worker.config.scheduleCron}</span>
            </div>
            <Sparkline values={worker.kpi.spark7d} color={tokens.primary} width={120} height={28} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void onRunNow?.(worker)
              }}
              disabled={isBusy || worker.status === 'running' || isAuthPending}
              title={isAuthPending ? 'Worker čeká na auth approval' : undefined}
              className="plastic-button-venom px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5 min-w-[112px] justify-center disabled:opacity-40"
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : worker.status === 'running' ? (
                <Pause className="h-3 w-3" />
              ) : isAuthPending ? (
                <Clock className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {worker.status === 'running'
                ? 'Running…'
                : isAuthPending
                ? 'Auth pending'
                : 'Run now'}
            </button>
            <Link
              href={detailHref}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#D0D0D0] hover:text-[#E8E8E8] hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              <SettingsIcon className="h-3 w-3" />
              Open worker
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}

function MiniTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warn' | 'success'
}) {
  const toneClass =
    tone === 'warn' ? 'text-amber-300' : tone === 'success' ? 'text-[#1AEE99]' : 'text-[#E8E8E8]'
  return (
    <div className="border border-white/10 bg-white/[0.03] py-1.5">
      <p className={`text-xs font-mono ${toneClass}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">{label}</p>
    </div>
  )
}

function formatRelative(iso?: string, kind: 'ago' | 'in' = 'ago'): string {
  if (!iso) return '—'
  const target = new Date(iso).getTime()
  const now = Date.now()
  const diff = kind === 'ago' ? now - target : target - now
  if (Number.isNaN(diff)) return '—'
  if (diff < 60000) return kind === 'ago' ? 'just now' : '<1m'
  const m = Math.floor(diff / 60000)
  if (m < 60) return kind === 'ago' ? `${m}m ago` : `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return kind === 'ago' ? `${h}h ago` : `in ${h}h`
  const d = Math.floor(h / 24)
  return kind === 'ago' ? `${d}d ago` : `in ${d}d`
}
