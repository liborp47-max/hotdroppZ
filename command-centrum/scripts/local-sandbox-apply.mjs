#!/usr/bin/env node
/**
 * One-off sandbox apply for UM-SCHEMA_MANIFEST_CONSOLIDATION sub-03.
 *
 * Reads MANIFEST.json `files[]` and applies each in applyOrder against
 * a local Postgres sandbox (no SSL, no Supabase pooler fallback).
 *
 * Pre-set on session:
 *   set check_function_bodies = off   — PG 18 strict-validates `language sql`
 *                                       function bodies at CREATE time, but
 *                                       MASTER_SCHEMA defines get_user_role()
 *                                       referencing profiles BEFORE the table
 *                                       is created. Supabase SQL Editor
 *                                       defaults to off; we mirror that.
 *
 * Connection is taken from SANDBOX_DB_URL (not SUPABASE_DB_URL) so we never
 * accidentally hit prod. Password never logged.
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const url = process.env.SANDBOX_DB_URL
if (!url) {
  console.error('SANDBOX_DB_URL not set')
  process.exit(2)
}

// Parse out the target database name from the URL so we can drop+recreate it
// from a control connection to the postgres database. SANDBOX_DB_URL must
// target a sandbox DB (we never connect to prod via this script).
const parsed = new URL(url)
const targetDb = parsed.pathname.replace(/^\//, '') || 'hotdroppz_dev'
if (targetDb === 'postgres') {
  console.error('Refusing to apply against postgres database — set SANDBOX_DB_URL to a sandbox database (e.g. hotdroppz_dev)')
  process.exit(2)
}

// Reset the sandbox DB from a control connection
{
  const controlUrl = new URL(url)
  controlUrl.pathname = '/postgres'
  const control = new pg.Client({ connectionString: controlUrl.toString(), ssl: false })
  await control.connect()
  try { await control.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()`, [targetDb]) } catch {}
  await control.query(`drop database if exists ${targetDb}`)
  await control.query(`create database ${targetDb}`)
  for (const role of ['anon', 'authenticated', 'service_role', 'supabase_admin']) {
    try { await control.query(`create role ${role} nologin`) } catch (e) { /* idempotent */ }
  }
  await control.end()
  console.log(`Reset target database: ${targetDb}`)
}

const manifestPath = path.resolve('supabase/MANIFEST.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const files = manifest.files

const client = new pg.Client({ connectionString: url, ssl: false })
await client.connect()
console.log('Connected. PG:', (await client.query('select version()')).rows[0].version.split(',')[0])
await client.query('set check_function_bodies = off')
console.log('check_function_bodies = off')

// Supabase shim — pre-create the surface MASTER_SCHEMA expects
await client.query(`create extension if not exists pgcrypto`)
await client.query(`create extension if not exists "uuid-ossp"`)
await client.query(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
  grant usage on schema auth to anon, authenticated, service_role;
`)
try { await client.query(`create publication supabase_realtime`) } catch (e) { /* exists */ }
console.log('Supabase shim applied: extensions, auth schema, supabase_realtime publication')

let failed = 0
const results = []
for (const f of files) {
  const fullPath = path.resolve(f.path)
  if (!fs.existsSync(fullPath)) {
    console.log(`[order ${String(f.applyOrder).padStart(2)}] MISSING ${f.path}`)
    results.push({ ...f, status: 'MISSING' })
    failed++
    continue
  }
  const sql = fs.readFileSync(fullPath, 'utf8')
  const t0 = Date.now()
  try {
    await client.query(sql)
    const dt = Date.now() - t0
    console.log(`[order ${String(f.applyOrder).padStart(2)}] OK   ${f.path} (${dt}ms)`)
    results.push({ ...f, status: 'OK', ms: dt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`[order ${String(f.applyOrder).padStart(2)}] FAIL ${f.path}`)
    console.log(`    ${msg.slice(0, 200)}`)
    results.push({ ...f, status: 'FAIL', error: msg.slice(0, 300) })
    failed++
  }
}

// Final state
const tableCount = await client.query(`
  select count(*)::int n from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
`)
console.log('')
console.log('=== SUMMARY ===')
console.log('Files applied:', results.filter(r => r.status === 'OK').length, '/', results.length)
console.log('Failed:', failed)
console.log('Public BASE TABLE count after apply:', tableCount.rows[0].n)
console.log('Expected (per manifest.verification.expectedTableCount):', manifest.verification.expectedTableCount)

await client.end()
process.exit(failed > 0 ? 1 : 0)
