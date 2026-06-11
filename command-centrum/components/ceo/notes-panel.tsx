'use client'

import { useState, useEffect, useCallback } from 'react'
import { StickyNote, Plus, X } from 'lucide-react'

type Note = { id: string; content: string; createdAt: string }

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/hd-central/notes')
      if (r.ok) setNotes(await r.json())
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!draft.trim()) return
    setLoading(true)
    try {
      await fetch('/api/hd-central/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      })
      setDraft('')
      await load()
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await fetch(`/api/hd-central/notes/${id}`, { method: 'DELETE' })
      await load()
    } catch {}
  }

  return (
    <div className="plastic-card flex flex-col overflow-hidden">
      <header className="px-3.5 py-2.5 border-b border-[#1F1F1F] flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-[#00E085]" />
        <span className="section-title">Notes</span>
        <span className="ml-auto text-[10px] text-[#6E6E6E] font-mono">{notes.length}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {notes.length === 0 && (
          <div className="text-[11px] text-[#6E6E6E] px-1 py-2 italic">No notes yet.</div>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="group plastic-tab flex items-start gap-1.5 px-2.5 py-1.5 text-[11px] text-[#E8E8E8] leading-snug"
          >
            <span className="flex-1 break-words whitespace-pre-wrap">{n.content}</span>
            <button
              onClick={() => remove(n.id)}
              className="opacity-0 group-hover:opacity-100 text-[#6E6E6E] hover:text-[#FF5A5A] shrink-0 transition-opacity"
              title="Delete"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-[#1F1F1F] p-2 flex gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Quick note... (Ctrl+Enter to add)"
          rows={2}
          className="plastic-input flex-1 text-[11px] placeholder:text-[#4A4A4A] px-2 py-1.5 resize-none"
        />
        <button
          onClick={submit}
          disabled={loading || !draft.trim()}
          className="plastic-button-venom px-2.5 flex items-center justify-center"
          title="Add note"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
