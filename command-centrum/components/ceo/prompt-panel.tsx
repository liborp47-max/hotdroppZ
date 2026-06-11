'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, Bot, StickyNote, X, Copy } from 'lucide-react'

type Note = { id: string; content: string; createdAt: string }

export function PromptPanel({ onSubmit }: { onSubmit?: (text: string) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  const loadNotes = useCallback(async () => {
    try {
      const r = await fetch('/api/hd-central/notes')
      if (r.ok) setNotes(await r.json())
    } catch {}
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const submit = () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    onSubmit?.(value)
    setText('')
    setTimeout(() => {
      setSending(false)
      loadNotes()
    }, 300)
  }

  const saveAsNote = async () => {
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      await fetch('/api/hd-central/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      await loadNotes()
    } finally {
      setLoading(false)
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await fetch(`/api/hd-central/notes/${id}`, { method: 'DELETE' })
      await loadNotes()
    } catch {}
  }

  const copyToEditor = (content: string) => {
    setText(content)
  }

  return (
    <div className="plastic-card flex flex-col overflow-hidden">
      <header className="px-3.5 py-2.5 border-b border-[#1F1F1F] flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-[#00E085]" />
        <span className="section-title">Prompt to CEO</span>
      </header>

      {/* Main content: two panels */}
      <div className="flex-1 flex min-h-0 divide-x divide-[#1F1F1F]">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col p-2 gap-2 min-h-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Describe a problem or request... (Ctrl+Enter to send)"
            className="plastic-input flex-1 min-h-0 text-[11px] placeholder:text-[#4A4A4A] px-2 py-1.5 resize-none"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={submit}
              disabled={sending || !text.trim()}
              className="plastic-button-venom px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
            >
              <Send className="h-3 w-3" />
              {sending ? 'Sending' : 'Send'}
            </button>
            <button
              onClick={saveAsNote}
              disabled={loading || !text.trim()}
              className="plastic-button px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest"
              title="Save to notes"
            >
              Save
            </button>
          </div>
        </div>

        {/* Right: Saved notes */}
        <div className="w-48 flex flex-col min-h-0">
          <div className="px-2 py-1.5 border-b border-[#1F1F1F] flex items-center gap-2">
            <StickyNote className="h-3.5 w-3.5 text-[#00E085]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
            <span className="ml-auto text-[10px] text-[#6E6E6E] font-mono">{notes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {notes.length === 0 && (
              <div className="text-[10px] text-[#6E6E6E] px-1 py-2 italic">No saved texts</div>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="group plastic-tab flex items-start gap-1 px-2 py-1.5 text-[10px] text-[#E8E8E8] leading-snug hover:bg-[#0A0A0A] cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="break-words whitespace-pre-wrap line-clamp-3">{n.content}</p>
                  <span className="text-[9px] text-[#4A4A4A] mt-0.5 block">
                    {new Date(n.createdAt).toLocaleDateString('cs-CZ', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToEditor(n.content)
                    }}
                    className="text-[#6E6E6E] hover:text-[#00E085] p-1"
                    title="Copy to editor"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(n.id)
                    }}
                    className="text-[#6E6E6E] hover:text-[#FF5A5A] p-1"
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
