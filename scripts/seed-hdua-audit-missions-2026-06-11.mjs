// scripts/seed-hdua-audit-missions-2026-06-11.mjs
// Appends audit-driven HDUA follow-up missions (HDUA-14..20) into NOTES/plan.json.
// Source: detailed HDUA audit/debug on 2026-06-11 (post UI overhaul).
// Idempotent: removes any prior HDUA-1[4-9]/HDUA-20 before re-inserting.
// Makes a timestamped backup first. Run: node scripts/seed-hdua-audit-missions-2026-06-11.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.resolve(__dirname, '..', 'NOTES', 'plan.json')
const NOW = '2026-06-11T16:00:00.000Z'

const auditLog = (note) => [{ ts: NOW, event: 'MISSION_CREATED', actor: 'auditor', note }]

const s = (id, name, description, why, owner = 'frontend-engineer', estimatedDuration = 'M') => ({
  id, name, description, why, status: 'todo', owner, estimatedDuration,
})

const base = (seq) => ({
  status: 'todo',
  lifecycleStatus: 'PLAN',
  coldCase: false,
  isDeleted: false,
  createdAt: NOW,
  inTimeline: true,
  userMission: true,
  moduleId: 'HDUA',
  auditReports: [],
  auditLog: auditLog('HDUA detailed audit 2026-06-11 (post UI overhaul)'),
  sequenceIndex: seq,
})

const NEW_IDS = new Set([
  'HDUA-14-AUTH-GATE',
  'HDUA-15-ENRICHMENT-ACTIVATION',
  'HDUA-16-EDITORIAL-PUBLISH',
  'HDUA-17-VENOM-DESIGN-PROPAGATION',
  'HDUA-18-GLOBAL-SCROLLBAR-READER',
  'HDUA-19-VCS-CHECKPOINT',
  'HDUA-20-QUALITY-GATE',
])

const missions = [
  {
    ...base(219),
    id: 'HDUA-19-VCS-CHECKPOINT',
    name: 'Git checkpoint — HDUA + HDCC pod verzí',
    purpose: 'Dostat veškerou HDUA/command-centrum práci pod verzování; teď je celé untracked.',
    phase: 'Foundation',
    priority: 'P0',
    domains: ['INFRASTRUCTURE'],
    estimatedComplexity: 'S',
    modulePath: 'SYSTEM/hotdroppz/**',
    description:
      'Audit zjistil, že HDUA/ i command-centrum/ jsou v gitu kompletně UNTRACKED (41 uncommitted, žádná historie, žádný remote). Doplnit .gitignore (node_modules, .expo, dist, .env*), provést první commit HDUA, nastavit remote a push. Bez toho je veškerá práce na jediný omyl ztracená.',
    importantInfo:
      'Souvisí s repo-structure-no-remote-blocker. NEcommitovat .env.local (obsahuje anon klíč — gitignore). Ověřit, že se necommitnou node_modules a .expo.',
    rationale: 'Žádná historie = žádný rollback a vysoké riziko ztráty. P0 hygiena.',
    successCriteria: [
      '.gitignore pokrývá node_modules/.expo/dist/.env*',
      'HDUA + command-centrum commitnuté (čistý git status)',
      'Remote nastaven a push proběhl (nebo zdokumentováno proč ne)',
    ],
    subMissions: [
      s('01', '.gitignore + commit', 'Doplnit .gitignore, git add/commit HDUA a command-centrum.', 'Základní bezpečnost práce.', 'devops', 'S'),
      s('02', 'Remote + push', 'Nastavit git remote (GitHub) a push; volitelně CI lint+typecheck.', 'Záloha mimo lokál + základ CI/CD.', 'devops', 'M'),
    ],
  },
  {
    ...base(215),
    id: 'HDUA-15-ENRICHMENT-ACTIVATION',
    name: 'Aktivace enrichmentu — feed s reálnými médii',
    purpose: 'Naplnit feed reálnými daty (artist, cover, Spotify/YouTube) — teď je vizuálně prázdný.',
    phase: 'Build',
    priority: 'P0',
    domains: ['PIPELINE', 'BACKEND'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/command-centrum/lib/pipeline/**',
    description:
      'Audit: hdua_feed_items má artist 0/17, spotify 0/17, cover 2/17 — view je správně napojen na story_clusters (2026-06-11), ale enrichment nikdy nedoběhl (chybí API klíče). Doplnit GROQ/SPOTIFY/YOUTUBE/GENIUS klíče do command-centrum/.env.local, spustit enrichment + feed-builder, ověřit, že data tečou přes view do HDUA.',
    importantInfo:
      'View i realtime bridge už hotové (HDUA-02 sub05). Tohle je čistě HDCC-side: klíče + běh pipeline. Enrichment má fallbacky — pipeline nespadne, jen vrací prázdno bez klíčů.',
    rationale: 'Bez médií vypadá appka prázdně; je to největší viditelný nedostatek.',
    successCriteria: [
      'API klíče doplněny a ověřeny (Spotify token, YouTube, Genius)',
      'Enrichment doběhl: story_clusters mají artist_name/image/spotify > 0',
      'hdua_feed_items vrací cover/artist/spotify pro většinu položek',
    ],
    subMissions: [
      s('01', 'Klíče + ověření', 'Doplnit a otestovat GROQ/SPOTIFY/YOUTUBE/GENIUS klíče.', 'Enrichment bez nich degraduje na prázdno.', 'backend-engineer', 'S'),
      s('02', 'Běh enrichment + feed-builder', 'Spustit pipeline, naplnit clustery, postavit feed_posts.', 'Naplnit kontrakt reálnými daty.', 'ai-pipeline', 'M'),
      s('03', 'Ověření v HDUA', 'Refresh HDUA, ověřit cover/artist/source pills + realtime nový post.', 'Konec-konec ověření propojení.', 'frontend-engineer', 'S'),
    ],
  },
  {
    ...base(214),
    id: 'HDUA-14-AUTH-GATE',
    name: 'Auth gate — přihlášení (Supabase)',
    purpose: 'Dokončit HDUA-03 sub03: login/session, aby fungovala uživatelská data.',
    phase: 'Build',
    priority: 'P0',
    domains: ['FRONTEND', 'SECURITY'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/app/**',
    description:
      'Audit: feed je veřejný (anon view), ale profile/settings/likes/saves jsou RLS owner-only a bez přihlášení nedostupné. Doplnit Supabase auth flow (email/OAuth), session persistence, auth gate / redirect, a napojit user.ts akce na přihlášeného uživatele.',
    importantInfo:
      'Supabase client už persistuje session (autoRefreshToken). Chybí UI flow + gate. Pozor na broken signup trigger (supabase-admin-account-blocker) — ověřit vznik hdua_profiles na signup.',
    rationale: 'Bez loginu nejde personalizace, ukládání ani profil — polovina appky je mrtvá.',
    successCriteria: [
      'Login/registrace (email + alespoň 1 OAuth) funkční',
      'Session přežije reload; logout funguje',
      'Like/Save/Profile/Settings čtou+zapisují data přihlášeného uživatele',
      'hdua_profiles se založí při signup (trigger ověřen)',
    ],
    subMissions: [
      s('01', 'Auth UI', 'Login/registrace obrazovka, venom styl, error stavy.', 'Vstupní bod pro uživatelská data.', 'frontend-engineer', 'M'),
      s('02', 'Session + gate', 'Session check, redirect, logout, ochrana user routes.', 'Bezpečnost a perzistence.', 'frontend-engineer', 'M'),
      s('03', 'Napojení akcí', 'Like/save/profile/settings na auth uživatele + RLS ověření.', 'Funkční personalizace.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(217),
    id: 'HDUA-17-VENOM-DESIGN-PROPAGATION',
    name: 'Venom/sharp design napříč appkou + úklid',
    purpose: 'Sjednotit nový venom/sharp jazyk na všechny obrazovky a uklidit dead code.',
    phase: 'Build',
    priority: 'P1',
    domains: ['UI', 'FRONTEND'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/**',
    description:
      'Po UI overhaulu (2026-06-11) projít FeedCard, FeedPage reader, Search, Alerts, Profile, ShareSheet a doladit venom #00EC88 + ostré hrany + glow konzistentně. Úklid: smazat nepoužitý src/components/brand/FlameMark.tsx (nahrazen rasterem flame.png); přebarvit share-card-template.svg a assets/README z legacy lime #B6FF3B na venom; odstranit stray console.',
    importantInfo:
      'Komponenty čerpají z theme tokenů, takže barvy se z větší části propsaly samy — tahle mise je o konzistenci, detailech a úklidu, ne o přebarvování tokenů.',
    rationale: 'Nesourodé obrazovky a dead code sráží „luxury 2026" dojem a matou údržbu.',
    successCriteria: [
      'Všechny taby (Home/Search/Create/Alerts/Profile) i reader ve venom/sharp stylu',
      'FlameMark.tsx smazán (nebo reálně použit pro splash)',
      'share-card-template.svg + README ve venom (#00EC88), žádné #B6FF3B',
      'Žádné stray console.* ve src',
    ],
    subMissions: [
      s('01', 'Surface pass', 'Projít a doladit všechny obrazovky + reader (venom/sharp/glow).', 'Konzistentní prémiový vzhled.', 'ui-ux-designer', 'M'),
      s('02', 'Brand assety', 'Share card SVG + README na venom; sjednotit odstín.', 'Sdílené obrázky musí být on-brand.', 'graphic-designer', 'S'),
      s('03', 'Úklid kódu', 'Smazat FlameMark, odstranit console, mrtvé importy.', 'Čistá údržba.', 'frontend-engineer', 'S'),
    ],
  },
  {
    ...base(216),
    id: 'HDUA-16-EDITORIAL-PUBLISH',
    name: 'Publikace editorial článků do HDUA',
    purpose: 'Dostat psané články (posts) do feedu — teď je 0 published.',
    phase: 'Build',
    priority: 'P1',
    domains: ['BACKEND', 'PIPELINE'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/command-centrum/**',
    description:
      'Audit: posts má 20 řádků, 0 ve status=published, takže editorial větev hdua_feed_items nepřispívá ničím — HDUA ukazuje jen 17 music karet. Přidat v HDCC publikační akci (a/nebo kvalitní auto-publish gate) a ověřit, že published články se objeví v HDUA feedu.',
    importantInfo:
      'View už editorial větev má (WHERE status=published). Publikace je editorský krok — neflipovat naslepo, ale dát na to UI/gate v HDCC.',
    rationale: 'Polovina obsahového typu (články) je pro uživatele neviditelná.',
    successCriteria: [
      'HDCC umožní publikovat post (UI akce nebo gate)',
      'Published post se objeví v hdua_feed_items jako type=article',
      'Ověřeno v HDUA feedu',
    ],
    subMissions: [
      s('01', 'Publish akce', 'UI/akce v HDCC pro publish + audit stopa.', 'Kontrolovaný tok do produkce.', 'backend-engineer', 'M'),
      s('02', 'Ověření v HDUA', 'Publikovat 1 článek, ověřit zobrazení a detail.', 'Konec-konec ověření.', 'frontend-engineer', 'S'),
    ],
  },
  {
    ...base(218),
    id: 'HDUA-18-GLOBAL-SCROLLBAR-READER',
    name: 'Globální posuvník i pro čtečku/detail',
    purpose: 'Posuvník teď reflektuje jen feed; napojit i na scroll článku a post/[id].',
    phase: 'Build',
    priority: 'P2',
    domains: ['FRONTEND'],
    estimatedComplexity: 'S',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/feed/**',
    description:
      'Globální posuvník (root layout, tažitelný) řídí jen feed přes sbProgress/sbThumbFraction. Na statických obrazovkách a v otevřeném postu/čtečce ukazuje stale pozici feedu. Napojit aktivní scroll surface (FeedPage inner ScrollView při expandu, post/[id] reader) na stejné sdílené hodnoty + registrovat scroller, aby thumb odpovídal tomu, co se reálně scrolluje.',
    importantInfo:
      'Mechanika hotová (scrollbarShared: sbProgress/sbThumbFraction/setScroller/driveScroll). Jde o napojení dalších scroll kontejnerů a reset na screenech bez scrollu.',
    rationale: 'Aby posuvník byl pravdivý všude, ne jen na feedu.',
    successCriteria: [
      'Otevřený článek/čtečka řídí thumb (pozice odpovídá obsahu)',
      'post/[id] reader napojen',
      'Na obrazovkách bez scrollu thumb neukazuje cizí pozici',
    ],
    subMissions: [
      s('01', 'Reader scroll → sb', 'Napojit FeedPage inner ScrollView + post/[id] na sdílené hodnoty.', 'Pravdivý posuvník v detailu.', 'frontend-engineer', 'S'),
      s('02', 'Reset/ownership', 'Předávání „active scroller" mezi surfacy + reset.', 'Žádná stale pozice.', 'frontend-engineer', 'S'),
    ],
  },
  {
    ...base(220),
    id: 'HDUA-20-QUALITY-GATE',
    name: 'Quality gate — testy, lint, CI',
    purpose: 'Zavést minimální testovací a lint bránu pro HDUA.',
    phase: 'Validate',
    priority: 'P2',
    domains: ['QUALITY'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/**',
    description:
      'Audit: tests/ je prázdné, žádné testy. Doplnit unit testy pro mappers (row→FeedItem), api/content (cursor pagination, fallbacky) a hooks; zajistit čistý eslint a typecheck v CI (lint + tsc + test).',
    importantInfo: 'tsc je čistý. Eslint dořešit (běžel pomalu v auditu). Priorita: mappers + api kontrakt.',
    rationale: 'Bez bran se regrese (jako rozbité scrolly/gesta) chytají až u uživatele.',
    successCriteria: [
      'Testy pro mappers + content API + 1 hook',
      'eslint čistý, žádné warningy nad limit',
      'CI: lint + typecheck + test (alespoň lokálně skript)',
    ],
    subMissions: [
      s('01', 'Unit testy', 'mappers, content API, useFeed.', 'Chytat regrese kontraktu.', 'frontend-engineer', 'M'),
      s('02', 'Lint + CI', 'eslint clean + CI skript (lint/tsc/test).', 'Automatická brána kvality.', 'devops', 'S'),
    ],
  },
]

// ── Apply ────────────────────────────────────────────────────────────────────
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const backup = path.resolve(__dirname, '..', 'NOTES', 'plan.json.bak-pre-hdua-audit-2026-06-11')
fs.writeFileSync(backup, JSON.stringify(plan, null, 2))

const before = plan.missions.length
plan.missions = plan.missions.filter((m) => !NEW_IDS.has(String(m.id)))
const removed = before - plan.missions.length
plan.missions.push(...missions)
plan.updatedAt = NOW

fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2))
console.log(`Backup: ${path.basename(backup)}`)
console.log(`Removed ${removed} prior, added ${missions.length}. Total missions: ${plan.missions.length}`)
console.log('New ids:', missions.map((m) => `${m.id}(${m.priority})`).join(', '))
