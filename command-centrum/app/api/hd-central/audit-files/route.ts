import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Resolve path relative to project root → up to system root → INFO/AUDITS
const AUDITS_ROOT = path.resolve(process.cwd(), '..', '..', 'INFO', 'AUDITS')

export type AuditFileMeta = {
  id: string
  type: string
  date: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: string
  ownerAgent: string
  title: string
  filePath: string
  relativePath: string
  findings: string[]
  actions: string[]
  checksum: string
}

function stripYaml(content: string): { meta: Record<string, unknown>; body: string } {
  if (!content.startsWith('---')) return { meta: {}, body: content }
  const end = content.indexOf('\n---', 4)
  if (end === -1) return { meta: {}, body: content }
  const yamlBlock = content.slice(4, end)
  const body = content.slice(end + 4).trim()
  const meta: Record<string, unknown> = {}
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    meta[key] = val
  }
  return { meta, body }
}

function extractAuditMeta(content: string): Record<string, string> {
  // Try nested audit_meta block in frontmatter
  const result: Record<string, string> = {}
  if (!content.startsWith('---')) return result
  const end = content.indexOf('\n---', 4)
  if (end === -1) return result
  const yamlBlock = content.slice(4, end)
  let inAuditMeta = false
  for (const line of yamlBlock.split('\n')) {
    if (line.trim() === 'audit_meta:') { inAuditMeta = true; continue }
    if (inAuditMeta && line.startsWith('  ')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      result[key] = val
    } else if (inAuditMeta && !line.startsWith('  ') && line.trim()) {
      inAuditMeta = false
    }
  }
  return result
}

function extractFindings(body: string): string[] {
  const findings: string[] = []
  const lines = body.split('\n')
  let inFindings = false
  for (const line of lines) {
    if (/^#{1,3}\s.*(nalezy|findings|nález)/i.test(line)) { inFindings = true; continue }
    if (inFindings && /^#{1,3}\s/.test(line)) inFindings = false
    if (inFindings && /^[-*]\s/.test(line)) findings.push(line.replace(/^[-*]\s+/, '').trim())
  }
  return findings.slice(0, 10)
}

function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
  return Math.abs(h).toString(16).slice(0, 8)
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walkDir(full))
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full)
  }
  return results
}

export async function GET() {
  try {
    const files = walkDir(AUDITS_ROOT)
    const audits: AuditFileMeta[] = []

    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath).toLowerCase()
        if (fileName === 'index.md' || fileName.startsWith('prompt-') || fileName.startsWith('prompt_')) {
          continue
        }

        const raw = fs.readFileSync(filePath, 'utf-8')
        const { body } = stripYaml(raw)
        const auditMeta = extractAuditMeta(raw)
        const hasStructuredAuditMeta = Boolean(auditMeta['id'])
        const looksLikeAuditFile = fileName.startsWith('audit-')
        if (!hasStructuredAuditMeta && !looksLikeAuditFile) {
          continue
        }

        const relative = path.relative(AUDITS_ROOT, filePath).replace(/\\/g, '/')
        const segments = relative.split('/')
        const type = segments.length >= 2 ? segments[segments.length - 3] ?? segments[0] : segments[0]
        const dateFolder = segments.length >= 2 ? segments[segments.length - 2] : ''

        const id = auditMeta['id'] ?? `FILE-${simpleHash(relative)}`
        const priority = (['P0', 'P1', 'P2', 'P3'].includes(auditMeta['priority'] ?? '') ? auditMeta['priority'] : 'P2') as AuditFileMeta['priority']
        const title = extractTitle(body) || auditMeta['id'] || path.basename(filePath, '.md')

        audits.push({
          id,
          type: (auditMeta['type'] ?? type).toUpperCase(),
          date: auditMeta['date'] ?? dateFolder ?? '',
          priority,
          status: auditMeta['status'] ?? 'Open',
          ownerAgent: auditMeta['owner_agent'] ?? 'system-auditor',
          title,
          filePath,
          relativePath: relative,
          findings: extractFindings(body),
          actions: [],
          checksum: simpleHash(raw),
        })
      } catch {
        // skip unreadable files
      }
    }

    return NextResponse.json(audits)
  } catch (e) {
    console.error('[audit-files] GET error:', e)
    return NextResponse.json({ error: 'Failed to scan audit files' }, { status: 500 })
  }
}
