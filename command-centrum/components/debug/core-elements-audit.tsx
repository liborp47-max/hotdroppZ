'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROCESS_CORE_ELEMENTS, PROCESS_LEGACY_ELEMENTS } from '@/lib/navigation/process-config'

type CheckState = 'checking' | 'ok' | 'warn' | 'error'

type AuditItem = {
  key: 'sources' | 'scout_hq' | 'cluster'
  label: string
  href: string
  ui: CheckState
  api: CheckState
  note: string
}

type DebugEndpointResponse = {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  core_elements: AuditItem[]
}

const INITIAL_AUDIT: AuditItem[] = [
  { key: 'sources', label: 'Sources', href: '/sources', ui: 'checking', api: 'warn', note: 'UI route check pending' },
  { key: 'scout_hq', label: 'SCOUT HQ', href: '/scout-hq/overview', ui: 'checking', api: 'warn', note: 'UI route check pending' },
  { key: 'cluster', label: 'Cluster', href: '/cluster', ui: 'checking', api: 'checking', note: 'UI + API check pending' },
]

function statusIcon(status: CheckState) {
  if (status === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-[#00E085]" />
  if (status === 'error') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  if (status === 'warn') return <Wrench className="h-3.5 w-3.5 text-amber-400" />
  return <Clock3 className="h-3.5 w-3.5 text-[#A8A8A8]" />
}

function statusText(status: CheckState) {
  if (status === 'ok') return 'ok'
  if (status === 'error') return 'error'
  if (status === 'warn') return 'standby'
  return 'checking'
}

export function CoreElementsAudit() {
  const [items, setItems] = useState<AuditItem[]>(INITIAL_AUDIT)
  const [globalStatus, setGlobalStatus] = useState<'ok' | 'degraded' | 'error' | 'checking'>('checking')
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const runAudit = useCallback(async () => {
    setIsRefreshing(true)

    const response = await fetch('/api/debug/core-elements', { method: 'GET', cache: 'no-store' })
      .then((res) => res.json() as Promise<DebugEndpointResponse>)
      .catch(() => null)

    if (!response) {
      setGlobalStatus('error')
      setItems(INITIAL_AUDIT.map((item) => ({ ...item, ui: 'error', api: 'error', note: 'Debug endpoint unavailable' })))
      setIsRefreshing(false)
      return
    }

    setItems(response.core_elements)
    setGlobalStatus(response.status)
    setLastCheckedAt(response.timestamp)
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    void runAudit()
  }, [runAudit])

  return (
    <div className="rounded-xl border border-white/10 bg-black/60">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#E8E8E8]">Core Elements Audit</h2>
          <p className="text-[11px] text-[#A8A8A8]">
            Active build path: Sources, SCOUT HQ, Cluster. Legacy pipeline stays preserved for later rebuild.
          </p>
          <p className="text-[11px] text-[#6E6E6E] mt-1">
            Status: <span className={cn(
              'font-semibold',
              globalStatus === 'ok' && 'text-[#00E085]',
              globalStatus === 'degraded' && 'text-amber-400',
              globalStatus === 'error' && 'text-red-400',
              globalStatus === 'checking' && 'text-[#A8A8A8]',
            )}>{globalStatus}</span>
            {lastCheckedAt && <span className="ml-2">Last check: {new Date(lastCheckedAt).toLocaleString()}</span>}
          </p>
        </div>
        <button
          onClick={() => void runAudit()}
          disabled={isRefreshing}
          className={cn(
            'inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            isRefreshing
              ? 'border-white/10 text-[#6E6E6E] bg-white/[0.025] cursor-not-allowed'
              : 'border-white/15 text-[#D0D0D0] hover:text-[#E8E8E8] hover:border-white/15 hover:bg-white/[0.03] backdrop-blur-md',
          )}
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
          Re-run audit
        </button>
      </div>

      <div className="space-y-2 p-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={item.href} className="text-sm font-medium text-[#E8E8E8] hover:text-white transition-colors">
                  {item.label}
                </Link>
                <p className="text-[11px] text-[#A8A8A8]">{item.note}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] text-[#A8A8A8]">
                  {statusIcon(item.ui)} UI: {statusText(item.ui)}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#A8A8A8]">
                  {statusIcon(item.api)} API: {statusText(item.api)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-2 text-[11px] text-[#6E6E6E]">
        Core active steps: {PROCESS_CORE_ELEMENTS.length} | Legacy kept: {PROCESS_LEGACY_ELEMENTS.length}
      </div>
    </div>
  )
}
