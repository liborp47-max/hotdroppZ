'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ChevronDown, ChevronUp, Info, X } from 'lucide-react'
import { useAlerts, type AlertsResponse } from './use-alerts'

// ─────────────────────────────────────────────────────────────────────────────
// AlertCenter — Option A: dashboard-wide banner under the CEO header.
// Critical failures must be impossible to miss across all three CEO tabs, so
// the banner sits above the TabBar rather than hiding behind the header bell.
// Polls /api/hd-central/alerts every 30s via useAlerts.
//
// Behaviour:
//   - 0 alerts        → renders nothing (no empty strip)
//   - 1+ critical     → red banner, critical rows inline, others under expand
//   - warning/info    → slim amber/cyan banner, collapsed by default
//   - per-alert dismiss persisted in sessionStorage (alert returns on reload
//     while still active — dismiss is a "seen", not a "resolve")
// ─────────────────────────────────────────────────────────────────────────────

type Alert = AlertsResponse['alerts'][number]
type AlertSeverity = Alert['severity']

const RED = '#FF6B6B'
const AMBER = '#F59E0B'
const CYAN = '#00B4FF'

const DISMISS_KEY = 'hd-central:alert-dismissed:v1'

interface SeverityStyle {
  color: string
  border: string
  bg: string
  Icon: typeof AlertOctagon
}

const SEVERITY_STYLE: Record<AlertSeverity, SeverityStyle> = {
  critical: { color: RED, border: 'rgba(255,107,107,0.45)', bg: 'rgba(255,107,107,0.10)', Icon: AlertOctagon },
  warning: { color: AMBER, border: 'rgba(245,158,11,0.40)', bg: 'rgba(245,158,11,0.08)', Icon: AlertTriangle },
  info: { color: CYAN, border: 'rgba(0,180,255,0.40)', bg: 'rgba(0,180,255,0.08)', Icon: Info },
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return `před ${diff}s`
  if (diff < 3600) return `před ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)}h`
  return `před ${Math.floor(diff / 86400)}d`
}

// sessionStorage-backed dismiss memo. Dismissed ids survive tab switches but
// not a full reload — a still-active alert reappears, which is intentional.
function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
  } catch {
    // sessionStorage unavailable (private mode / quota) — dismiss stays in-memory only.
  }
}

interface AlertRowProps {
  alert: Alert
  onDismiss: (id: string) => void
}

function AlertRow({ alert, onDismiss }: AlertRowProps) {
  const style = SEVERITY_STYLE[alert.severity]
  const { Icon } = style
  const isCritical = alert.severity === 'critical'
  return (
    <div
      role={isCritical ? 'alert' : 'status'}
      aria-live={isCritical ? 'assertive' : 'polite'}
      className="flex items-start gap-2.5 px-3 py-2 border-t first:border-t-0"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <Icon aria-hidden className="h-4 w-4 mt-0.5 shrink-0" style={{ color: style.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-semibold" style={{ color: style.color }}>
            {alert.title}
          </span>
          {alert.stage && (
            <span
              className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border"
              style={{ color: style.color, borderColor: style.border }}
            >
              {alert.stage}
            </span>
          )}
          <span className="text-[10px] font-mono text-[#A8A8A8]">{alert.count}×</span>
          <span className="text-[10px] font-mono text-[#6E6E6E]">{timeAgo(alert.lastSeenAt)}</span>
        </div>
        <p className="text-[11px] text-[#C8C8C8] leading-snug mt-0.5">{alert.detail}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(alert.id)}
        aria-label={`Skrýt upozornění: ${alert.title}`}
        className="shrink-0 rounded border border-white/[0.10] p-0.5 text-[#6E6E6E] hover:text-[#E8E8E8] hover:border-white/25"
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </div>
  )
}

export function AlertCenter() {
  const { data } = useAlerts()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [expanded, setExpanded] = useState(false)

  // Hydrate dismiss memo after mount — sessionStorage is client-only.
  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      writeDismissed(next)
      return next
    })
  }, [])

  const visible = useMemo(
    () => (data?.alerts ?? []).filter((a) => !dismissed.has(a.id)),
    [data?.alerts, dismissed],
  )

  const critical = useMemo(() => visible.filter((a) => a.severity === 'critical'), [visible])
  const secondary = useMemo(() => visible.filter((a) => a.severity !== 'critical'), [visible])

  // Nothing to show → render nothing (no empty space under the header).
  if (visible.length === 0) return null

  const hasCritical = critical.length > 0
  const accent = hasCritical ? SEVERITY_STYLE.critical : SEVERITY_STYLE[secondary[0].severity]
  const headlineRows = hasCritical ? critical : secondary
  const collapsedRows = hasCritical ? secondary : []
  const collapsedCount = collapsedRows.length

  return (
    <section
      aria-label="Kritická upozornění pipeline"
      className="border-b"
      style={{ borderColor: accent.border, background: accent.bg }}
    >
      <div className="flex items-center gap-2 px-6 py-1.5">
        <accent.Icon aria-hidden className="h-3.5 w-3.5" style={{ color: accent.color }} />
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: accent.color }}>
          {hasCritical
            ? `${critical.length} kritick${critical.length === 1 ? 'é' : 'á'} selhání`
            : `${secondary.length} upozornění`}
        </span>
        {data?.degraded && (
          <span
            className="text-[9px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border border-white/15 text-[#A8A8A8]"
            title="Část detekčních dotazů selhala — zobrazená data mohou být neúplná."
          >
            partial data
          </span>
        )}
        {collapsedCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            {expanded ? (
              <>
                <ChevronUp aria-hidden className="h-3 w-3" /> skrýt detaily
              </>
            ) : (
              <>
                <ChevronDown aria-hidden className="h-3 w-3" /> +{collapsedCount} dalších
              </>
            )}
          </button>
        )}
      </div>

      <div className="pb-1">
        {headlineRows.map((a) => (
          <AlertRow key={a.id} alert={a} onDismiss={dismiss} />
        ))}
        {expanded &&
          collapsedRows.map((a) => (
            <AlertRow key={a.id} alert={a} onDismiss={dismiss} />
          ))}
      </div>
    </section>
  )
}
