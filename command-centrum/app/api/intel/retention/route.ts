import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { purgeExpired, getPolicies, findUnsafePolicies } from '@/lib/intel'

/**
 * POST /api/intel/retention — invoke purge per retention policies.
 * Service-role only (cron-friendly). Returns purge summary.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const bearer = extractBearer(request)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = process.env.CRON_SECRET
  if (
    !bearer ||
    !(bearer === serviceRoleKey || bearer === cronSecret)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'admin client unavailable' }, { status: 500 })
  }

  // Safety: never run if a policy would purge audit data
  const policies = await getPolicies(db)
  const unsafe = findUnsafePolicies(policies)
  if (unsafe.length > 0) {
    return NextResponse.json(
      {
        error: 'unsafe retention policy detected — purge aborted',
        unsafePolicies: unsafe,
      },
      { status: 409 },
    )
  }

  const report = await purgeExpired(db)
  return NextResponse.json(report)
}

/** GET /api/intel/retention — read-only policy listing. */
export async function GET(): Promise<NextResponse> {
  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'admin client unavailable' }, { status: 500 })
  }
  const policies = await getPolicies(db)
  return NextResponse.json({ policies, unsafe: findUnsafePolicies(policies) })
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() ?? null
}
