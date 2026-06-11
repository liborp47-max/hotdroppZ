import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const NOTES_DIR = path.join(process.cwd(), '..', 'NOTES')

function ensureDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true })
  }
}

function listNotes() {
  ensureDir()
  const files = fs.readdirSync(NOTES_DIR).filter((f) => f.startsWith('ceo-note-') && f.endsWith('.json'))
  return files
    .map((f) => {
      try {
        const raw = fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8')
        return JSON.parse(raw)
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function GET() {
  try {
    const notes = listNotes()
    return NextResponse.json(notes)
  } catch (error) {
    console.error('[notes] GET error:', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json()
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }
    ensureDir()
    const id = randomUUID()
    const note = { id, content: content.trim(), createdAt: new Date().toISOString() }
    fs.writeFileSync(path.join(NOTES_DIR, `ceo-note-${id}.json`), JSON.stringify(note, null, 2), 'utf-8')
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('[notes] POST error:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
}
