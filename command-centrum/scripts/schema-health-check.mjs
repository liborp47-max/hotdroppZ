#!/usr/bin/env node
// schema-health-check.mjs
// Validates the running Postgres/Supabase DB against supabase/MANIFEST.json.
//
// Sub-mission: UM-CC_SCHEMA_MIGRATION / #03 (Schema health check)
//
// Exit codes:
//   0 = all healthy (warnings are tolerated)
//   1 = at least one FAIL (drift detected between manifest and DB)
//   2 = setup error (manifest missing, can't connect, missing deps, etc.)
//
// Style/convention notes:
//   - Matches scripts/apply-sql.mjs pattern (pg Client + .env loader + pooler fallback).
//   - ESM (.mjs) — no TypeScript, JSDoc typedefs for manifest shape.
//   - All console output via log()/warn()/err() helpers.
//   - Read-only queries only; never mutates DB.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dns from 'node:dns/promises'
import { fileURLToPath } from 'node:url'

/**
 * @typedef {Object} ManifestTable
 * @property {string} name
 * @property {string} definedIn
 * @property {number} definedAtLine
 * @property {number} order
 * @property {string[]} fkDependencies
 * @property {string} category
 */

/**
 * @typedef {Object} Manifest
 * @property {string} version
 * @property {ManifestTable[]} tables
 * @property {{ciGate:string, expectedTableCount:number, applyCommand:string}} verification
 * @property {Record<string, string[]>} fkGraph
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCRIPT_ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.resolve(SCRIPT_ROOT, 'supabase', 'MANIFEST.json')

// ────────────────────────────────────────────────────────────────────────────
// IO helpers
// ────────────────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(String(msg) + '\n')
}

function err(msg) {
  process.stderr.write(String(msg) + '\n')
}

function printUsage() {
  log('Usage:')
  log('  npm run schema:health')
  log('  node scripts/schema-health-check.mjs [--strict] [--help]')
  log('')
  log('Flags:')
  log('  --strict   Exit 2 (instead of 0) when connectivity is not real-db.')
  log('             Use in CI to reject "manifest-only" passes as false positives.')
  log('')
  log('Environment:')
  log('  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require')
  log('  (or DATABASE_URL — same shape)')
  log('')
  log('Connectivity modes (printed in report header + JSON output):')
  log('  real-db          — all tests ran against a live Postgres connection')
  log('  skipped-no-url   — env not set, no tests ran (dev mode)')
  log('  skipped-no-pg    — pg driver missing, no tests ran')
  log('  unreachable      — env set but DB connection failed')
  log('')
  log('Exit codes:')
  log('  0 = healthy in real-db mode (warnings tolerated), OR skipped without --strict')
  log('  1 = drift detected (>= 1 FAIL test) in real-db mode')
  log('  2 = setup error (manifest missing, pg missing, cannot connect) OR --strict on non-real-db')
}

// ────────────────────────────────────────────────────────────────────────────
// .env loader (mirrors apply-sql.mjs)
// ────────────────────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, initialValue] = match
    if (process.env[key] !== undefined) continue
    let value = initialValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

const cwd = process.cwd()
for (const envFile of ['.env.local', '.env']) {
  loadEnvFile(path.join(cwd, envFile))
}
// Also try command-centrum-relative env files (in case CWD is repo root)
for (const envFile of ['.env.local', '.env']) {
  loadEnvFile(path.join(SCRIPT_ROOT, envFile))
}

function getConnectionString() {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? null
}

function getConnectionHost(connectionString) {
  try {
    return new URL(connectionString).hostname
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Pooler fallback (mirrors apply-sql.mjs)
// ────────────────────────────────────────────────────────────────────────────

function getPoolerCandidates(connectionString) {
  const host = getConnectionHost(connectionString)
  if (!host) return []
  const hostParts = host.split('.')
  const projectRef = hostParts[0] === 'db' ? hostParts[1] : hostParts[0]
  const dbPassword = new URL(connectionString).password
  const passwordCandidates = [dbPassword]
  const stripped = dbPassword.replace(/^\[/, '').replace(/\]$/, '')
  if (stripped !== dbPassword) passwordCandidates.push(stripped)
  const baseUsernames = [`postgres.${projectRef}`, 'postgres']
  const regions = [
    'aws-0-eu-central-1.pooler.supabase.com',
    'aws-0-eu-west-2.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-us-east-2.pooler.supabase.com',
    'aws-0-ap-southeast-1.pooler.supabase.com',
  ]
  const ports = [5432, 6543]
  const candidates = []
  for (const region of regions) {
    for (const port of ports) {
      for (const username of baseUsernames) {
        for (const password of passwordCandidates) {
          candidates.push(
            `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${region}:${port}/postgres`,
          )
        }
      }
    }
  }
  return candidates
}

async function connectWithFallback(pg, connectionString) {
  const primaryHost = getConnectionHost(connectionString) ?? ''
  const shouldTryFallbackPoolers = !primaryHost.includes('pooler.supabase.com')
  const attempts = shouldTryFallbackPoolers
    ? [connectionString, ...getPoolerCandidates(connectionString)]
    : [connectionString]
  let lastError = null

  for (const candidate of attempts) {
    const candidateHost = getConnectionHost(candidate) ?? 'unknown-host'
    const client = new pg.Client({
      connectionString: candidate,
      ssl: candidate.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    })
    try {
      await client.connect()
      log(`Connected via ${candidateHost}`)
      return client
    } catch (error) {
      lastError = error
      log(`Connection failed via ${candidateHost}: ${error instanceof Error ? error.message : error}`)
      try { await client.end() } catch { /* ignore */ }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All connection attempts failed')
}

// ────────────────────────────────────────────────────────────────────────────
// Test framework (tiny, no deps)
// ────────────────────────────────────────────────────────────────────────────

/** @typedef {{ id:string, name:string, status:'PASS'|'FAIL'|'WARN'|'SKIP', message:string, details?:any }} TestResult */

function makeResult(id, name, status, message, details) {
  return { id, name, status, message, details }
}

function statusBadge(s) {
  // fixed-width for alignment
  return s.padEnd(5, ' ')
}

// ────────────────────────────────────────────────────────────────────────────
// Validation tests
// ────────────────────────────────────────────────────────────────────────────

/**
 * Test A — schema_version table exists and has >= 1 record.
 */
async function testSchemaVersionExists(client) {
  try {
    const r = await client.query('select count(*)::int as n from schema_version')
    const n = r.rows[0]?.n ?? 0
    if (n === 0) {
      return makeResult('A', 'schema_version table', 'FAIL', '0 records — schema_version is empty', { count: n })
    }
    return makeResult('A', 'schema_version table', 'PASS', `${n} record${n === 1 ? '' : 's'}`, { count: n })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return makeResult('A', 'schema_version table', 'FAIL', `query failed: ${msg}`)
  }
}

/**
 * Test B — schema_health view callable; returns counts/checksum/timestamp.
 */
async function testSchemaHealthView(client) {
  try {
    const r = await client.query('select * from schema_health')
    const row = r.rows[0]
    if (!row) {
      return makeResult('B', 'schema_health view', 'FAIL', 'view returned 0 rows')
    }
    const tableCount = Number(row.table_count ?? 0)
    const latestAt = row.latest_version_at ? new Date(row.latest_version_at).toISOString().slice(0, 10) : 'n/a'
    const checksum = row.current_checksum ?? 'n/a'
    return makeResult(
      'B',
      'schema_health view',
      'PASS',
      `table_count=${tableCount}, latest=${latestAt}`,
      { tableCount, latestAt, checksum, versionsRecorded: Number(row.versions_recorded ?? 0) },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return makeResult('B', 'schema_health view', 'FAIL', `query failed: ${msg}`)
  }
}

/**
 * Test C — actual table_count >= manifest.verification.expectedTableCount.
 * Warns if actual > expected (out-of-scope tables tolerated).
 */
async function testExpectedTableCount(client, manifest, testBResult) {
  const expected = Number(manifest.verification?.expectedTableCount ?? 0)
  const actual = Number(testBResult?.details?.tableCount ?? NaN)
  if (Number.isNaN(actual)) {
    return makeResult('C', 'expected table count', 'FAIL', 'could not read table_count from schema_health (test B failed)')
  }
  if (actual < expected) {
    return makeResult('C', 'expected table count', 'FAIL', `actual ${actual} < expected ${expected}`, { actual, expected })
  }
  if (actual > expected) {
    return makeResult(
      'C',
      'expected table count',
      'WARN',
      `actual ${actual} > expected ${expected} (out-of-scope tables tolerated)`,
      { actual, expected, delta: actual - expected },
    )
  }
  return makeResult('C', 'expected table count', 'PASS', `actual ${actual} >= expected ${expected}`, { actual, expected })
}

/**
 * Test D — each manifest table exists in information_schema.tables.
 */
async function testPerTableExistence(client, manifest) {
  const tables = manifest.tables ?? []
  if (tables.length === 0) {
    return makeResult('D', 'per-table existence', 'FAIL', 'manifest.tables[] is empty')
  }
  const names = tables.map((t) => t.name)
  const r = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = any($1::text[])`,
    [names],
  )
  const found = new Set(r.rows.map((row) => row.table_name))
  const missing = names.filter((n) => !found.has(n))
  if (missing.length > 0) {
    return makeResult(
      'D',
      'per-table existence',
      'FAIL',
      `${found.size}/${names.length} found — missing: ${missing.join(', ')}`,
      { found: [...found], missing },
    )
  }
  return makeResult('D', 'per-table existence', 'PASS', `${found.size}/${names.length} tables found`, { found: [...found] })
}

/**
 * Test E — for each manifest table with declared FK targets, verify DB has
 * matching FK constraints. Manifest-declared FK missing in DB => FAIL.
 * Extra FK in DB not in manifest => WARN.
 *
 * Notes:
 *  - We only check distinct referenced-table targets (not column-level FK names).
 *  - auth.users FK is checked via foreign_table_schema='auth'; if PostgREST user
 *    cannot see auth.users (RLS/permissions), this still reads pg_catalog OK
 *    because information_schema views the constraint itself.
 */
async function testPerTableFkMatch(client, manifest) {
  const tables = manifest.tables ?? []
  const manifestFkMap = new Map() // tableName -> Set<refTableName>
  for (const t of tables) {
    const deps = (t.fkDependencies ?? []).map((d) => d) // keep schema prefix like 'auth.users'
    manifestFkMap.set(t.name, new Set(deps))
  }

  // Query all FKs on listed tables in one go via pg_catalog (more reliable
  // than information_schema for cross-schema refs).
  const tableNames = tables.map((t) => t.name)
  const sql = `
    select
      con_ns.nspname        as src_schema,
      con_cls.relname       as src_table,
      ref_ns.nspname        as ref_schema,
      ref_cls.relname       as ref_table
    from pg_constraint c
    join pg_class con_cls       on con_cls.oid = c.conrelid
    join pg_namespace con_ns    on con_ns.oid = con_cls.relnamespace
    join pg_class ref_cls       on ref_cls.oid = c.confrelid
    join pg_namespace ref_ns    on ref_ns.oid = ref_cls.relnamespace
    where c.contype = 'f'
      and con_ns.nspname = 'public'
      and con_cls.relname = any($1::text[])
  `
  let rows = []
  try {
    const r = await client.query(sql, [tableNames])
    rows = r.rows
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return makeResult('E', 'per-table FK match', 'FAIL', `pg_catalog FK query failed: ${msg}`)
  }

  // Build DB FK map: src_table -> Set<refSchema.refTable | refTable>
  const dbFkMap = new Map()
  for (const t of tableNames) dbFkMap.set(t, new Set())
  for (const row of rows) {
    const ref =
      row.ref_schema && row.ref_schema !== 'public'
        ? `${row.ref_schema}.${row.ref_table}`
        : row.ref_table
    dbFkMap.get(row.src_table)?.add(ref)
  }

  /** @type {{table:string, missing:string[], extra:string[]}[]} */
  const issues = []
  for (const t of tables) {
    const want = manifestFkMap.get(t.name) ?? new Set()
    const have = dbFkMap.get(t.name) ?? new Set()
    const missing = [...want].filter((w) => !have.has(w))
    const extra = [...have].filter((h) => !want.has(h))
    if (missing.length > 0 || extra.length > 0) {
      issues.push({ table: t.name, missing, extra })
    }
  }

  const hardFails = issues.filter((i) => i.missing.length > 0)
  const onlyExtras = issues.filter((i) => i.missing.length === 0 && i.extra.length > 0)

  if (hardFails.length > 0) {
    const summary = hardFails
      .map((i) => `${i.table} missing[${i.missing.join(',')}]`)
      .join('; ')
    return makeResult(
      'E',
      'per-table FK match',
      'FAIL',
      `manifest FKs not present in DB — ${summary}`,
      { hardFails, onlyExtras },
    )
  }
  if (onlyExtras.length > 0) {
    const summary = onlyExtras.map((i) => `${i.table} extra[${i.extra.join(',')}]`).join('; ')
    return makeResult(
      'E',
      'per-table FK match',
      'WARN',
      `DB has FKs not declared in manifest — ${summary}`,
      { onlyExtras },
    )
  }
  return makeResult('E', 'per-table FK match', 'PASS', 'all FKs match manifest')
}

/**
 * Test F — compute_schema_checksum() result matches latest schema_version.checksum.
 * Drift => WARN (not FAIL) because mid-migration drift is recoverable.
 */
async function testChecksumStability(client) {
  try {
    const r = await client.query(`
      select
        compute_schema_checksum() as computed,
        (select checksum from schema_version order by applied_at desc limit 1) as recorded
    `)
    const row = r.rows[0]
    const computed = row?.computed ?? null
    const recorded = row?.recorded ?? null
    if (!computed) {
      return makeResult('F', 'checksum stability', 'FAIL', 'compute_schema_checksum() returned null')
    }
    if (!recorded) {
      return makeResult('F', 'checksum stability', 'FAIL', 'no recorded checksum in schema_version')
    }
    if (computed !== recorded) {
      return makeResult(
        'F',
        'checksum stability',
        'WARN',
        `drift detected (computed ${computed.slice(0, 8)}.. != recorded ${recorded.slice(0, 8)}..)`,
        { computed, recorded },
      )
    }
    return makeResult('F', 'checksum stability', 'PASS', 'matches schema_version.checksum', { checksum: computed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return makeResult('F', 'checksum stability', 'FAIL', `query failed: ${msg}`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Report
// ────────────────────────────────────────────────────────────────────────────

/**
 * Connectivity mode — distinguishes real-DB verification from offline / skipped
 * runs. UM-SCHEMA_MANIFEST_CONSOLIDATION sub-04 (AUD-20260523-06): without this
 * label, a "PASS" output from skip-mode looked identical to a real-DB PASS and
 * masked schema drift.
 *
 *   real-db          — all tests ran against a live Postgres connection
 *   skipped-no-url   — no SUPABASE_DB_URL/DATABASE_URL in env (dev mode)
 *   skipped-no-pg    — pg driver not installed
 *   unreachable      — env set but DB connection failed
 */
const CONNECTIVITY_LABELS = {
  'real-db': 'real-db verified',
  'skipped-no-url': 'SKIPPED (no DB URL — manifest-only)',
  'skipped-no-pg': 'SKIPPED (pg driver missing — manifest-only)',
  'unreachable': 'UNREACHABLE (DB URL set but connection failed)',
}

function printReport(results, connectivity) {
  const label = CONNECTIVITY_LABELS[connectivity] ?? connectivity
  log('')
  log(`=== SCHEMA HEALTH CHECK (mode: ${label}) ===`)
  log('')
  if (results.length === 0) {
    log('No DB tests ran. Re-run with SUPABASE_DB_URL set for real-db verification.')
  } else {
    for (const r of results) {
      log(`[${r.id}] ${r.name.padEnd(26, ' ')} ${statusBadge(r.status)}  ${r.message}`)
    }
  }
  log('')
  log('=== SUMMARY ===')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const warned = results.filter((r) => r.status === 'WARN').length
  log(`Connectivity: ${label}`)
  log(`Tests passed: ${passed}/${results.length}`)
  log(`Warnings:     ${warned}`)
  log(`Failures:     ${failed}`)
  if (connectivity !== 'real-db') {
    log('')
    log('NOTE: This run did NOT verify against a live database.')
    log('      Pass --strict to fail (exit 2) instead of exit 0 in non-real-db mode.')
  }
  log('')
}

function emitJsonSummary(results, connectivity) {
  const summary = {
    schemaHealth: {
      connectivity,
      verifiedAgainstRealDb: connectivity === 'real-db',
      passed: results.filter((r) => r.status === 'PASS').length,
      failed: results.filter((r) => r.status === 'FAIL').length,
      warned: results.filter((r) => r.status === 'WARN').length,
      total: results.length,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        message: r.message,
        source: connectivity === 'real-db' ? 'real-db' : 'not-run',
        details: r.details,
      })),
    },
  }
  err(JSON.stringify(summary))
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage()
    process.exit(0)
  }
  // --strict: refuse to exit 0 when connectivity != real-db
  // (UM-SCHEMA_MANIFEST_CONSOLIDATION sub-04 — prevents "Neovereno" passing as "verified")
  const strict = argv.includes('--strict')

  // 1. Load manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    err('MANIFEST.json not found at ' + MANIFEST_PATH)
    err('Run sub-mission #02 first (db-engineer) to produce manifest.')
    process.exit(2)
  }
  /** @type {Manifest} */
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  } catch (e) {
    err('MANIFEST.json invalid JSON: ' + (e instanceof Error ? e.message : String(e)))
    process.exit(2)
  }
  if (!Array.isArray(manifest.tables) || manifest.tables.length === 0) {
    err('MANIFEST.json has no tables[] — cannot validate.')
    process.exit(2)
  }

  log(`Loaded manifest: version=${manifest.version}, tables=${manifest.tables.length}`)

  // 2. Resolve connection
  const connectionString = getConnectionString()
  if (!connectionString) {
    log('SKIP: SUPABASE_DB_URL / DATABASE_URL not set (dev mode, no DB).')
    log('Manifest loaded OK; live DB checks skipped — NOT verified against real DB.')
    printReport([], 'skipped-no-url')
    emitJsonSummary([], 'skipped-no-url')
    process.exit(strict ? 2 : 0)
  }

  // 3. Import pg (optional dep — graceful fallback if missing)
  let pg
  try {
    pg = await import('pg')
  } catch (e) {
    err('Optional dep "pg" not installed — cannot run live checks.')
    err('Install with: npm i -D pg')
    log('SKIP: live DB checks disabled (pg missing) — NOT verified against real DB.')
    printReport([], 'skipped-no-pg')
    emitJsonSummary([], 'skipped-no-pg')
    process.exit(strict ? 2 : 0)
  }

  // 4. DNS sanity (mirrors apply-sql.mjs diagnostic)
  const host = getConnectionHost(connectionString)
  if (host) {
    try {
      const records = await dns.lookup(host, { all: true })
      const summary = records.map((r) => `${r.family === 6 ? 'AAAA' : 'A'} ${r.address}`).join(', ')
      log(`Resolved ${host}: ${summary}`)
    } catch (e) {
      log(`DNS lookup for ${host} failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  // 5. Connect
  let client
  try {
    client = await connectWithFallback(pg.default ?? pg, connectionString)
  } catch (e) {
    err('Could not connect to DB: ' + (e instanceof Error ? e.message : String(e)))
    err('See apply-sql.mjs for connection diagnostics.')
    printReport([], 'unreachable')
    emitJsonSummary([], 'unreachable')
    process.exit(2)
  }

  // 6. Run tests
  /** @type {TestResult[]} */
  const results = []
  try {
    const a = await testSchemaVersionExists(client)
    results.push(a)

    const b = await testSchemaHealthView(client)
    results.push(b)

    const c = await testExpectedTableCount(client, manifest, b)
    results.push(c)

    const d = await testPerTableExistence(client, manifest)
    results.push(d)

    const e = await testPerTableFkMatch(client, manifest)
    results.push(e)

    const f = await testChecksumStability(client)
    results.push(f)
  } finally {
    try { await client.end() } catch { /* ignore cleanup */ }
  }

  // 7. Report
  printReport(results, 'real-db')
  emitJsonSummary(results, 'real-db')

  // 8. Exit
  const failed = results.filter((r) => r.status === 'FAIL').length
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  err('Fatal: ' + (e instanceof Error ? e.message : String(e)))
  if (e instanceof Error && e.stack) err(e.stack)
  process.exit(2)
})
