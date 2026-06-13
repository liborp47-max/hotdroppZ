import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  detectRelease,
  scoreDropConfidence,
  decideAutoPublish,
  formatDropMessage,
  dispatchDropNotifications,
  computeP0Accuracy,
  AI_P0_THRESHOLD,
  AUTO_PUBLISH_THRESHOLD,
} from '../lib/pipeline/droppz-detector.ts'

// ─── 100-sample release-detection dataset ─────────────────────────────────────
// 60 positives (48 EN combinations + 12 multi-language) + 40 negatives.

const POS_ARTISTS = ['Drake', 'Kendrick Lamar', 'Central Cee', 'Travis Scott', 'Gunna', 'Aitch']
const POS_PHRASES = [
  "drops new single 'Nightshift'",
  "releases official video for 'Skyline'",
  'new album out now',
  'drops surprise EP today',
  "shares official music video for 'Faded'",
  'new mixtape available now',
  "drops new track 'Pressure'",
  'debut album out now',
]

const MULTILANG_POS = [
  'Yzomandias vydava novy singl',
  'Calin vydava nove album',
  'Capital Bra veroffentlicht neues Album',
  'Ufo361 veroffentlicht neue Single',
  'SCH sort un nouveau clip',
  'Ninho sort un nouvel album',
  'Bad Bunny lanza nuevo sencillo',
  'Anuel AA lanza nuevo album',
  'Mata wydaje nowy singiel',
  'Bedoes wydaje nowy album',
  'Viktor Sheen vydava novy videoklip',
  'Luciano veroffentlicht offizielles Video',
]

const NEGATIVES = [
  'Drake spotted courtside at Lakers game',
  'The 50 best rap albums of all time, ranked',
  'Kendrick Lamar opens up in rare interview',
  'Why drill music is taking over Europe',
  'Weekly hip-hop news roundup',
  'Travis Scott concert review: a chaotic night',
  'Top 10 verses of the decade',
  'A history of UK grime explained',
  'Gunna reacts to viral TikTok trend',
  'Central Cee breaks down his songwriting process',
  'Beef escalates between two rappers',
  'Rapper arrested on weapons charge',
  'The greatest producers in hip-hop',
  'Aitch talks fame and pressure in new interview',
  'Best new music videos this week',
  'Lawsuit filed against major record label',
  'Opinion: streaming is killing the album',
  'Throwback: revisiting a classic 2010 mixtape',
  'Festival lineup announced for this summer',
  'Chart update: who is number one this week',
  'Producer signs new management deal',
  'How streaming royalties actually work',
  'Ranking every Drake album from worst to best',
  'Grammy nominations announced',
  'Rapper responds to criticism online',
  'Inside the studio: a day with a sound engineer',
  'Fans react to surprise award show moment',
  'The rise and fall of a record label, explained',
  'Concert ticket prices spark controversy',
  'Five rappers who changed the game',
  'Interview: a veteran MC on 20 years in rap',
  'Why this rapper skipped the awards show',
  'Recap: the biggest moments from the cypher',
  'Artist teases project but gives no release date',
  'Rumour: collab reportedly in the works',
  'Magazine names its artist of the year',
  'Old feud resurfaces in new podcast',
  'Critics debate the state of modern rap',
  'Behind the scenes at a recording studio',
  'A rapper announces a world tour',
]

type Sample = { title: string; expect: boolean }

function buildDataset(): Sample[] {
  const samples: Sample[] = []
  for (const artist of POS_ARTISTS) {
    for (const phrase of POS_PHRASES) {
      samples.push({ title: `${artist} ${phrase}`, expect: true })
    }
  }
  for (const title of MULTILANG_POS) samples.push({ title, expect: true })
  for (const title of NEGATIVES) samples.push({ title, expect: false })
  return samples
}

// ─── SM1: detectRelease ───────────────────────────────────────────────────────

test('detectRelease classifies the 100-sample dataset with >= 95% accuracy', () => {
  const dataset = buildDataset()
  assert.equal(dataset.length, 100, 'dataset must contain exactly 100 samples')

  let correct = 0
  const misses: string[] = []
  for (const sample of dataset) {
    const got = detectRelease({ title: sample.title }).is_release
    if (got === sample.expect) correct++
    else misses.push(`${sample.expect ? 'POS' : 'NEG'} misclassified: "${sample.title}"`)
  }

  const accuracy = correct / dataset.length
  console.log(`detectRelease accuracy: ${correct}/100 (${(accuracy * 100).toFixed(0)}%)`)
  if (misses.length) console.log(misses.join('\n'))
  assert.ok(correct >= 95, `expected >= 95 correct, got ${correct}`)
})

test("detectRelease flags the named patterns: 'drops', 'out now', 'official video'", () => {
  assert.equal(detectRelease({ title: 'Drake drops a new joint' }).is_release, true)
  assert.equal(detectRelease({ title: "Artist's new single is out now" }).is_release, true)
  assert.equal(detectRelease({ title: 'Kendrick Lamar releases official video' }).is_release, true)
})

test('detectRelease — Droppz category still needs a real release signal (content-quality fix 2026-06-12)', () => {
  // Category alone no longer fakes a drop — editorial/self-promo tagged `droppz`
  // must carry an actual release signal or a known artist.
  const generic = detectRelease({ title: 'Generic headline', category: 'droppz' })
  assert.equal(generic.is_release, false, 'generic droppz headline is NOT a release')

  const real = detectRelease({ title: "Surprise EP out now", category: 'droppz' })
  assert.equal(real.is_release, true)
  assert.equal(real.priority, 'P0')
  assert.equal(real.is_droppz, true)
})

test('detectRelease — negative guard vetoes even in droppz category', () => {
  // Rankings / reviews / interviews from a droppz-tagged magazine are not drops.
  const ranking = detectRelease({ title: 'The 50 Best Albums of 2026, Ranked', category: 'droppz' })
  assert.equal(ranking.is_release, false)
})

test('detectRelease — release in a rap category is promoted to P0 droppz', () => {
  const det = detectRelease({ title: "Drake drops new single 'X'", category: 'usa_rap' })
  assert.equal(det.is_release, true)
  assert.equal(det.priority, 'P0')
  assert.equal(det.artist, 'drake')
  assert.equal(det.artist_tier, 'top100')
  assert.ok(det.rule_confidence > 0.8)
})

test('detectRelease — release type precedence: video over album', () => {
  const det = detectRelease({ title: 'New album out now with official video' })
  assert.equal(det.release_type, 'video')
})

test('detectRelease — non-release stays low confidence', () => {
  const det = detectRelease({ title: 'Top 10 rappers ranked' })
  assert.equal(det.is_release, false)
  assert.ok(det.rule_confidence < 0.2)
})

// ─── SM2: scoreDropConfidence ─────────────────────────────────────────────────

const candidates = [
  { id: 'a', title: "Drake drops new single 'Nightshift'", artist: 'Drake', category: 'usa_rap' },
  { id: 'b', title: 'Weekly hip-hop roundup', artist: null, category: 'news' },
]

test('scoreDropConfidence — parses AI output and applies the P0 threshold', async () => {
  const aiCall = async () =>
    JSON.stringify([
      { confidence: 0.94, is_official: true, audience_size: 'large' },
      { confidence: 0.32, is_official: false, audience_size: 'small' },
    ])
  const scored = await scoreDropConfidence(candidates, { aiCall })
  assert.equal(scored.length, 2)
  assert.equal(scored[0].source, 'ai')
  assert.equal(scored[0].confidence, 0.94)
  assert.equal(scored[0].priority, 'P0', 'confidence above threshold => P0')
  assert.equal(scored[1].priority, 'P1', 'confidence below threshold => P1')
  assert.ok(AI_P0_THRESHOLD > 0 && AI_P0_THRESHOLD < 1)
})

test('scoreDropConfidence — falls back to rule confidence on AI failure', async () => {
  const aiCall = async () => { throw new Error('groq down') }
  const scored = await scoreDropConfidence(candidates, { aiCall })
  assert.equal(scored.length, 2)
  assert.equal(scored[0].source, 'fallback')
  assert.ok(scored[0].confidence > 0, 'fallback still produces a confidence')
})

test('scoreDropConfidence — scores at most the top 10 candidates', async () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ id: `c${i}`, title: `Artist drops single ${i}` }))
  const aiCall = async () =>
    JSON.stringify(Array.from({ length: 10 }, () => ({ confidence: 0.9, is_official: true, audience_size: 'mid' })))
  const scored = await scoreDropConfidence(many, { aiCall })
  assert.equal(scored.length, 10)
})

// ─── SM3: decideAutoPublish ───────────────────────────────────────────────────

test('decideAutoPublish — P0 top-100 artist with confidence > 0.9 publishes', () => {
  const det = detectRelease({ title: "Drake drops new single 'X'", category: 'usa_rap' })
  const decision = decideAutoPublish(det, {
    id: 'a', confidence: 0.95, is_official: true, audience_size: 'large', priority: 'P0', source: 'ai',
  })
  assert.equal(decision.action, 'publish')
})

test('decideAutoPublish — confidence at/below 0.9 stages a draft', () => {
  const det = detectRelease({ title: "Drake drops new single 'X'", category: 'usa_rap' })
  const decision = decideAutoPublish(det, {
    id: 'a', confidence: AUTO_PUBLISH_THRESHOLD, is_official: true, audience_size: 'large', priority: 'P0', source: 'ai',
  })
  assert.equal(decision.action, 'draft')
})

test('decideAutoPublish — non-top-100 artist stages a draft even at high confidence', () => {
  const det = detectRelease({ title: 'Unknown artist drops new single', category: 'usa_rap' })
  const decision = decideAutoPublish(det, {
    id: 'a', confidence: 0.99, is_official: true, audience_size: 'mid', priority: 'P0', source: 'ai',
  })
  assert.equal(decision.action, 'draft')
  assert.equal(decision.reason, 'artist_not_top100')
})

// ─── SM4: notifications ───────────────────────────────────────────────────────

test('formatDropMessage — matches the {artist} drops {title} — {url} template', () => {
  const msg = formatDropMessage({ artist: 'Drake', title: 'Nightshift', url: 'https://hotdroppz.com/x' })
  assert.equal(msg, 'Drake drops Nightshift — https://hotdroppz.com/x')
})

test('dispatchDropNotifications — no env configured => all channels skipped', async () => {
  const res = await dispatchDropNotifications(
    { artist: 'Drake', title: 'Nightshift', url: 'https://x' },
    { env: {}, fetchImpl: (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch },
  )
  assert.equal(res.discord, false)
  assert.equal(res.telegram, false)
  assert.equal(res.push, false)
  assert.equal(res.errors.length, 0)
})

test('dispatchDropNotifications — fires Discord, Telegram and push when configured', async () => {
  const hits: string[] = []
  const fetchImpl = (async (url: string) => {
    hits.push(String(url))
    return { ok: true, status: 200 }
  }) as unknown as typeof fetch

  const res = await dispatchDropNotifications(
    { artist: 'Drake', title: 'Nightshift', url: 'https://x' },
    {
      fetchImpl,
      env: {
        DISCORD_WEBHOOK_URL: 'https://discord.test/hook',
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_ID: 'chat',
        DROPPZ_PUSH_WEBHOOK_URL: 'https://push.test/hook',
      },
    },
  )
  assert.equal(res.discord, true)
  assert.equal(res.telegram, true)
  assert.equal(res.push, true)
  assert.equal(res.message, 'Drake drops Nightshift — https://x')
  assert.equal(hits.length, 3)
  assert.ok(hits.some((u) => u.includes('api.telegram.org')))
})

test('dispatchDropNotifications — a broken channel does not block the others', async () => {
  const fetchImpl = (async (url: string) => {
    if (String(url).includes('discord')) throw new Error('discord unreachable')
    return { ok: true, status: 200 }
  }) as unknown as typeof fetch

  const res = await dispatchDropNotifications(
    { artist: 'Drake', title: 'Nightshift', url: 'https://x' },
    {
      fetchImpl,
      env: { DISCORD_WEBHOOK_URL: 'https://discord.test/hook', DROPPZ_PUSH_WEBHOOK_URL: 'https://push.test/hook' },
    },
  )
  assert.equal(res.discord, false)
  assert.equal(res.push, true)
  assert.equal(res.errors.length, 1)
})

// ─── SM5: computeP0Accuracy ───────────────────────────────────────────────────

test('computeP0Accuracy — high precision keeps the threshold', () => {
  const ratings = Array.from({ length: 10 }, (_, i) => (i < 9 ? 'on_time' : 'late')) as Array<
    'on_time' | 'late' | 'false_positive'
  >
  const report = computeP0Accuracy(ratings)
  assert.equal(report.total, 10)
  assert.equal(report.precision, 1)
  assert.equal(report.meets_target, true)
  assert.equal(report.recommendation, 'keep_threshold')
})

test('computeP0Accuracy — low precision recommends raising the threshold', () => {
  const ratings = ['on_time', 'false_positive', 'false_positive', 'false_positive'] as Array<
    'on_time' | 'late' | 'false_positive'
  >
  const report = computeP0Accuracy(ratings, { currentThreshold: 0.85 })
  assert.ok(report.precision < 0.9)
  assert.equal(report.meets_target, false)
  assert.equal(report.recommended_threshold, 0.9)
  assert.ok(report.recommendation.startsWith('raise_threshold'))
})

test('computeP0Accuracy — missed drops lower recall and recommend lowering the threshold', () => {
  const ratings = Array.from({ length: 10 }, () => 'on_time') as Array<'on_time' | 'late' | 'false_positive'>
  const report = computeP0Accuracy(ratings, { missedP0: 6, currentThreshold: 0.85 })
  assert.ok(report.recall < 0.9)
  assert.ok(report.recommendation.startsWith('lower_threshold'))
})

test('computeP0Accuracy — no data yields a no_data recommendation', () => {
  const report = computeP0Accuracy([])
  assert.equal(report.total, 0)
  assert.equal(report.recommendation, 'no_data')
})
