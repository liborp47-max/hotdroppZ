'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NoteDetail, NoteListItem } from '@/lib/hd-central/types'

const STORAGE_KEY = 'hd-central:notes'

type CreateNoteInput = {
  title: string
  content: string
  author: string
}

function toListItem(note: NoteDetail): NoteListItem {
  return {
    id: note.id,
    title: note.title,
    preview: note.content.slice(0, 140),
    updatedAt: note.updatedAt,
  }
}

export function useNotes() {
  const [rawNotes, setRawNotes] = useState<NoteDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as NoteDetail[]) : []
      setRawNotes(Array.isArray(parsed) ? parsed : [])
      setError(null)
    } catch {
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  const persist = useCallback((next: NoteDetail[]) => {
    setRawNotes(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const createNote = useCallback(async (input: CreateNoteInput) => {
    const now = new Date().toISOString()
    const note: NoteDetail = {
      id: `note-${Date.now()}`,
      title: input.title.trim() || 'Untitled note',
      content: input.content,
      author: input.author.trim() || 'SYSTEM AUDITOR',
      preview: input.content.slice(0, 140),
      updatedAt: now,
    }
    persist([note, ...rawNotes])
  }, [persist, rawNotes])

  const getNote = useCallback(async (id: string): Promise<NoteDetail | null> => {
    return rawNotes.find((note) => note.id === id) ?? null
  }, [rawNotes])

  const deleteNote = useCallback(async (id: string) => {
    persist(rawNotes.filter((note) => note.id !== id))
  }, [persist, rawNotes])

  return {
    notes: rawNotes.map(toListItem),
    loading,
    error,
    createNote,
    getNote,
    deleteNote,
  }
}
