'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Copy, Loader2, Save, Sparkles, X } from 'lucide-react'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

export interface PromptDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  prompt: string | null
  loading: boolean
  qualityScore?: number
  targetModule?: string
  owner?: string
  agents?: string[]
  tools?: string[]
  onSave?: (prompt: string) => Promise<void> | void
}

export function PromptDialog(props: PromptDialogProps) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Portal target only exists on the client; gate render until mounted so the
  // overlay can be portaled to document.body (escapes any ancestor stacking
  // context — e.g. the tab panel's transform/backdrop — that was trapping it
  // behind the tabs).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // AUD-UI-002: Esc-close + focus-trap + focus-restore + scroll-lock + dialog role.
  const dialogRef = useModalA11y<HTMLDivElement>(props.open, props.onClose)

  if (!props.open || !mounted) return null

  const copy = async () => {
    if (!props.prompt) return
    try {
      await navigator.clipboard?.writeText(props.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const save = async () => {
    if (!props.prompt || !props.onSave) return
    setSaving(true)
    try {
      await props.onSave(props.prompt)
      setSavedAt(new Date().toISOString())
    } finally {
      setSaving(false)
    }
  }

  const qualityPct = props.qualityScore !== undefined ? Math.round(props.qualityScore * 100) : null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={props.onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={props.title || 'Generated prompt'}
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[90vh] plastic-card border border-white/10 flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3 shrink-0">
          <Sparkles className="h-4 w-4 text-[#00E085]" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#00E085]">Generated Prompt</p>
            <p className="text-sm text-[#E8E8E8] truncate">{props.title}</p>
            {props.subtitle && (
              <p className="text-[11px] text-[#A8A8A8] truncate">{props.subtitle}</p>
            )}
          </div>
          {qualityPct !== null && (
            <span
              className={
                'inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono ' +
                (qualityPct >= 85
                  ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                  : qualityPct >= 65
                    ? 'border-amber-500/35 bg-amber-500/12 text-amber-300'
                    : 'border-red-500/35 bg-red-500/12 text-red-300')
              }
              title="Prompt quality score"
            >
              Q {qualityPct}%
            </span>
          )}
          {props.targetModule && (
            <span className="text-[10px] font-mono text-[#A8A8A8] px-1.5 py-0.5 border border-white/10 bg-white/[0.03]">
              {props.targetModule}
            </span>
          )}
          {props.owner && (
            <span className="text-[10px] font-mono text-[#1AEE99] px-1.5 py-0.5 border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)]">
              @{props.owner}
            </span>
          )}
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="h-7 w-7 inline-flex items-center justify-center text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Agents/Tools chips (for mission-level) */}
        {(props.agents?.length || props.tools?.length) && (
          <div className="px-4 py-2 border-b border-white/10 flex flex-wrap items-center gap-1.5 text-[10px] shrink-0">
            {props.agents?.map((a) => (
              <span
                key={a}
                className="px-1.5 py-0.5 border border-[#00E085]/25 bg-[rgba(0,224,133,0.06)] text-[#1AEE99] font-mono"
              >
                @{a}
              </span>
            ))}
            <span className="text-[#404040]">|</span>
            {props.tools?.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 border border-white/10 bg-white/[0.03] text-[#A8A8A8] font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {props.loading ? (
            <div className="flex items-center justify-center py-12 text-[#A8A8A8] text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> generuji prompt…
            </div>
          ) : props.prompt ? (
            <pre className="text-[11px] font-mono text-[#D0D0D0] whitespace-pre-wrap leading-relaxed bg-black/40 border border-white/10 p-3">
              {props.prompt}
            </pre>
          ) : (
            <div className="text-[#6E6E6E] text-sm text-center py-12 italic">
              No prompt generated yet.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <footer className="px-4 py-3 border-t border-white/10 flex items-center gap-2 shrink-0">
          {savedAt && (
            <span className="text-[10px] text-[#1AEE99] flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          <span className="ml-auto" />
          <button
            type="button"
            onClick={copy}
            disabled={!props.prompt || props.loading}
            className="px-3 py-1.5 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#D0D0D0] hover:bg-white/[0.06] flex items-center gap-1.5 disabled:opacity-40"
          >
            {copied ? <CheckCircle2 className="h-3 w-3 text-[#00E085]" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {props.onSave && (
            <button
              type="button"
              onClick={save}
              disabled={!props.prompt || props.loading || saving}
              className="plastic-button-venom px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
          )}
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-1.5 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
