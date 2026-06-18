'use client'

import { X, Sparkles } from 'lucide-react'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

export type IntelResultSection = {
  title: string
  items: string[]
}

export type IntelResultModalData = {
  title: string
  summary: string
  badges?: string[]
  sections: IntelResultSection[]
}

export function IntelResultModal({
  open,
  data,
  onClose,
}: {
  open: boolean
  data: IntelResultModalData | null
  onClose: () => void
}) {
  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock (called unconditionally).
  const dialogRef = useModalA11y<HTMLDivElement>(open && !!data, onClose)

  if (!open || !data) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Get Intel result"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Get Intel Result</span>
            </div>
            <h3 className="mt-2 text-lg font-bold text-[#E8E8E8]">{data.title}</h3>
            <p className="mt-1 text-sm text-[#A8A8A8]">{data.summary}</p>
            {data.badges && data.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#D0D0D0]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-[#A8A8A8] transition-colors hover:bg-white/[0.03] backdrop-blur-md hover:text-[#E8E8E8]"
            aria-label="Close intel result"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {data.sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A8A8A8]">{section.title}</h4>
              {section.items.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="text-sm text-[#E8E8E8]">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#A8A8A8]">No data.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
