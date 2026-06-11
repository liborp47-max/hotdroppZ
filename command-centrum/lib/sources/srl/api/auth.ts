/**
 * SRL REST auth — supports two principals:
 *
 *  1. Supabase user session (cookies)  — dashboard / web consumer
 *  2. Service-role bearer token        — Python AI workers / cron / server-to-server
 *
 * Returns the DB client to use (service-role bypasses RLS) and an Unauthorized
 * NextResponse when neither principal succeeds.
 */

import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { SrlDb } from '@/lib/sources/srl/types'

export interface SrlAuthOk {
  ok: true
  principal: 'user' | 'service-role'
  db: SrlDb
}

export interface SrlAuthFail {
  ok: false
  response: NextResponse
}

export async function authenticateSrl(request: Request): Promise<SrlAuthOk | SrlAuthFail> {
  const bearer = extractBearer(request)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (bearer && serviceRoleKey && bearer === serviceRoleKey) {
    const admin = createAdminClient()
    if (admin) {
      return { ok: true, principal: 'service-role', db: admin }
    }
  }

  const authClient = await createClient()
  const { data, error } = await authClient.auth.getUser()
  if (error || !data?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const admin = createAdminClient()
  return { ok: true, principal: 'user', db: admin ?? authClient }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() ?? null
}
