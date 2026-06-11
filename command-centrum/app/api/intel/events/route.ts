import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  queryEvents,
  type IntelEventFilter,
  type IntelEventKind,
  type IntelSeverity,
} from '@/lib/intel'

const ALLOWED_KINDS: IntelEventKind[] = [
  'pipeline_run',
  'worker_run',
  'scout_run',
  'audit_record',
  'api_error',
  'model_call',
]

const ALLOWED_SEVERITIES: IntelSeverity[] = ['info', 'warn', 'error', 'critical']

export async function GET(request: Request): Promise<NextResponse> {
  const authClient = await createClient()
  const { data, error } = await authClient.auth.getUser()
  if (error || !data?.user) {
    // Allow service-role bearer for AI / cron consumers
    const bearer = extractBearer(request)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!bearer || !serviceRoleKey || bearer !== serviceRoleKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const db = createAdminClient() ?? authClient

  const url = new URL(request.url)
  const filter: IntelEventFilter = {
    kinds: parseCsv(url.searchParams.get('kinds')).filter((k): k is IntelEventKind =>
      ALLOWED_KINDS.includes(k as IntelEventKind),
    ),
    severities: parseCsv(url.searchParams.get('severities')).filter(
      (s): s is IntelSeverity => ALLOWED_SEVERITIES.includes(s as IntelSeverity),
    ),
    stages: parseCsv(url.searchParams.get('stages')),
    actor: url.searchParams.get('actor') ?? undefined,
    correlationId: url.searchParams.get('correlationId') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    until: url.searchParams.get('until') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    limit: numericParam(url.searchParams.get('limit'), 100),
    offset: numericParam(url.searchParams.get('offset'), 0),
  }

  // Strip empty arrays so query.ts skips the .in() clauses
  if ((filter.kinds ?? []).length === 0) delete filter.kinds
  if ((filter.severities ?? []).length === 0) delete filter.severities
  if ((filter.stages ?? []).length === 0) delete filter.stages

  const result = await queryEvents(db, filter)
  return NextResponse.json(result)
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() ?? null
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function numericParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
