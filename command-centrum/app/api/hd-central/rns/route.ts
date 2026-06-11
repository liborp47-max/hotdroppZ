import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export type RnsHorizon = 'today' | 'week' | 'sprint'

export type RnsItem = {
  id: string
  title: string
  why: string
  agent: string
  missionRef?: string
  confidence: number
  horizon: RnsHorizon
  createdAt: string
}

export type RnsFeed = {
  version: number
  updatedAt: string
  items: RnsItem[]
}

const RNS_FILE = path.join(process.cwd(), '..', 'NOTES', 'rns.json')
const MAX_ITEMS = 50

function emptyFeed(): RnsFeed {
  return { version: 1, updatedAt: new Date().toISOString(), items: [] }
}

function readFeed(): RnsFeed {
  if (!fs.existsSync(RNS_FILE)) return emptyFeed()
  try {
    const parsed = JSON.parse(fs.readFileSync(RNS_FILE, 'utf-8')) as RnsFeed
    if (!Array.isArray(parsed.items)) return emptyFeed()
    return { ...parsed, items: parsed.items }
  } catch {
    return emptyFeed()
  }
}

function writeFeed(feed: RnsFeed) {
  const dir = path.dirname(RNS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(RNS_FILE, JSON.stringify(feed, null, 2), 'utf-8')
}

function dedupeKey(item: Pick<RnsItem, 'agent' | 'title'>): string {
  return `${item.agent.trim().toLowerCase()}::${item.title.trim().toLowerCase()}`
}

function clampConfidence(n: unknown): number {
  const v = typeof n === 'number' ? n : 0.5
  if (Number.isNaN(v)) return 0.5
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function normalizeHorizon(value: unknown): RnsHorizon {
  if (value === 'today' || value === 'week' || value === 'sprint') return value
  return 'today'
}

export async function GET() {
  try {
    const feed = readFeed()
    return NextResponse.json(feed)
  } catch (e) {
    console.error('[rns] GET error:', e)
    return NextResponse.json({ error: 'Failed to load RNS' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: Partial<RnsItem>[]
      replace?: boolean
    }

    const incoming = Array.isArray(body.items) ? body.items : []
    if (incoming.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const cleaned: RnsItem[] = incoming
      .filter((raw) => raw && typeof raw.title === 'string' && typeof raw.agent === 'string')
      .map((raw, idx) => ({
        id: raw.id ?? `RNS-${Date.now().toString(36)}-${idx}`,
        title: String(raw.title).trim(),
        why: typeof raw.why === 'string' ? raw.why.trim() : '',
        agent: String(raw.agent).trim(),
        missionRef: raw.missionRef ? String(raw.missionRef) : undefined,
        confidence: clampConfidence(raw.confidence),
        horizon: normalizeHorizon(raw.horizon),
        createdAt: raw.createdAt ?? now,
      }))

    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'No valid items' }, { status: 400 })
    }

    const current = readFeed()
    const base = body.replace ? [] : current.items
    const seen = new Map<string, RnsItem>()
    for (const item of base) seen.set(dedupeKey(item), item)
    for (const item of cleaned) seen.set(dedupeKey(item), item)

    const merged = Array.from(seen.values())
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence
        return b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, MAX_ITEMS)

    const nextFeed: RnsFeed = { version: 1, updatedAt: now, items: merged }
    writeFeed(nextFeed)
    return NextResponse.json(nextFeed)
  } catch (e) {
    console.error('[rns] POST error:', e)
    return NextResponse.json({ error: 'Failed to save RNS' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      writeFeed(emptyFeed())
      return NextResponse.json(emptyFeed())
    }
    const current = readFeed()
    const next: RnsFeed = {
      version: current.version,
      updatedAt: new Date().toISOString(),
      items: current.items.filter((item) => item.id !== id),
    }
    writeFeed(next)
    return NextResponse.json(next)
  } catch (e) {
    console.error('[rns] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete RNS item' }, { status: 500 })
  }
}
