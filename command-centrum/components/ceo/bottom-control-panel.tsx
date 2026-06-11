'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Send, Edit3, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomControlPanel() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  return (
    <div
      className={cn(
        'border-t border-[#1F1F1F] transition-all shrink-0',
        open ? 'h-44' : 'h-9'
      )}
      style={{
        background: 'linear-gradient(180deg, #0C0C0C 0%, #060606 100%)',
        boxShadow: open ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 -8px 24px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 px-4 flex items-center gap-2 text-[#6E6E6E] hover:text-[#E8E8E8] transition-colors"
      >
        <Sliders className="h-3 w-3 text-[#00E085]" />
        <span className="section-title">Control Panel</span>
        <span className="text-[10px] font-mono normal-case tracking-normal text-[#4A4A4A]">prompt · edit · settings</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex gap-3 h-[calc(100%-2.25rem)]">
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Send className="h-3 w-3 text-[#00E085]" />
              <span className="section-title">Quick Prompt</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="plastic-input flex-1 text-[11px] px-2 py-1.5 resize-none placeholder:text-[#4A4A4A]"
              placeholder="Type prompt..."
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Edit3 className="h-3 w-3 text-[#00E085]" />
              <span className="section-title">Edit Mode</span>
            </div>
            <div className="plastic-input flex-1 text-[11px] text-[#6E6E6E] px-2 py-1.5 italic">
              Select a mission, then edit its fields inline from the detail drawer.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
