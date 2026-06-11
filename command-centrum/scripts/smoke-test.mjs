/**
 * HotDroppZ — End-to-end pipeline smoke test
 *
 * Default mode  : inserts seed data directly, validates DB + HDUA fetch + render
 * Pipeline mode : --pipeline flag additionally drives each CC API stage in sequence
 *
 * Run (default):
 *   cd command-centrum && node scripts/smoke-test.mjs
 *
 * Run (full pipeline — requires CC server running + CC_SESSION_TOKEN in .env.local):
 *   cd command-centrum && node scripts/smoke-test.mjs --pipeline
 *
 * Required env (command-centrum/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   CC_URL             default http://localhost:3000   (command-centrum dev server)
 *   HDUA_URL           default http://localhost:3001   (frontend-web dev server)
 *   CC_SESSION_TOKEN   required only for --pipeline mode
 */

import fs   from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

// ── Env loader (same pattern as apply-sql.mjs) ────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, raw] = match
    if (process.env[key] !== undefined) continue
    let val = raw.trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

for (const f of ['.env.local', '.env']) loadEnvFile(path.join(process.cwd(), f))

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CC_URL           = process.env.CC_URL           ?? 'http://localhost:3000'
const HDUA_URL         = process.env.HDUA_URL          ?? 'http://localhost:3001'
const SESSION_TOKEN    = process.env.CC_SESSION_TOKEN  ?? ''
const PIPELINE_MODE    = process.argv.includes('--pipeline')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

if (PIPELINE_MODE && !SESSION_TOKEN) {
  console.error('FATAL: --pipeline mode requires CC_SESSION_TOKEN in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Test state ────────────────────────────────────────────────────────────────

const RUN_ID = `smoke-${Date.now()}`
// Deterministic UUID in the test-reserved 00000001-xxxx range so it's visually obvious in DB
const TEST_SCOUT_ID    = `00000001-0000-0000-0000-${Date.now().toString().slice(-12)}`
const TEST_CLUSTER_ID  = `00000001-0001-0000-0000-${Date.now().toString().slice(-12)}`
const TEST_FEED_POST_ID = `00000001-0002-0000-0000-${Date.now().toString().slice(-12)}`

const RESULTS = []
let cleanupDone = false

// ── Assertion helpers ─────────────────────────────────────────────────────────

function pass(stage, msg) {
  RESULTS.push({ stage, ok: true, msg })
  console.log(`  \x1b[32m✓\x1b[0m ${stage.padEnd(28)} ${msg}`)
}

function fail(stage, msg) {
  RESULTS.push({ stage, ok: false, msg })
  console.error(`  \x1b[31m✗\x1b[0m ${stage.padEnd(28)} ${msg}`)
}

function assert(cond, stage, okMsg, failMsg) {
  if (cond) pass(stage, okMsg)
  else       fail(stage, failMsg)
  return cond
}

function heading(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  if (cleanupDone) return
  cleanupDone = true
  heading('CLEANUP')
  // Order matters: feed_posts → story_cluster_sources → story_clusters → scout_items
  await db.from('feed_posts').delete().eq('id', TEST_FEED_POST_ID)
  await db.from('story_cluster_sources').delete().eq('cluster_id', TEST_CLUSTER_ID)
  await db.from('story_clusters').delete().eq('id', TEST_CLUSTER_ID)
  await db.from('scout_items').delete().eq('id', TEST_SCOUT_ID)
  console.log('  Seed rows removed.')
}

// ── Stage 1: DB connection check ──────────────────────────────────────────────

async function stage_connection() {
  heading('STAGE 1 — DB connection')
  const { error } = await db.from('scout_items').select('id').limit(1)
  assert(!error, 'DB_CONNECT', 'Supabase reachable', error?.message ?? 'connection failed')
}

// ── Stage 2: Scout item seed ──────────────────────────────────────────────────

async function stage_seed() {
  heading('STAGE 2 — Scout item seed')

  const { error } = await db.from('scout_items').insert({
    id:             TEST_SCOUT_ID,
    title:          `[SMOKE ${RUN_ID}] Central Cee drops new single feat. Dave`,
    title_en:       `[SMOKE ${RUN_ID}] Central Cee drops new single feat. Dave`,
    content:        'Central Cee has released a new collaborative single with Dave, set to drop this Friday on all platforms.',
    content_en:     'Central Cee has released a new collaborative single with Dave, set to drop this Friday on all platforms.',
    english_master: 'Central Cee has released a new collaborative single with Dave, set to drop this Friday on all platforms.',
    raw_content:    'Central Cee has released a new collaborative single with Dave.',
    source:         'smoke_test',
    url:            `https://example.com/smoke/${RUN_ID}`,
    category:       'uk_rap',
    status:         'TRANSLATED',    // Start at TRANSLATED — curator picks TRANSLATED items
    attention_score: null,
    is_release:     true,
    priority:       'P1',
    published_at:   new Date().toISOString(),
    created_at:     new Date().toISOString(),
  })

  assert(!error, 'SEED_SCOUT', 'scout_item inserted', error?.message ?? 'insert failed')
}

// ── Stage 3: Feed post write (simulates full pipeline output) ─────────────────

async function stage_feed_post_write() {
  heading('STAGE 3 — feed_post DB write')

  const now = new Date().toISOString()

  const feedRow = {
    id:            TEST_FEED_POST_ID,
    scout_item_id: TEST_SCOUT_ID,
    cluster_id:    TEST_CLUSTER_ID,
    type:          'track',
    title:         `[SMOKE ${RUN_ID}] Central Cee drops new single feat. Dave`,
    content:       'Central Cee has released a new collaborative single with Dave.',
    summary:       'Central Cee x Dave collab single drops Friday.',
    confidence:    0.88,
    tags:          ['central_cee', 'dave', 'uk_rap', 'new_single', 'collab'],
    artist:        'Central Cee',
    artist_id:     null,
    spotify_url:   null,
    youtube_url:   null,
    image_url:     null,
    media_hint:    null,
    category:      'uk_rap',
    region:        'UK',
    priority:      'P1',
    language:      'en',
    is_radar:      true,
    like_count:    0,
    boost_count:   0,
    view_count:    0,
    published_at:  now,   // CRITICAL: HDUA filters on .not('published_at','is',null)
    created_at:    now,
  }

  const { error: writeErr } = await db.from('feed_posts').insert(feedRow)
  const writeOk = assert(!writeErr, 'FEED_POST_WRITE', 'feed_post inserted', writeErr?.message ?? 'insert failed')
  if (!writeOk) return

  // Immediately read back to confirm DB write is visible
  const { data, error: readErr } = await db
    .from('feed_posts')
    .select('id, category, published_at, priority, language, is_radar')
    .eq('id', TEST_FEED_POST_ID)
    .single()

  assert(!readErr && !!data, 'FEED_POST_READ', 'feed_post readable after write', readErr?.message ?? 'row not found')
}

// ── Stage 4: Payload contract validation ──────────────────────────────────────

async function stage_payload_validate() {
  heading('STAGE 4 — Payload contract validation')

  const { data, error } = await db
    .from('feed_posts')
    .select('id, type, title, category, region, priority, language, published_at, is_radar, confidence, tags')
    .eq('id', TEST_FEED_POST_ID)
    .single()

  if (!assert(!error && !!data, 'PAYLOAD_ROW', 'row fetched for validation', error?.message ?? 'not found')) return

  const V2_CATEGORIES = ['droppz','usa_rap','uk_rap','eu_rap','ru_rap','balkan_rap','rnb','fun','fashion','news']
  const VALID_TYPES   = ['track','album','video_release','event']
  const VALID_PRIOS   = ['P0','P1','P2','P3']

  // Required fields
  const REQUIRED = ['id','type','title','category','published_at','language']
  for (const f of REQUIRED) {
    assert(data[f] != null && data[f] !== '', `PAYLOAD_FIELD_${f.toUpperCase()}`, `${f}=${JSON.stringify(data[f])}`, `${f} is null/empty`)
  }

  // Enum checks
  assert(V2_CATEGORIES.includes(data.category), 'PAYLOAD_CATEGORY_V2', `category=${data.category} is v2`, `category=${data.category} is legacy/unknown`)
  assert(VALID_TYPES.includes(data.type),        'PAYLOAD_TYPE',        `type=${data.type}`, `type=${data.type} invalid`)
  assert(VALID_PRIOS.includes(data.priority),    'PAYLOAD_PRIORITY',    `priority=${data.priority}`, `priority=${data.priority} invalid`)

  // published_at must be a valid ISO timestamp (HDUA gates on this)
  const ts = Date.parse(data.published_at)
  assert(!isNaN(ts), 'PAYLOAD_PUBLISHED_AT', `published_at=${data.published_at}`, 'published_at is not a valid timestamp')

  // confidence in [0,1]
  assert(typeof data.confidence === 'number' && data.confidence >= 0 && data.confidence <= 1,
    'PAYLOAD_CONFIDENCE', `confidence=${data.confidence}`, `confidence=${data.confidence} out of range`)

  // tags is an array
  assert(Array.isArray(data.tags) && data.tags.length > 0, 'PAYLOAD_TAGS', `tags=[${data.tags}]`, 'tags empty or not array')
}

// ── Stage 5: HDUA feed fetch ──────────────────────────────────────────────────

async function stage_hdua_fetch() {
  heading('STAGE 5 — HDUA feed fetch')

  let res
  try {
    res = await fetch(`${HDUA_URL}/api/feed?limit=50&category=uk_rap`, { signal: AbortSignal.timeout(8000) })
  } catch (err) {
    fail('HDUA_HTTP', `Could not reach HDUA at ${HDUA_URL} — is frontend-web running? (${err.message})`)
    return null
  }

  if (!assert(res.ok, 'HDUA_STATUS', `HTTP ${res.status}`, `HTTP ${res.status} from ${HDUA_URL}/api/feed`)) return null

  const json = await res.json()

  assert(Array.isArray(json.items),       'HDUA_ITEMS_ARRAY',  `items[] length=${json.items?.length}`, 'items is not an array')
  assert(Array.isArray(json.radar),       'HDUA_RADAR_ARRAY',  `radar[] length=${json.radar?.length}`, 'radar is not an array')
  assert(typeof json.meta === 'object',   'HDUA_META_OBJECT',  'meta object present', 'meta missing')
  assert(typeof json.meta.total === 'number', 'HDUA_META_TOTAL', `total=${json.meta.total}`, 'meta.total not a number')

  // Find the smoke test item
  const found = (json.items ?? []).find((item) => item.title?.includes(RUN_ID))
  assert(!!found, 'HDUA_ITEM_PRESENT', `smoke item found in feed`, `smoke item NOT in feed (check published_at on feed_posts)`)

  return found
}

// ── Stage 6: Render validation ────────────────────────────────────────────────

async function stage_render(feedPost) {
  heading('STAGE 6 — Render validation (mapped FeedPost)')

  if (!feedPost) {
    fail('RENDER_SKIP', 'Skipped — smoke item not found in HDUA response')
    return
  }

  // Fields the HDUA mapper guarantees on a FeedPost object
  const REQUIRED_UI_FIELDS = [
    'id', 'type', 'title', 'priority', 'category',
    'language', 'published_at', 'created_at',
    'like_count', 'boost_count', 'view_count',
    'is_radar', 'tags',
  ]
  for (const f of REQUIRED_UI_FIELDS) {
    assert(feedPost[f] !== undefined, `RENDER_${f.toUpperCase()}`, `FeedPost.${f}=${JSON.stringify(feedPost[f])}`, `FeedPost.${f} missing`)
  }

  // FeedCardType must be one of the valid card types
  const CARD_TYPES = ['MusicCard','AlbumCard','VideoCard','EventCard','NewsCard']
  // HDUA mapper renames `type` to a card type or keeps the DB type — check both
  const cardType = feedPost.card_type ?? feedPost.type
  assert(
    CARD_TYPES.includes(cardType) || ['track','album','video_release','event'].includes(cardType),
    'RENDER_CARD_TYPE', `card_type=${cardType}`, `card_type=${cardType} not valid`
  )

  // Priority must be P0–P3
  assert(['P0','P1','P2','P3'].includes(feedPost.priority), 'RENDER_PRIORITY', `priority=${feedPost.priority}`, `priority=${feedPost.priority} invalid`)

  // Image can be null but must be the correct type when present
  assert(feedPost.image_url === null || typeof feedPost.image_url === 'string', 'RENDER_IMAGE_URL', `image_url=${feedPost.image_url}`, 'image_url wrong type')
}

// ── Stage 7: Pipeline API stages (--pipeline mode only) ───────────────────────

async function stage_pipeline_api() {
  heading('STAGE 7 — Pipeline API stages (--pipeline mode)')

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `sb-access-token=${SESSION_TOKEN}`,
  }

  const stages = [
    { name: 'CURATOR',     url: `${CC_URL}/api/curator/run` },
    { name: 'CLUSTER',     url: `${CC_URL}/api/cluster/run` },
    { name: 'ENRICHMENT',  url: `${CC_URL}/api/enrichment/run` },
    { name: 'WRITER',      url: `${CC_URL}/api/writer/run` },
    { name: 'FEED_ENGINE', url: `${CC_URL}/api/feed/run` },
  ]

  for (const stage of stages) {
    let res
    try {
      res = await fetch(stage.url, { method: 'POST', headers, signal: AbortSignal.timeout(30_000) })
    } catch (err) {
      fail(`PIPELINE_${stage.name}`, `Could not reach CC at ${stage.url} (${err.message})`)
      continue
    }

    if (res.status === 401) {
      fail(`PIPELINE_${stage.name}`, 'Unauthorized — check CC_SESSION_TOKEN')
      continue
    }

    const json = await res.json().catch(() => ({}))
    const ok = res.ok && !json.error

    assert(ok, `PIPELINE_${stage.name}`,
      `HTTP ${res.status} — processed=${json.processed ?? '?'} created=${json.created ?? '?'}`,
      `HTTP ${res.status} — ${json.error ?? 'unknown error'}`
    )

    // Brief pause so each stage's DB writes settle before the next stage queries them
    await new Promise((r) => setTimeout(r, 800))
  }

  // After pipeline, verify our scout_item advanced past TRANSLATED
  const { data: item } = await db.from('scout_items').select('status, attention_score').eq('id', TEST_SCOUT_ID).single()
  if (item) {
    const advanced = ['CURATED','CLUSTERED','discarded'].includes(item.status)
    assert(advanced, 'PIPELINE_SCOUT_STATUS', `status=${item.status} attention_score=${item.attention_score}`, `status=${item.status} — item did not advance through pipeline`)
  }
}

// ── Results summary ───────────────────────────────────────────────────────────

function printSummary() {
  const passed = RESULTS.filter((r) => r.ok).length
  const failed = RESULTS.filter((r) => !r.ok).length
  const total  = RESULTS.length

  console.log('\n' + '─'.repeat(60))
  if (failed === 0) {
    console.log(`\x1b[32m✓ ALL ${total} ASSERTIONS PASSED\x1b[0m`)
  } else {
    console.log(`\x1b[31m✗ ${failed} of ${total} ASSERTIONS FAILED\x1b[0m`)
    console.log('\nFailed:')
    for (const r of RESULTS.filter((r) => !r.ok)) {
      console.log(`  ✗ ${r.stage.padEnd(28)} ${r.msg}`)
    }
  }
  console.log('─'.repeat(60))

  return failed === 0
}

// ── Execution order ───────────────────────────────────────────────────────────
//
//  1. DB connection check          (abort if unreachable)
//  2. Scout item seed              (abort if insert fails)
//  3. feed_post write              (abort if insert fails)
//  4. Payload contract validation  (read back + field checks)
//  5. HDUA feed fetch              (HTTP GET — requires frontend-web running)
//  6. Render validation            (FeedPost shape from HDUA response)
//  7. Pipeline API stages          (--pipeline flag only — requires CC running + CC_SESSION_TOKEN)
//  8. Cleanup                      (always runs via finally — removes test rows)

async function main() {
  console.log(`\n\x1b[1m🔥 HotDroppZ Smoke Test\x1b[0m  run=${RUN_ID}  mode=${PIPELINE_MODE ? 'pipeline' : 'default'}`)
  console.log(`   CC:   ${CC_URL}`)
  console.log(`   HDUA: ${HDUA_URL}`)
  console.log(`   DB:   ${SUPABASE_URL}\n`)

  try {
    await stage_connection()

    if (RESULTS.some((r) => !r.ok)) {
      console.error('\nAborting — DB connection failed.')
      process.exit(1)
    }

    await stage_seed()

    if (RESULTS.some((r) => !r.ok && r.stage === 'SEED_SCOUT')) {
      console.error('\nAborting — scout_item seed failed.')
      return
    }

    await stage_feed_post_write()
    await stage_payload_validate()
    const feedPost = await stage_hdua_fetch()
    await stage_render(feedPost)

    if (PIPELINE_MODE) {
      await stage_pipeline_api()
    }

  } finally {
    await cleanup()
    const allPassed = printSummary()
    process.exit(allPassed ? 0 : 1)
  }
}

main()
