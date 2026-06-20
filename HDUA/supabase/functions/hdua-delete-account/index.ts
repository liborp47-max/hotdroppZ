// HDUA-23 sub03 — hard-delete the calling user + all their owned rows.
//
// DRAFT / NOT DEPLOYED. The anon app client cannot remove an `auth.users` row,
// so deletion runs here with the service role. Deploy + secrets are blocked on
// the empty SUPABASE_SERVICE_ROLE_KEY (see HDUA-21 sub03):
//
//   supabase functions deploy hdua-delete-account
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... SUPABASE_ANON_KEY=...
//
// This file is a Deno edge function — it is intentionally OUTSIDE the Expo
// app's tsc/eslint scope (HDUA tsconfig + eslint exclude `supabase/`).
//
// @ts-nocheck — Deno runtime + remote ESM imports; not part of the RN typecheck.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Identify the caller from their own JWT (RLS-bound client).
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: whoErr,
  } = await asUser.auth.getUser()
  if (whoErr || !user) return json({ error: 'invalid session' }, 401)

  // Service-role client: wipe owned rows, then the auth user.
  const admin = createClient(url, serviceKey)
  const uid = user.id
  try {
    for (const table of ['hdua_liked_posts', 'hdua_saved_posts']) {
      await admin.from(table).delete().eq('user_id', uid)
    }
    await admin.from('hdua_settings').delete().eq('user_id', uid)
    await admin.from('hdua_profiles').delete().eq('id', uid)

    const { error: delErr } = await admin.auth.admin.deleteUser(uid)
    if (delErr) return json({ error: delErr.message }, 500)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'delete failed' }, 500)
  }

  return json({ ok: true }, 200)
})
