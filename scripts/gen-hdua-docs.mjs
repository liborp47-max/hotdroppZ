// scripts/gen-hdua-docs.mjs
// Generates HDUA/MISSIONS.md from the HDUA missions in NOTES/plan.json so the
// human-readable plan never drifts from the system of record. Re-run after
// seed-hdua-missions.mjs.
//
// Run: node scripts/gen-hdua-docs.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.resolve(__dirname, '..', 'NOTES', 'plan.json')
const OUT = path.resolve(__dirname, '..', 'HDUA', 'MISSIONS.md')

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const hdua = plan.missions
  .filter((m) => String(m.id).startsWith('HDUA-'))
  .sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))

const lines = []
lines.push('# HDUA — Mise (chronologicky)')
lines.push('')
lines.push('> Generováno z `NOTES/plan.json` (`scripts/gen-hdua-docs.mjs`). Needituj ručně — uprav misi v plan.json a re-generuj.')
lines.push('')
lines.push(`Celkem ${hdua.length} misí. Pořadí = \`sequenceIndex\`. Označení v systému: \`moduleId: "HDUA"\`, \`userMission: true\`.`)
lines.push('')
lines.push('## Přehled')
lines.push('')
lines.push('| seq | id | fáze | prio | komplexita | mise |')
lines.push('|-----|----|------|------|-----------|------|')
for (const m of hdua) {
  lines.push(
    `| ${m.sequenceIndex} | \`${m.id}\` | ${m.phase} | ${m.priority} | ${m.estimatedComplexity ?? '-'} | ${m.name} |`,
  )
}
lines.push('')
lines.push('---')
lines.push('')

for (const m of hdua) {
  lines.push(`## ${m.sequenceIndex - 200}. ${m.name}`)
  lines.push('')
  lines.push(`- **ID:** \`${m.id}\`  ·  **Fáze:** ${m.phase}  ·  **Priorita:** ${m.priority}  ·  **Komplexita:** ${m.estimatedComplexity ?? '-'}`)
  lines.push(`- **Domény:** ${(m.domains || []).join(', ')}  ·  **Cesta:** \`${m.modulePath ?? '-'}\``)
  lines.push('')
  lines.push(`**Účel.** ${m.purpose}`)
  lines.push('')
  lines.push(`**Co (popis).** ${m.description ?? ''}`)
  lines.push('')
  lines.push(`**Proč (rationale).** ${m.rationale ?? ''}`)
  lines.push('')
  if (m.importantInfo) {
    lines.push(`> **Pozor / důležité:** ${m.importantInfo}`)
    lines.push('')
  }
  if ((m.successCriteria || []).length) {
    lines.push('**Hotovo když (success criteria):**')
    for (const c of m.successCriteria) lines.push(`- ${c}`)
    lines.push('')
  }
  if ((m.subMissions || []).length) {
    lines.push('**Kroky (sub-mise):**')
    lines.push('')
    lines.push('| # | krok | jak | proč | owner | odhad |')
    lines.push('|---|------|-----|------|-------|-------|')
    for (const sub of m.subMissions) {
      lines.push(
        `| ${sub.id} | ${sub.name} | ${sub.description} | ${sub.why ?? '-'} | ${sub.owner ?? '-'} | ${sub.estimatedDuration ?? '-'} |`,
      )
    }
    lines.push('')
  }
  lines.push('---')
  lines.push('')
}

fs.writeFileSync(OUT, lines.join('\n'))
console.log('Wrote', path.relative(path.resolve(__dirname, '..'), OUT), '—', hdua.length, 'missions')
