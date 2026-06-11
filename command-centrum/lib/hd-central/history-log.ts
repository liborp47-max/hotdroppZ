import fs from 'fs'
import path from 'path'

// Silent fallback logger — keeps this module a pure leaf so node:test can import it.
// Production wrappers (route handlers) own their own structured logging.
const localWarn = (msg: string, meta?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
     
    console.warn(`[history-log] ${msg}`, meta ?? '')
  }
}

export interface HistoryEntry {
  ts: string
  event: string
  note?: string
}

export interface RawHistoryRow {
  ts: string
  category: string
  section: string
  event: string
  meta: Record<string, string>
}

// Parse one TSV line: ts \t category \t section \t event [\t k=v]*
export function parseHistoryLine(line: string): RawHistoryRow | null {
  const parts = line.split('\t')
  if (parts.length < 4) return null
  const meta: Record<string, string> = {}
  for (let i = 4; i < parts.length; i++) {
    const eqIdx = parts[i].indexOf('=')
    if (eqIdx > 0) {
      meta[parts[i].slice(0, eqIdx)] = parts[i].slice(eqIdx + 1)
    }
  }
  return {
    ts: parts[0],
    category: parts[1],
    section: parts[2],
    event: parts[3],
    meta,
  }
}

// Read last N lines as TSV rows. Empty array on missing file.
export function readHistoryTail(filePath: string, n: number): RawHistoryRow[] {
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((l) => l.length > 0)
    const tail = lines.slice(-n)
    const rows: RawHistoryRow[] = []
    for (const line of tail) {
      const r = parseHistoryLine(line)
      if (r) rows.push(r)
    }
    return rows
  } catch (e) {
    localWarn('read failed', { filePath, error: (e as Error).message })
    return []
  }
}

// Public-facing shape used by stage/worker detail endpoints.
export function toHistoryEntry(row: RawHistoryRow): HistoryEntry {
  const noteBits: string[] = []
  for (const [k, v] of Object.entries(row.meta)) {
    noteBits.push(`${k}=${v}`)
  }
  return {
    ts: row.ts,
    event: row.event,
    note: noteBits.length > 0 ? noteBits.join(' ') : undefined,
  }
}

// Append one entry. Creates parent dir if missing. Never throws.
export function appendHistoryEntry(
  sectionDir: string,
  category: string,
  section: string,
  event: string,
  meta: Record<string, string> = {}
): boolean {
  try {
    if (!fs.existsSync(sectionDir)) fs.mkdirSync(sectionDir, { recursive: true })
    const file = path.join(sectionDir, 'history.log')
    const ts = new Date().toISOString()
    const metaParts = Object.entries(meta)
      .map(([k, v]) => `${k}=${String(v).replace(/[\t\n]/g, ' ')}`)
      .join('\t')
    const line = metaParts.length > 0
      ? `${ts}\t${category}\t${section}\t${event}\t${metaParts}\n`
      : `${ts}\t${category}\t${section}\t${event}\n`
    fs.appendFileSync(file, line, 'utf-8')
    return true
  } catch (e) {
    localWarn('append failed', {
      sectionDir,
      section,
      event,
      error: (e as Error).message,
    })
    return false
  }
}
