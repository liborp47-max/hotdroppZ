/**
 * HD Central Glossary — single source of truth for InfoBox tooltips.
 *
 * Every key value shown in the UI (priority pills, phase chips, status badges,
 * urgency scores, lifecycle markers, mission types, agent roles) maps to a glossary
 * term that explains what it means, when it applies, and what's implied for execution.
 *
 * Patch-friendly: add new terms via `addGlossaryTerm()` or extend the object directly.
 * Existing UI consumers that don't know about new terms gracefully fall back to value display.
 */

export interface GlossaryEntry {
  /** Internal stable key (URL/state safe). */
  term: string
  /** Human-readable title shown in tooltip header. */
  title: string
  /** 1–2 sentence definition. */
  definition: string
  /** When/how the value applies (criteria). */
  triggers?: string[]
  /** Downstream implications for execution. */
  implications?: string[]
  /** Pointer to source of truth (audit doc, spec). */
  sourceRef?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ─── Priorities ─────────────────────────────────────────────────────────────
  'priority-P0': {
    term: 'priority-P0',
    title: 'P0 — Critical priority',
    definition: 'Nejvyšší priorita. Mission blokuje jiné práce nebo má hard deadline ≤ 24 h.',
    triggers: [
      'Cycle v blocker chain',
      'Critical severity v audit chainu',
      'Security / auth / secret keyword',
      'Blokuje ≥ 3 jiné mise',
      'Explicit CEO ask',
    ],
    implications: [
      'Musí být řešena do 24 h',
      'Blokuje dependent mise',
      'Sequencer řadí jako první v phase',
    ],
    sourceRef: 'C:/Users/KELEVERA/.claude/agents/plan-manager.md',
  },
  'priority-P1': {
    term: 'priority-P1',
    title: 'P1 — High priority',
    definition: 'Vysoká priorita. Důležitá ale ne blokující práce; měla by se řešit tento týden.',
    triggers: ['High severity audit finding', 'Blokuje 1–2 mise', 'Pipeline-critical stage (writer/scout/curator)'],
    implications: ['Sequencer řadí po P0 v rámci phase', 'Týdenní deadline default'],
  },
  'priority-P2': {
    term: 'priority-P2',
    title: 'P2 — Medium priority',
    definition: 'Standardní práce. Plánovaná zlepšení, validation, scope expansion.',
    triggers: ['Medium severity', 'Žádný hard blocker', 'Plánovaná nice-to-have'],
    implications: ['Sprint-level planning', 'Lze pausovat když přijde P0/P1'],
  },
  'priority-P3': {
    term: 'priority-P3',
    title: 'P3 — Low priority',
    definition: 'Cosmetic, docs, backlog. Bez deadline, řeší se když je čas.',
    triggers: ['Low severity', 'Cosmetic / docs / refactor', 'Backlog cleanup'],
    implications: ['Quarter-level planning', 'První kandidát na pause/archive'],
  },

  // ─── Phases ─────────────────────────────────────────────────────────────────
  'phase-Foundation': {
    term: 'phase-Foundation',
    title: 'Foundation phase',
    definition: 'Základ systému: bezpečnost, infrastruktura, databáze, schema. Bez Foundation nelze stavět zbytek.',
    triggers: ['Security · Infrastructure · Database domain'],
    implications: ['Musí být hotové před Build phase', 'Sequencer řadí jako první'],
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'phase-Build': {
    term: 'phase-Build',
    title: 'Build phase',
    definition: 'Vývoj core funkčnosti: pipeline, backend, frontend. Tady vzniká skutečná feature.',
    triggers: ['Pipeline · Backend · Frontend domain'],
    implications: ['Začíná po dokončení Foundation', 'Lze paralelizovat napříč doménami'],
  },
  'phase-Validate': {
    term: 'phase-Validate',
    title: 'Validate phase',
    definition: 'Validace, kvalita, audit. QA, testy, security review, performance benchmark.',
    triggers: ['QA · Quality · Audit domain'],
    implications: ['Po Build, před Launch', 'Blokuje deployment'],
  },
  'phase-Launch': {
    term: 'phase-Launch',
    title: 'Launch phase',
    definition: 'Distribuce, publish, externí integrace. První kontakt s uživatelem.',
    triggers: ['Distribution · Publish · External integration'],
    implications: ['Po Validate', 'Vyžaduje monitoring + rollback plan'],
  },
  'phase-Scale': {
    term: 'phase-Scale',
    title: 'Scale phase',
    definition: 'Analytics, optimalizace, monitoring, ops cleanup. Continuous improvement loop.',
    triggers: ['Analytics · Operations · Performance optimization'],
    implications: ['Po Launch, ongoing', 'Feedback loop do Plan Manageru'],
  },

  // ─── Lifecycle statuses ────────────────────────────────────────────────────
  'mission-status-PLAN': {
    term: 'mission-status-PLAN',
    title: 'PLAN — Queued',
    definition: 'Mise je v Timeline queue, čeká na promotion do ACTIVE. Sequencer ji vybere podle phase + priority + urgency.',
    implications: ['Žádná execution', 'Lze editovat scope', 'Lze archivovat'],
  },
  'mission-status-ACTIVE': {
    term: 'mission-status-ACTIVE',
    title: 'ACTIVE — Running',
    definition: 'Mise je právě aktivně řešená CEO orchestratorem. Auto-promoted z PLAN když není jiná aktivní mise.',
    triggers: ['Promoted as lowest sequenceIndex v PLAN queue'],
    implications: ['Max 1 ACTIVE per čas', 'Solve flow běží', 'Nelze pausovat without manual intervention'],
  },
  'mission-status-CEO_RESOLVED': {
    term: 'mission-status-CEO_RESOLVED',
    title: 'CEO_RESOLVED — Decided',
    definition: 'CEO rozhodl o řešení. Předáno AUDITOR_TEST pro verifikaci.',
    implications: ['Mezistav před AUDIT_PENDING', 'Auto-transition v solve flow'],
  },
  'mission-status-AUDIT_PENDING': {
    term: 'mission-status-AUDIT_PENDING',
    title: 'AUDIT_PENDING — Verifying',
    definition: 'Auditor běží smoke test + success criteria check. Pokud PASS → MISSION_DONE; FAIL → zpět do PLAN.',
  },
  'mission-status-MISSION_DONE': {
    term: 'mission-status-MISSION_DONE',
    title: 'MISSION_DONE — Completed',
    definition: 'Audit PASS. Mise hotová, sklouzla do "Splněné" sekce v Timeline. Plně auditovatelná v plan.json.',
    implications: ['Sub-mise všechny status=done', 'Report uložený v SYSTEM/INFO/MISSIONS/', 'Nelze re-run bez explicit reopen'],
  },

  // ─── Sub-mission statuses ──────────────────────────────────────────────────
  'sub-status-todo': {
    term: 'sub-status-todo',
    title: 'TODO — Not started',
    definition: 'Sub-mise čeká na execution. Default state při vytvoření.',
  },
  'sub-status-in_progress': {
    term: 'sub-status-in_progress',
    title: 'IN PROGRESS — Working',
    definition: 'Owner agent aktivně řeší. Lze sledovat v Live Process panelu.',
    implications: ['Nelze duplicate-execute', 'Status musí přejít na done nebo blocked'],
  },
  'sub-status-done': {
    term: 'sub-status-done',
    title: 'DONE — Completed',
    definition: 'Sub-mise hotová, completedAt timestamp set. Parent mission progress bar se posunul.',
    implications: ['Artifact uložený v SYSTEM/INFO/MISSIONS/<runId>/', 'Audit log entry MISSION_SOLVE_STEP_DONE'],
  },
  'sub-status-blocked': {
    term: 'sub-status-blocked',
    title: 'BLOCKED — Stuck',
    definition: 'Owner narazil na blocker (chybějící deps, nejasný scope, decision needed). Vyžaduje plan-manager review.',
    triggers: ['Unresolved dependency', 'Scope conflict s parent mission', 'Missing files / approvals'],
    implications: ['Parent mission má visible warning', 'Plan Manager dostane RNS item'],
  },

  // ─── Urgency ──────────────────────────────────────────────────────────────
  'urgency-score': {
    term: 'urgency-score',
    title: 'Urgency Score (0–100)',
    definition: 'Vypočtené skóre kombinující severity, dependency depth, blocker impact, cycle detection. Vyšší = naléhavější.',
    triggers: [
      'severity (40 % weight) — Critical=100, High=75, Medium=45, Low=20',
      'blocker impact (35 %) — status + count of blocked dependents',
      'dependency depth (15 %) — distance to leaf',
      'unresolved deps + blocked dependents (10 %)',
      'cycle detection → 100 (overrides)',
    ],
    implications: ['≥ 85 = critical band', '≥ 70 = high', '≥ 50 = medium', '< 50 = low'],
    sourceRef: 'command-centrum/components/planning-room/plans-logic.ts:152',
  },

  // ─── Mission types ────────────────────────────────────────────────────────
  'mission-type-userMission': {
    term: 'mission-type-userMission',
    title: 'User Mission',
    definition: 'Mise vytvořená z system audit seed (audit-driven). Bohatá metadata: rationale, success criteria, sub-missions, modulePath.',
    triggers: ['Importovaná přes /api/hd-central/missions/seed', 'Má userMission=true flag'],
  },
  'mission-type-auto': {
    term: 'mission-type-auto',
    title: 'Auto-generated Mission',
    definition: 'Mise vytvořená Mission Officer / Plan Manager z task batches. Lehčí metadata.',
    triggers: ['Plan Manager runtime output', 'MO-XX prefix v ID'],
  },

  // ─── Health ───────────────────────────────────────────────────────────────
  'health-green': {
    term: 'health-green',
    title: 'Health: Green',
    definition: 'Worker / mission běží zdravě. Error rate < 5 %, latency v normálu.',
  },
  'health-amber': {
    term: 'health-amber',
    title: 'Health: Amber',
    definition: 'Pozor — error rate 5–20 % nebo blokující auth pending. Vyžaduje monitoring.',
  },
  'health-red': {
    term: 'health-red',
    title: 'Health: Red',
    definition: 'Selhalo. Error rate > 20 % nebo > 48 h bez úspěšného runu. Vyžaduje urgent fix.',
  },

  // ─── Agent roles ──────────────────────────────────────────────────────────
  'agent-plan-manager': {
    term: 'agent-plan-manager',
    title: '@plan-manager',
    definition: 'Senior planning specialist. Konvertuje audit data na mission packages, počítá urgency, RNS feed.',
    sourceRef: 'C:/Users/KELEVERA/.claude/agents/plan-manager.md',
  },
  'agent-backend-engineer': {
    term: 'agent-backend-engineer',
    title: '@backend-engineer',
    definition: 'Server-side API, business logic, integrations. REST/GraphQL, NestJS, Next.js routes.',
  },
  'agent-frontend-engineer': {
    term: 'agent-frontend-engineer',
    title: '@frontend-engineer',
    definition: 'React/Next.js komponenty, UI patterns, client-side state.',
  },
  'agent-db-engineer': {
    term: 'agent-db-engineer',
    title: '@db-engineer',
    definition: 'PostgreSQL/Supabase schema, migrations, indexes, performance.',
  },
  'agent-ai-pipeline': {
    term: 'agent-ai-pipeline',
    title: '@ai-pipeline',
    definition: 'LangGraph orchestrace, Claude/Groq integration, prompt engineering pro pipeline stages.',
  },
  'agent-qa': {
    term: 'agent-qa',
    title: '@qa',
    definition: 'Testing — unit, integration, E2E, smoke tests, success criteria validation.',
  },
  'agent-system-auditor': {
    term: 'agent-system-auditor',
    title: '@system-auditor',
    definition: 'Cross-checks deliverables vs audit refs, generates audit reports, drift detection.',
  },
  'agent-devops': {
    term: 'agent-devops',
    title: '@devops',
    definition: 'CI/CD, deployment, Docker, monitoring, alerts, cron jobs.',
  },
  'agent-security': {
    term: 'agent-security',
    title: '@security',
    definition: 'Auth, secrets, rate limiting, OWASP, compliance, brand safety.',
  },

  // ─── In Timeline status ────────────────────────────────────────────────────
  'in-timeline-true': {
    term: 'in-timeline-true',
    title: 'In Timeline',
    definition: 'Mise pushnutá z inboxu do Mission Timeline. Sequencer ji řadí podle priority.',
  },
  'in-timeline-false': {
    term: 'in-timeline-false',
    title: 'In Inbox (staging)',
    definition: 'Mise čeká v CEO Missions inboxu. Neuvidí ji Mission Timeline.',
  },

  // ─── Pipeline stage runtime statuses ───────────────────────────────────────
  'stage-status-active': {
    term: 'stage-status-active',
    title: 'Stage: Active',
    definition: 'Stage je v produkci, plně funkční, prochází health monitoring.',
    implications: ['Health metrics se sbírají', 'Manual trigger povolen', 'Auto-schedule běží'],
  },
  'stage-status-degraded': {
    term: 'stage-status-degraded',
    title: 'Stage: Degraded',
    definition: 'Stage běží ale s degradovanou funkcionalitou (stub, partial impl, fallback mode).',
    triggers: ['Stub implementace bez plného AI', 'Fallback po model error', 'Partial feature coverage'],
    implications: ['UI ukazuje amber warning', 'Output se kontroluje extra', 'Vyžaduje upgrade plan'],
  },
  'stage-status-retired': {
    term: 'stage-status-retired',
    title: 'Stage: Retired',
    definition: 'Stage byl deprecated, vrací 410 Gone, zachován jen pro audit trail.',
    implications: ['Žádné nové runs', 'Manual trigger zakázán', 'Data zůstávají pro historii'],
  },

  // ─── Config knobs ──────────────────────────────────────────────────────────
  'schedule-cron': {
    term: 'schedule-cron',
    title: 'Schedule (cron)',
    definition: 'Cron expression určující kdy stage běží automaticky (např. `0 */4 * * *` = každé 4 hodiny).',
    implications: ['null = manual-only trigger', 'Vyhodnocuje scheduler podle UTC'],
  },
  'rate-limit': {
    term: 'rate-limit',
    title: 'Rate Limit (req/s)',
    definition: 'Maximální počet requestů za sekundu vůči external API; chrání před banem.',
    implications: ['Překročení = throttle + retry s backoff', 'Per-gateway tracking'],
  },
  'token-budget': {
    term: 'token-budget',
    title: 'Token Budget',
    definition: 'Max output tokens per pipeline node call (default 2048).',
    implications: ['Hard cap na model response', 'Překročení = truncate + warning'],
    sourceRef: 'SYSTEM/hotdroppz/CLAUDE.md',
  },
  'cost-ceiling': {
    term: 'cost-ceiling',
    title: 'Cost Ceiling',
    definition: 'Maximální cena ($) per pipeline artifact (default $0.10/article).',
    implications: ['Překročení = skip article + alert', 'Haiku pro classification, Sonnet pro content'],
    sourceRef: 'SYSTEM/hotdroppz/CLAUDE.md',
  },

  // ─── Identifiers ───────────────────────────────────────────────────────────
  'correlation-id': {
    term: 'correlation-id',
    title: 'Correlation ID',
    definition: 'UUID propaguje napříč pipeline runem pro distributed tracing; v každém log entry.',
    implications: ['Umožní rekonstrukci end-to-end runu', 'Předává se v headers + DB columns'],
  },
  'idempotency-key': {
    term: 'idempotency-key',
    title: 'Idempotency Key',
    definition: 'Klíč zabraňující double-processing; pipeline stage updatuje DB jen pokud `status === expectedPrevious`.',
    implications: ['Bezpečný retry', 'Žádný duplicate write'],
  },
  'secret-ref': {
    term: 'secret-ref',
    title: 'Secret Reference',
    definition: 'Pointer na env var (např. `env:SPOTIFY_CLIENT_ID`); UI maskuje hodnotu.',
    implications: ['Žádný plaintext secret v repo', 'Rotace beze změny kódu'],
  },
  'gateway-id': {
    term: 'gateway-id',
    title: 'Gateway ID',
    definition: 'Identifikátor abstrakční vrstvy pro external API (např. `spotify_gateway`); izoluje retry/rate-limit/auth.',
    implications: ['Per-gateway circuit breaker', 'Shared rate-limit pool napříč workers'],
  },

  // ─── Scout workers ─────────────────────────────────────────────────────────
  'worker-spotify-playlists': {
    term: 'worker-spotify-playlists',
    title: 'Worker: Spotify Playlists',
    definition: 'Sleduje Spotify Top 50 per region + custom registry. 15 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-spotify-artists': {
    term: 'worker-spotify-artists',
    title: 'Worker: Spotify Artists',
    definition: 'Sleduje artist releases + new singles. 15 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-apple-music': {
    term: 'worker-apple-music',
    title: 'Worker: Apple Music',
    definition: 'Apple Music charts + new releases per region. 10 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-deezer': {
    term: 'worker-deezer',
    title: 'Worker: Deezer',
    definition: 'Deezer top tracks + editorial picks. 12 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-instagram': {
    term: 'worker-instagram',
    title: 'Worker: Instagram',
    definition: 'IG profily artistů (auth_pending). 5 req/s.',
    triggers: ['Meta Business approval required'],
    implications: ['Health amber dokud auth pending', 'Worker scaffold ready'],
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-tiktok': {
    term: 'worker-tiktok',
    title: 'Worker: TikTok',
    definition: 'TikTok trending sounds + creator posts (auth_pending). 5 req/s.',
    triggers: ['TikTok API approval required'],
    implications: ['Health amber dokud auth pending'],
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-youtube': {
    term: 'worker-youtube',
    title: 'Worker: YouTube',
    definition: 'YouTube channels + music releases. 8 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-blogs': {
    term: 'worker-blogs',
    title: 'Worker: Urban Blogs',
    definition: 'Curated RSS feed pool urban blogs (Pitchfork, Complex, atd.). 20 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-rss': {
    term: 'worker-rss',
    title: 'Worker: Generic RSS',
    definition: 'Generic RSS aggregator pro fallback sources. 25 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-magazines': {
    term: 'worker-magazines',
    title: 'Worker: Magazines',
    definition: 'Print magazine RSS / sitemap scraper. 10 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-charts': {
    term: 'worker-charts',
    title: 'Worker: Charts',
    definition: 'Billboard / Official Charts / IFPI weekly snapshots. 5 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
  'worker-trends': {
    term: 'worker-trends',
    title: 'Worker: Trends',
    definition: 'Google Trends + Spotify Trending APIs. 8 req/s.',
    sourceRef: 'SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md',
  },
}

export function getGlossary(term: string): GlossaryEntry | null {
  return GLOSSARY[term] ?? null
}

/** Patch-friendly: add or override a term at runtime. */
export function addGlossaryTerm(entry: GlossaryEntry): void {
  GLOSSARY[entry.term] = entry
}

/** List all terms — useful for documentation / debugging. */
export function listGlossaryTerms(): string[] {
  return Object.keys(GLOSSARY)
}
