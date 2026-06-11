/**
 * Ops alerting — best-effort outbound notification for pipeline/cron failures.
 *
 * Posts a Slack/Discord-compatible `{ text }` payload to OPS_ALERT_WEBHOOK_URL.
 * Design goals (match the "AI fallback / never crash" pipeline rule):
 *   - Never throws — callers treat alerting as fire-and-forget.
 *   - No-op (not an error) when no webhook is configured.
 *   - Bounded: 4s timeout so a hung webhook can't stall a cron invocation.
 *
 * Pure formatting helpers (`alertEmoji`, `formatOpsAlert`) are exported for
 * unit testing without network I/O.
 */

export type OpsAlertSeverity = 'info' | 'warn' | 'error'

export interface OpsAlert {
  /** Short headline, e.g. "Pipeline B — 1 stage failed". */
  title: string
  severity: OpsAlertSeverity
  /** Human-readable body (newlines allowed). */
  text: string
  /** Optional structured context appended as compact key=value lines. */
  context?: Record<string, unknown>
}

export interface OpsAlertResult {
  sent: boolean
  /** Why it did not send (when sent === false). */
  reason?: string
}

const SEVERITY_EMOJI: Record<OpsAlertSeverity, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '🚨',
}

const WEBHOOK_TIMEOUT_MS = 4000

/** Severity → leading emoji (pure). */
export function alertEmoji(severity: OpsAlertSeverity): string {
  return SEVERITY_EMOJI[severity] ?? SEVERITY_EMOJI.info
}

/**
 * Render an OpsAlert into the single `text` string both Slack and Discord
 * incoming webhooks accept. Pure — no I/O.
 */
export function formatOpsAlert(alert: OpsAlert): string {
  const lines = [`${alertEmoji(alert.severity)} *${alert.title}*`, alert.text]
  if (alert.context && Object.keys(alert.context).length > 0) {
    const ctx = Object.entries(alert.context)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ')
    lines.push(`\`${ctx}\``)
  }
  return lines.join('\n')
}

/**
 * Best-effort POST of an alert to OPS_ALERT_WEBHOOK_URL.
 * Returns { sent: false, reason } instead of throwing on any failure.
 */
export async function sendOpsAlert(alert: OpsAlert): Promise<OpsAlertResult> {
  const url = process.env.OPS_ALERT_WEBHOOK_URL
  if (!url) {
    return { sent: false, reason: 'no_webhook_configured' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: formatOpsAlert(alert) }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { sent: false, reason: `webhook_status_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'webhook_error',
    }
  } finally {
    clearTimeout(timer)
  }
}
