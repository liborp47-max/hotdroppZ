import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

type AuditInsight = {
  title: string
  reason: string
  source: string
}

function extractBullets(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
}

function readAuditFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function toInsights(bullets: string[], source: string): AuditInsight[] {
  return bullets
    .filter((b) => b.length > 0)
    .slice(0, 6)
    .map((bullet) => {
      const parts = bullet.split(' - ')
      if (parts.length > 1) {
        return {
          title: parts[0],
          reason: parts.slice(1).join(' - '),
          source,
        }
      }
      return {
        title: bullet,
        reason: 'Derived from audit recommendation bullet.',
        source,
      }
    })
}

export async function GET() {
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auditsDir = path.resolve(process.cwd(), '..', '..', 'INFO', 'AUDITS')
  const reportsDir = path.resolve(process.cwd(), '..', '..', 'INFO', 'REPORTS', 'command-centrum')

  const auditFiles = [
    { file: 'SYSTEM_FULL_AUDIT_2026-05-12.md',            dir: auditsDir },
    { file: 'SUPABASE_PIPELINE_AUDIT_2026-05-12.md',       dir: auditsDir },
    { file: 'FACTORY_ENRICHMENT_INTEGRATION_2026-05-12.md', dir: auditsDir },
    { file: 'HDCC_SYSTEM_OVERVIEW.md',                     dir: reportsDir },
  ]

  const insights: AuditInsight[] = []

  for (const { file, dir } of auditFiles) {
    const fullPath = path.join(dir, file)
    const content = readAuditFile(fullPath)
    if (!content) continue

    const bullets = extractBullets(content)
    insights.push(...toInsights(bullets, `INFO/${file}`))
  }

  return NextResponse.json({
    status: 'ok',
    count: insights.length,
    insights: insights.slice(0, 12),
  })
}
