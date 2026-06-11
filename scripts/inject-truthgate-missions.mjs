import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.join(__dirname, '..', 'NOTES', 'plan.json')
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf-8'))
const now = '2026-06-07T07:30:00.000Z'

const base = (o) => ({
  status: 'todo', lifecycleStatus: 'PLAN', coldCase: false, isDeleted: false,
  createdAt: now, inTimeline: true, userMission: false, auditReports: [], auditLog: [], ...o,
})

const missions = [
  base({
    id: 'P0-TRUTH-001-RECONCILE-FAKE-DONE',
    name: 'Reconcile fabricated MISSION_DONE missions',
    purpose: 'Re-audit the 92 missions marked DONE with a fabricated PASS and demote unproven ones to SIMULATED_ONLY so the timeline tells the truth.',
    description: 'Audit AUD-20260523-05 + this session proved the old /solve route hardcoded verdict=PASS, laundering 92 simulated runs into MISSION_DONE without any real build/test/runtime evidence. Triage each: keep MISSION_DONE only when real evidence exists (code merged, tests green, deliverable on disk); otherwise demote to SIMULATED_ONLY.',
    importantInfo: 'Do NOT blind-flip. Much of the repo is genuinely implemented. Each DONE mission needs a real evidence check (changedFiles present? tests run? deliverable exists?). Use lib/hd-central/evidence-contract.ts evaluateEvidence as the gate.',
    phase: 'Validate', priority: 'P0', urgencyScore: 96, sequenceIndex: 1,
    domains: ['QUALITY', 'SOFTWARE'], owners: ['system-auditor', 'plan-manager'],
    rationale: 'Dokud 92 misi ukazuje falesne zelene DONE, zadne rozhodnuti postavene na stavu mission timeline neni duveryhodne.',
    successCriteria: [
      'Kazda MISSION_DONE mise ma bud overeny evidence pack (verdict PASS s realnymi testy/zmenami), nebo je presunuta na SIMULATED_ONLY.',
      'Skript reconcile-evidence.mjs projde cely plan.json a vypise report verified vs demoted.',
      'Timeline Splnene zobrazuje jen realne dokoncene mise.',
    ],
    subMissions: [
      { id: 's1', name: 'Build reconcile script', description: 'Skript projde plan.json, pro kazdou MISSION_DONE spusti evaluateEvidence z dostupnych artefaktu (reportPath, changedFiles).', status: 'todo', owner: 'system-auditor', estimatedDuration: 'M', why: 'Potrebujeme deterministicky audit, ne rucni kontrolu 92 misi.' },
      { id: 's2', name: 'Classify evidence per mission', description: 'Oznac verified / simulated podle realnych artefaktu na disku (SYSTEM/INFO/MISSIONS report + git diff).', status: 'todo', owner: 'system-auditor', estimatedDuration: 'L' },
      { id: 's3', name: 'Demote unproven to SIMULATED_ONLY', description: 'Prepis lifecycleStatus na SIMULATED_ONLY u misi bez realne evidence, pridej audit log MISSION_SIMULATED_ONLY.', status: 'todo', owner: 'plan-manager', estimatedDuration: 'M' },
    ],
  }),
  base({
    id: 'P0-TRUTH-002-REAL-AGENT-BACKEND',
    name: 'Real agent-execution backend for /solve (replace simulator)',
    purpose: 'Replace the simulated buildSteps() orchestrator with real Claude agent invocation that produces a genuine evidence pack, so Solve can actually reach a verified MISSION_DONE.',
    description: 'The /solve route is a simulation: buildSteps() fabricates a log, runs no real test process, writes no product code. With the truth gate now wired, every Solve correctly yields SIMULATED_ONLY. To ever reach a real MISSION_DONE, solve must invoke real agents (Anthropic SDK) that run real work, capture testsRun exit codes + changedFiles, and have @system-auditor sign off auditorVerdict=PASS.',
    importantInfo: 'This is the "PR-Backend" referenced in the simulated report footer that never landed. Anthropic SDK already a dependency (@anthropic-ai/sdk). Respect token budget + cost ceiling per CLAUDE.md.',
    phase: 'Build', priority: 'P0', urgencyScore: 90, sequenceIndex: 2,
    domains: ['BACKEND', 'SOFTWARE', 'PIPELINE'], owners: ['backend-engineer', 'ai-pipeline'],
    rationale: 'Bez realneho backendu zustava Solve navzdy jen simulace — mise se nikdy legitimne nedokonci.',
    successCriteria: [
      '/solve invokes a real agent run and captures testsRun (real exit codes) + changedFiles.',
      'evaluateEvidence returns PASS only when the agent produced real artefacts and auditor signed off.',
      'A solved mission with real work reaches MISSION_DONE; a no-op run still yields SIMULATED_ONLY.',
    ],
    subMissions: [
      { id: 's1', name: 'Agent runner service', description: 'lib/hd-central/agent-runner.ts — invoke Anthropic SDK with tool use, capture changed files + command exit codes.', status: 'todo', owner: 'backend-engineer', estimatedDuration: 'L' },
      { id: 's2', name: 'Wire runner into /solve', description: 'Replace buildSteps simulation; build MissionEvidence from real runner output.', status: 'todo', owner: 'backend-engineer', estimatedDuration: 'M' },
      { id: 's3', name: 'Auditor sign-off step', description: '@system-auditor cross-checks deliverables vs success criteria and sets auditorVerdict.', status: 'todo', owner: 'system-auditor', estimatedDuration: 'M' },
    ],
  }),
  base({
    id: 'P1-CI-001-TYPECHECK-TEST-GATE',
    name: 'CI gate: tsc --noEmit + mission test suites',
    purpose: 'Block type drift and broken tests from reaching main — the same class of bug as the 12 stale test type-errors fixed this session.',
    description: 'This session found 12 typecheck errors (stale test fixtures) and 1 retired-stage comparison bug sitting in the tree, plus the truth-gate logic had no regression test. A pre-commit hook + CI job running `tsc --noEmit` and the mission/evidence test suites would have caught all of them.',
    phase: 'Validate', priority: 'P1', urgencyScore: 68, sequenceIndex: 3,
    domains: ['QUALITY', 'INFRASTRUCTURE'], owners: ['qa', 'devops'],
    rationale: 'Truth gate je jen tak silny jako jeho testy — bez CI se snadno tise rozbije.',
    successCriteria: [
      '.husky pre-commit runs tsc --noEmit and fails on any error.',
      'CI runs the full mission + evidence-contract test suites on every PR.',
      'Truth-gate regression tests (mission-lifecycle) are part of the required set.',
    ],
    subMissions: [
      { id: 's1', name: 'Pre-commit typecheck', description: 'Add tsc --noEmit to .husky/pre-commit for command-centrum.', status: 'todo', owner: 'devops', estimatedDuration: 'S' },
      { id: 's2', name: 'CI test job', description: 'GitHub Actions: run tsx --test on tests/mission-*.test.ts + evidence-contract.test.ts.', status: 'todo', owner: 'devops', estimatedDuration: 'M' },
    ],
  }),
  base({
    id: 'P1-UI-001-EVIDENCE-SURFACE',
    name: 'Surface evidence verdict + reasons in mission UI',
    purpose: 'Show the CEO WHY a mission is SIMULATED_ONLY instead of DONE — render verdict + evaluateEvidence reasons in the timeline and detail drawer.',
    description: 'The /solve response now returns verdict + evidenceReasons, and timeline-panel already styles SIMULATED_ONLY amber. Close the loop: render the amber badge with a tooltip/list of the rejection reasons (e.g. "No tests executed; No changedFiles recorded") in the mission detail drawer so the gap is actionable, not mysterious.',
    importantInfo: 'Frontend already distinguishes the amber tone in pickTone(); only the reasons list is missing. No backend change needed beyond what shipped this session.',
    phase: 'Build', priority: 'P1', urgencyScore: 60, sequenceIndex: 4,
    domains: ['FRONTEND', 'UI', 'QUALITY'], owners: ['frontend-engineer', 'qa'],
    rationale: 'Amber stav bez vysvetleni je matouci; CEO musi videt, co chybi k realnemu DONE.',
    successCriteria: [
      'Mission detail drawer shows the latest verdict and the list of evidence reasons.',
      'SIMULATED_ONLY missions show an amber "needs evidence" badge with the reasons on hover.',
      'A PASS mission shows a green verified badge with its evidence summary.',
    ],
    subMissions: [
      { id: 's1', name: 'Drawer evidence panel', description: 'Render auditReport.verdict + evidenceReasons in mission-detail-drawer.tsx.', status: 'todo', owner: 'frontend-engineer', estimatedDuration: 'M' },
      { id: 's2', name: 'Timeline reasons tooltip', description: 'Amber SIMULATED_ONLY badge with reasons tooltip in timeline-panel.tsx.', status: 'todo', owner: 'frontend-engineer', estimatedDuration: 'S' },
    ],
  }),
]

const existingIds = new Set(plan.missions.map((m) => m.id))
const fresh = missions.filter((m) => !existingIds.has(m.id))
plan.missions = [...fresh, ...plan.missions]
plan.updatedAt = now
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2), 'utf-8')
console.log('inserted', fresh.map((m) => m.id))
console.log('total missions now', plan.missions.length)
