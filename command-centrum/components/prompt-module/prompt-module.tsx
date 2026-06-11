'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Copy, Save, X, RotateCcw, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

export function PromptModule() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // AUD-UI-002: Esc/focus-trap/scroll-lock/role for the header prompt modal.
  const dialogRef = useModalA11y<HTMLDivElement>(open, close)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qualityScore, setQualityScore] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  async function generate() {
    if (!input.trim()) return
    setLoading(true)
    setOutput('')
    setQualityScore(null)
    try {
      const res = await fetch('/api/prompt-module/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      })
      if (!res.ok) { setOutput('[Error: generation failed]'); return }
      const data = await res.json()
      setOutput(data?.output ?? '[Error: invalid generator response]')
      setQualityScore(typeof data?.qualityScore === 'number' ? data.qualityScore : null)
    } catch {
      setOutput('[Error: could not reach Prompt Agent]')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!input.trim() && !output.trim()) return
    setSaved(false)
    await fetch('/api/prompt-module/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, output }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCopy() {
    navigator.clipboard.writeText(output || input)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setInput('')
    setOutput('')
    setCopied(false)
    setSaved(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative p-1.5 transition-colors',
          open ? 'text-orange-400 bg-white/5' : 'text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/5'
        )}
        title="Prompt Module"
        aria-label="Open Prompt Module"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" onClick={close} />

          {/* Window — centered modal */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="AI prompt assistant"
            tabIndex={-1}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-60 w-135 max-h-[90vh] flex flex-col border border-white/15 bg-[#080808] shadow-2xl shadow-black/80 overflow-hidden outline-none"
          >

            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 shrink-0">
              <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-sm font-semibold text-[#E8E8E8] flex-1">Prompt Module</span>
              <span className="text-[10px] text-[#6E6E6E] font-mono uppercase tracking-widest">HDCC</span>
              <button onClick={() => setOpen(false)} className="p-1 text-[#6E6E6E] hover:text-[#D0D0D0] hover:bg-white/5 transition-colors" aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider">Vaše zadání</label>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder="Napiš co chceš udělat…"
                  rows={4}
                  className="w-full resize-none border border-white/10 bg-white/3 backdrop-blur-md px-3 py-2.5 text-sm text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-colors"
                />
              </div>

              <button
                onClick={generate}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center gap-2 h-9 bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>Generuji…</span></>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /><span>Generovat prompt</span><span className="text-[10px] opacity-60 font-normal">Ctrl+Enter</span></>
                )}
              </button>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider">Výstup</label>
                {qualityScore !== null && (
                  <div className="text-[11px] text-[#A8A8A8]">
                    Quality score: <span className="text-[#D0D0D0]">{Math.round(qualityScore * 100)}%</span>
                  </div>
                )}
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  placeholder="Tady se objeví vygenerovaný prompt…"
                  rows={6}
                  className="w-full resize-none border border-white/10 bg-white/3 backdrop-blur-md px-3 py-2.5 text-sm text-[#D0D0D0] placeholder:text-[#404040] focus:outline-none focus:border-white/15 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleCopy} disabled={!output && !input} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-white/3 backdrop-blur-md text-xs font-medium text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/15 disabled:opacity-40 transition-colors">
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-[#00E085]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Zkopírováno' : 'Kopírovat'}
                </button>
                <button onClick={handleSave} disabled={!input.trim()} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-white/3 backdrop-blur-md text-xs font-medium text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/15 disabled:opacity-40 transition-colors">
                  {saved ? <CheckCheck className="h-3.5 w-3.5 text-[#00E085]" /> : <Save className="h-3.5 w-3.5" />}
                  {saved ? 'Uloženo' : 'Uložit'}
                </button>
                <button onClick={handleReset} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6E6E6E] hover:text-[#A8A8A8] transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
