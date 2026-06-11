'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bomb, Loader2, X } from 'lucide-react'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

export type PipelineStepOption = {
  key: string
  label: string
}

export function PipelineNukeModal({
  open,
  isDeleting,
  onClose,
  onConfirm,
  steps,
}: {
  open: boolean
  isDeleting: boolean
  onClose: () => void
  onConfirm: (selection: { nukeAll: boolean; steps: string[] }) => Promise<void>
  steps: PipelineStepOption[]
}) {
  const [nukeAll, setNukeAll] = useState(true)
  const [selectedSteps, setSelectedSteps] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setNukeAll(true)
    setSelectedSteps([])
  }, [open])

  const canConfirm = nukeAll || selectedSteps.length > 0

  const uniqueSteps = useMemo(() => {
    const seen = new Set<string>()
    return steps.filter((step) => {
      if (seen.has(step.key)) return false
      seen.add(step.key)
      return true
    })
  }, [steps])

  function toggleStep(stepKey: string) {
    setSelectedSteps((prev) =>
      prev.includes(stepKey)
        ? prev.filter((item) => item !== stepKey)
        : [...prev, stepKey]
    )
  }

  // AUD-UI-002: Esc/focus-trap/scroll-lock/role. Hook is called unconditionally
  // above the early return (Rules of Hooks); it no-ops while closed.
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Delete pipeline data"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black shadow-2xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2 text-orange-300">
              <Bomb className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Nuke Pipeline</span>
            </div>
            <p className="mt-2 text-sm text-[#A8A8A8]">
              Choose full nuke or select exact pipeline step data to delete.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.03] backdrop-blur-md transition-colors"
            aria-label="Close delete modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm text-[#E8E8E8]">
            <input
              type="radio"
              name="delete-mode"
              checked={nukeAll}
              onChange={() => setNukeAll(true)}
              className="h-4 w-4 border-white/15 bg-white/[0.03] backdrop-blur-md text-orange-400"
            />
            Nuke all pipeline data
          </label>

          <label className="flex items-center gap-2 text-sm text-[#E8E8E8]">
            <input
              type="radio"
              name="delete-mode"
              checked={!nukeAll}
              onChange={() => setNukeAll(false)}
              className="h-4 w-4 border-white/15 bg-white/[0.03] backdrop-blur-md text-orange-400"
            />
            Choose pipeline steps to delete
          </label>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {uniqueSteps.map((step) => {
                const checked = selectedSteps.includes(step.key)
                return (
                  <label key={step.key} className="flex items-center gap-2 border border-white/10 bg-black px-2.5 py-2 text-xs text-[#D0D0D0]">
                    <input
                      type="checkbox"
                      disabled={nukeAll}
                      checked={checked}
                      onChange={() => toggleStep(step.key)}
                      className="h-3.5 w-3.5 border-white/15 bg-white/[0.03] backdrop-blur-md text-orange-400 disabled:opacity-50"
                    />
                    Delete {step.label} data
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || isDeleting}
            onClick={() => onConfirm({ nukeAll, steps: selectedSteps })}
            className="inline-flex items-center gap-1.5 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirm delete
          </button>
        </div>
      </div>
    </div>
  )
}
