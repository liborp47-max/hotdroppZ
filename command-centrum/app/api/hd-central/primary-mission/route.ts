import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import type {
  KeyResult,
  OKR,
  PrimaryMission,
  PrimaryMissionDoc,
} from '@/lib/hd-central/types'

// PLAN HQ — Primary Mission CRUD. Singleton strategic document, JSON-backed
// (NOTES/primary-mission.json), following the plan/rns route conventions.

const FILE = path.join(process.cwd(), '..', 'NOTES', 'primary-mission.json')

function emptyDoc(): PrimaryMissionDoc {
  return { version: 1, updatedAt: new Date().toISOString(), mission: null }
}

function readDoc(): PrimaryMissionDoc {
  if (!fs.existsSync(FILE)) return emptyDoc()
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as PrimaryMissionDoc
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      mission: parsed.mission ?? null,
    }
  } catch {
    return emptyDoc()
  }
}

function writeDoc(doc: PrimaryMissionDoc) {
  const dir = path.dirname(FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 2), 'utf-8')
}

// ─── sanitizers — never trust client payloads ───────────────────────────────

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function clampPercent(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function normalizeKeyResult(v: unknown): KeyResult {
  const kr = (v ?? {}) as Record<string, unknown>
  return {
    id: asString(kr.id) || randomUUID(),
    description: asString(kr.description),
    progress: clampPercent(kr.progress),
  }
}

function normalizeOkr(v: unknown): OKR {
  const okr = (v ?? {}) as Record<string, unknown>
  return {
    id: asString(okr.id) || randomUUID(),
    objective: asString(okr.objective),
    keyResults: Array.isArray(okr.keyResults) ? okr.keyResults.map(normalizeKeyResult) : [],
  }
}

function normalizeOkrs(v: unknown): OKR[] {
  return Array.isArray(v) ? v.map(normalizeOkr) : []
}

/** Build a full PrimaryMission from raw input, preserving identity of an existing record. */
function normalizeMission(
  input: Record<string, unknown>,
  existing: PrimaryMission | null,
): PrimaryMission {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? (asString(input.id) || randomUUID()),
    title: asString(input.title).trim(),
    description: asString(input.description),
    successMetrics: asStringArray(input.successMetrics),
    targetAudience: asString(input.targetAudience),
    okrs: normalizeOkrs(input.okrs),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

// ─── handlers ────────────────────────────────────────────────────────────────

// GET — read the current Primary Mission (mission may be null).
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json(readDoc())
  } catch (e) {
    console.error('[primary-mission] GET error:', e)
    return NextResponse.json({ error: 'Failed to load primary mission' }, { status: 500 })
  }
}

// PUT — create or fully replace the Primary Mission.
export async function PUT(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (!asString(body.title).trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const current = readDoc()
    const mission = normalizeMission(body, current.mission)
    const doc: PrimaryMissionDoc = {
      version: current.version || 1,
      updatedAt: new Date().toISOString(),
      mission,
    }
    writeDoc(doc)
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[primary-mission] PUT error:', e)
    return NextResponse.json({ error: 'Failed to save primary mission' }, { status: 500 })
  }
}

// PATCH — partial update of the existing Primary Mission.
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const current = readDoc()
    if (!current.mission) {
      return NextResponse.json({ error: 'No primary mission to update' }, { status: 404 })
    }
    const merged: Record<string, unknown> = {
      ...current.mission,
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      ...('successMetrics' in body ? { successMetrics: body.successMetrics } : {}),
      ...(typeof body.targetAudience === 'string' ? { targetAudience: body.targetAudience } : {}),
      ...('okrs' in body ? { okrs: body.okrs } : {}),
    }
    if (!asString(merged.title).trim()) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }
    const mission = normalizeMission(merged, current.mission)
    const doc: PrimaryMissionDoc = {
      version: current.version || 1,
      updatedAt: new Date().toISOString(),
      mission,
    }
    writeDoc(doc)
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[primary-mission] PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update primary mission' }, { status: 500 })
  }
}

// DELETE — clear the Primary Mission.
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const current = readDoc()
    const doc: PrimaryMissionDoc = {
      version: current.version || 1,
      updatedAt: new Date().toISOString(),
      mission: null,
    }
    writeDoc(doc)
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[primary-mission] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete primary mission' }, { status: 500 })
  }
}
