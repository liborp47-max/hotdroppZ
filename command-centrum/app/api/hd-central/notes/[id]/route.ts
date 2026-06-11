import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const NOTES_DIR = path.join(process.cwd(), '..', 'NOTES')

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 })
    }
    const filePath = path.join(NOTES_DIR, `ceo-note-${id}.json`)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    fs.unlinkSync(filePath)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notes] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
