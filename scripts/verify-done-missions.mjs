/**
 * verify-done-missions.mjs — deep audit of every current MISSION_DONE.
 *
 * The reconcile gate only required ONE declared deliverable to exist. This
 * goes deeper: it checks ALL declared targets per mission, measures substance
 * (lines of real code), and assigns an honest confidence so "done" missions
 * that are only partially delivered (or grandfathered with no proof) surface.
 *
 *   HIGH    — every declared target present + substantial
 *   MEDIUM  — some targets present, some missing (partial delivery)
 *   LOW     — grandfathered with no checkable deliverable, OR a single thin file
 *   NONE    — claims DONE but nothing real found (should not happen post-reconcile)
 *
 * Read-only. Writes a report to SYSTEM/INFO/AUDITS/EVIDENCE_RECONCILE/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HD = path.join(__dirname, '..')
const PLAN = path.join(HD, 'NOTES', 'plan.json')
const NOW = new Date().toISOString()
const ROOTS = [HD, path.join(HD, 'command-centrum')]

const STUB_MARKERS = ['not_implemented', "status: 'not_implemented'", 'TODO: implement', 'TODO: stub', '// stub']
const RETIRED_STAGES = ['translator', 'multilang', 'monetizer', 'graphics', 'final-check']

// Same inferred map the reconcile used, so no-modulePath infra missions are
// audited against the same concrete paths.
const INFERRED = {
  'P0-002-OWASP': ['backend/src/config/cors.ts', 'backend/src/main.ts'],
  'P0-004-ANALYTICS': ['command-centrum/app/api/analytics/route.ts', 'command-centrum/app/(dashboard)/analytics/page.tsx'],
  'P0-006-CRON': ['command-centrum/vercel.json', 'command-centrum/app/api/cron'],
  'P0-007-GDPR': ['frontend-web/components/consent/ConsentProvider.tsx', 'frontend-web/lib/consent/consent.ts'],
  'P1-001-CI': ['.github/workflows/backend-quality.yml', '.github/workflows/command-centrum-quality.yml'],
  'P1-002-SEO': ['frontend-web/app/sitemap.ts', 'frontend-web/app/robots.ts'],
  'P1-005-DISTRIBUTION': ['command-centrum/app/api/distribution/queue/route.ts', 'command-centrum/app/(dashboard)/distribution/page.tsx'],
}

function splitTargets(mp) {
  return mp.split(/[,;·]+/).map((t) => t.trim()).filter(Boolean)
}
function globToRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') { if (glob[i + 1] === '*') { re += '.*'; i++ } else re += '[^/\\\\]*' }
    else if ('\\^$+?.()|[]{}'.includes(c)) re += '\\' + c
    else re += c
  }
  return new RegExp('^' + re + '$')
}
function walk(dir, acc = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (['node_modules', '.next', '.git'].includes(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc); else acc.push(full)
  }
  return acc
}
function loc(file) {
  try {
    const c = fs.readFileSync(file, 'utf-8')
    if (STUB_MARKERS.some((m) => c.toLowerCase().includes(m.toLowerCase()))) return 0
    return c.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length
  } catch { return 0 }
}

/** Resolve one target -> { found, files:[...], lines } across roots. */
function resolveTarget(t) {
  const isGlob = t.includes('*')
  for (const root of ROOTS) {
    if (isGlob) {
      const baseRel = t.slice(0, t.indexOf('*')).replace(/[\\/][^\\/]*$/, '')
      const baseAbs = path.join(root, baseRel)
      if (!fs.existsSync(baseAbs)) continue
      const rx = globToRegex(t.replace(/\\/g, '/'))
      const hits = walk(baseAbs).filter((f) => rx.test(path.relative(root, f).replace(/\\/g, '/')))
      if (hits.length) return { found: true, files: hits.length, lines: hits.reduce((a, f) => a + loc(f), 0) }
    } else {
      const abs = path.join(root, t)
      let st; try { st = fs.statSync(abs) } catch { continue }
      if (st.isDirectory()) {
        const files = walk(abs)
        if (files.length) return { found: true, files: files.length, lines: files.reduce((a, f) => a + loc(f), 0) }
      } else {
        const l = loc(abs)
        if (l > 0) return { found: true, files: 1, lines: l }
      }
    }
  }
  return { found: false, files: 0, lines: 0 }
}

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf-8'))
const done = plan.missions.filter((m) => m.lifecycleStatus === 'MISSION_DONE')

const rows = []
for (const m of done) {
  const mp = (m.modulePath || '').trim()
  let targets = mp ? splitTargets(mp) : (INFERRED[m.id] || [])
  // strip retired-stage targets from the "expected" set (they're meant to be gone)
  targets = targets.filter((t) => {
    const base = t.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') || ''
    return !RETIRED_STAGES.includes(base)
  })

  const checks = targets.map((t) => ({ t, ...resolveTarget(t) }))
  const present = checks.filter((c) => c.found)
  const missing = checks.filter((c) => !c.found)
  const totalLines = present.reduce((a, c) => a + c.lines, 0)
  const grand = m.evidenceGrandfathered === true

  let confidence
  if (targets.length === 0) {
    confidence = grand ? 'LOW' : 'NONE'           // grandfathered no-path, or genuinely nothing
  } else if (missing.length === 0) {
    confidence = totalLines >= 40 ? 'HIGH' : 'LOW' // all present; thin if <40 real lines
  } else if (present.length === 0) {
    confidence = 'NONE'
  } else {
    confidence = 'MEDIUM'                          // partial delivery
  }

  rows.push({
    id: m.id, confidence, grand,
    present: present.length, total: targets.length, lines: totalLines,
    missing: missing.map((c) => c.t),
  })
}

const order = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
rows.sort((a, b) => order[a.confidence] - order[b.confidence] || a.lines - b.lines)

const tally = {}
rows.forEach((r) => (tally[r.confidence] = (tally[r.confidence] || 0) + 1))

const out = []
out.push('# Deep Verification — current MISSION_DONE')
out.push('')
out.push(`- generatedAt: ${NOW}`)
out.push(`- MISSION_DONE audited: **${rows.length}**`)
out.push(`- confidence: ${JSON.stringify(tally)}`)
out.push('')
out.push('| confidence | mission | targets present | real LOC | grandfathered | missing |')
out.push('|---|---|---|---|---|---|')
for (const r of rows) {
  out.push(`| ${r.confidence} | \`${r.id}\` | ${r.present}/${r.total} | ${r.lines} | ${r.grand ? 'yes' : ''} | ${r.missing.slice(0, 3).join(' · ')} |`)
}

const dir = path.join(HD, '..', 'INFO', 'AUDITS', 'EVIDENCE_RECONCILE')
fs.mkdirSync(dir, { recursive: true })
const rp = path.join(dir, `verify-done-${NOW.replace(/[:.]/g, '-')}.md`)
fs.writeFileSync(rp, out.join('\n'), 'utf-8')
console.log(out.join('\n'))
console.log('\nreport:', path.relative(HD, rp).replace(/\\/g, '/'))
