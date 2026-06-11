// scripts/seed-hdua-missions.mjs
// One-shot seeder: appends the HDUA (HotDroppZ User App) mission queue into
// NOTES/plan.json. Idempotent — removes any existing HDUA-* missions first, then
// re-inserts the canonical set so re-running stays clean. Marked as HDUA via
// id prefix `HDUA-`, moduleId 'HDUA', userMission:true. Native Expo direction.
//
// Run: node scripts/seed-hdua-missions.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.resolve(__dirname, '..', 'NOTES', 'plan.json')
const NOW = '2026-06-10T06:20:00.000Z'

const auditLog = (note) => [
  { ts: NOW, event: 'MISSION_CREATED', actor: 'plan-manager', note },
]

/** Shorthand to build a sub-step. */
const s = (id, name, description, why, owner = 'frontend-engineer', estimatedDuration = 'M') => ({
  id,
  name,
  description,
  why,
  status: 'todo',
  owner,
  estimatedDuration,
})

// Common scaffold applied to every HDUA mission.
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
  auditLog: auditLog('HDUA seed — native Expo user app, plan from CEO master prompt'),
  sequenceIndex: seq,
})

const missions = [
  // ─────────────────────────────────────────────────────────────── FOUNDATION
  {
    ...base(200),
    id: 'HDUA-00-SCAFFOLD',
    name: 'HDUA modul — scaffold nativní Expo app + úklid složek',
    purpose: 'Založit samostatný HDUA modul jako nativní React Native (Expo) aplikaci a uklidit/sjednotit předešlé složky.',
    phase: 'Foundation',
    priority: 'P0',
    domains: ['FRONTEND', 'INFRASTRUCTURE'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/**',
    description:
      'Vytvořit /SYSTEM/hotdroppz/HDUA jako čistý Expo (React Native) projekt s Expo Router, TypeScript, Zustand, TanStack Query, Reanimated, FlashList a Supabase JS. Plně oddělené od HDCC. Reconcile: frontend-web zůstává jako veřejný web, lounchapp archivovat (legacy start skripty).',
    importantInfo:
      'POZOR na duplicitu: frontend-web má v CLAUDE.md napsáno "HotDroppZ User App (HDUA)" a už obsahuje feed/api/akce/auth (Next.js PWA). Rozhodnutí CEO: HDUA = NATIVNÍ app, z frontend-web se reusne jen DB schéma + Content API, frontend-web zůstává jako web. Nezakládat znovu to, co půjde sdílet (typy, schéma).',
    rationale:
      'Bez čistého odděleného modulu by se nativní app míchala s Next.js webem a vznikl by chaos. Samostatný Expo projekt je nutná podmínka pro všechny další mise.',
    successCriteria: [
      'HDUA/ existuje jako spustitelný Expo projekt (expo start naběhne)',
      'Struktura složek dle specifikace (src/app, screens, components, feed, posts, ...)',
      'Design system: dark téma + neon-green accent dle mockupů, sdílené tokeny',
      'frontend-web nedotčen jako web; lounchapp přesunut do ZALOHA/legacy s poznámkou',
      'README + .env.example + funkční prázdná navigace',
    ],
    subMissions: [
      s('01', 'Init Expo projekt', 'create-expo-app v SYSTEM/hotdroppz/HDUA, TypeScript, Expo Router (file-based), ESLint/Prettier sjednocené s repo.', 'Základ, na kterém stojí vše ostatní.', 'frontend-engineer', 'M'),
      s('02', 'Struktura složek', 'Vytvořit src/{app,screens,components,feed,posts,profiles,search,notifications,settings,player,analytics,api,hooks,stores,utils,types,styles,assets} + database, docs, tests, public.', 'Pevná struktura = škálovatelnost a jasné vlastnictví kódu.', 'frontend-engineer', 'S'),
      s('03', 'Design system / téma', 'Definovat barvy (černá/neon-green dle mockupů), typografii, spacing, ikony (outline), komponentové primitivy. Dark-first.', 'Konzistentní moderní vzhled, který udrží uživatele u obrazovky.', 'ui-ux-designer', 'M'),
      s('04', 'Reconcile složek', 'frontend-web ponechat (web). lounchapp → ZALOHA/legacy. Zdokumentovat v HDUA/docs/ANALYSIS.md co se sdílí (DB, typy, Content API).', 'Odstranit duplicitu a zmatek mezi web/app/launcher.', 'devops', 'S'),
      s('05', 'Sdílené typy', 'Vytáhnout FeedItem/Post/Artist typy do sdíleného balíčku/komponenty mezi HDCC, frontend-web a HDUA (single source of truth).', 'Aby se kontrakt obsahu nerozjel mezi web a native.', 'backend-engineer', 'M'),
    ],
  },
  {
    ...base(201),
    id: 'HDUA-01-DATABASE',
    name: 'HDUA databázová vrstva',
    purpose: 'Připravit datový model HDUA: uživatelské tabulky + sjednocený feed pohled nad pipeline daty.',
    phase: 'Foundation',
    priority: 'P0',
    domains: ['DATABASE', 'BACKEND'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/database/**',
    description:
      'Tabulky: users, profiles, feed_items, artists, releases, articles, videos, images, alerts, notifications, saved_posts, liked_posts, comments, post_views, user_sessions, user_settings, search_history, trending_topics. Feed item musí mít: id, type, title, content, cover_image, artist, country, language, category, subcategory, source, source_url, score, created_at, updated_at, published_at.',
    importantInfo:
      'Pipeline už produkuje feed_posts/posts/scout_items v HDCC Supabase. NEDUPLIKOVAT obsah — feed_items je čtecí pohled/projekce nad pipeline výstupem; user_* tabulky jsou nové (interakce). RLS: každý uživatel vidí jen svá data; obsah je public-read přes Content API.',
    rationale:
      'Feed Engine i personalizace potřebují stabilní schéma. Bez oddělení "obsah (pipeline)" vs "interakce (user)" by se míchaly zodpovědnosti a RLS by byl nemožný.',
    successCriteria: [
      'Migrace v HDUA/database/ aplikovatelné přes apply-sql',
      'feed_items projekce mapuje pipeline výstup na kontrakt feed item',
      'User interaction tabulky s RLS politikami',
      'Indexy pro cursor pagination (created_at, score) a fulltext search',
    ],
    subMissions: [
      s('01', 'User & profile tabulky', 'users, profiles, user_settings, user_sessions, search_history s RLS (owner-only).', 'Identita a personalizace stojí na těchto tabulkách.', 'backend-engineer', 'M'),
      s('02', 'Interaction tabulky', 'saved_posts, liked_posts, comments, post_views s indexy a RLS.', 'Signály pro personalizaci a sociální funkce.', 'backend-engineer', 'M'),
      s('03', 'Feed projekce', 'feed_items view/materializace nad feed_posts+posts s povinnými poli kontraktu (type, cover_image, country, language, category, score...).', 'Jednotný tvar dat pro klienta nezávislý na interním schématu pipeline.', 'backend-engineer', 'L'),
      s('04', 'Trending & notifications', 'trending_topics, alerts, notifications tabulky + plnění z Trend Engine.', 'Realtime trendy a upozornění jsou klíč pro retenci.', 'backend-engineer', 'M'),
      s('05', 'Indexy + RLS audit', 'Cursor pagination indexy, fulltext (GIN), ověření RLS na všech user tabulkách.', 'Výkon pro nekonečný feed a bezpečnost dat.', 'security', 'M'),
    ],
  },
  {
    ...base(202),
    id: 'HDUA-02-CONTENT-API',
    name: 'Content API + HDCC→HDUA bridge',
    purpose: 'Stabilní read-API, které nativní HDUA app konzumuje, plněné eventy z HDCC pipeline.',
    phase: 'Foundation',
    priority: 'P0',
    domains: ['BACKEND', 'PIPELINE'],
    estimatedComplexity: 'XL',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/api/**',
    description:
      'Endpointy: /feed, /feed/trending, /feed/latest, /feed/recommended, /post/:id, /search, /search/artists, /search/releases, /alerts, /profile, /settings, /notifications. Komunikace HDCC → Events → Content API → HDUA. Versioned kontrakt, CORS pro native, cursor pagination, ETag/caching.',
    importantInfo:
      'Native app nemůže číst DB přímo jako Next SSR — potřebuje HTTP API s tokenem (Supabase JWT). Rozhodnout hosting API: reuse backend (NestJS) NEBO dedikované route handlers. Kontrakt musí být verzovaný (v1) — mobilní klienti se neaktualizují okamžitě.',
    rationale:
      'Feed Engine (HDUA-05) bez stabilního API nemá co konzumovat. Verzovaný kontrakt chrání nasazené appky před breaking changes z pipeline.',
    successCriteria: [
      'OpenAPI/typovaný kontrakt v1 pro všechny endpointy',
      'Cursor pagination (?cursor=...&limit=...) na /feed*',
      'Auth přes Supabase JWT + rate limiting',
      'Event/publish cesta z HDCC plní feed (nové itemy se objeví do X s)',
      'Smoke testy na každý endpoint',
    ],
    subMissions: [
      s('01', 'Kontrakt v1', 'Definovat request/response typy a OpenAPI pro všechny endpointy, sdílet typy s klientem.', 'Bez kontraktu se klient a server rozjedou.', 'backend-engineer', 'M'),
      s('02', 'Feed endpointy', '/feed, /trending, /latest, /recommended s cursor pagination nad feed_items.', 'Jádro datového toku do appky.', 'backend-engineer', 'L'),
      s('03', 'Post & search', '/post/:id (plný obsah + related), /search, /search/artists, /search/releases (fulltext).', 'Detail a vyhledávání obsahu.', 'backend-engineer', 'L'),
      s('04', 'User endpointy', '/profile, /settings, /alerts, /notifications s JWT auth + RLS.', 'Personalizovaná a chráněná data.', 'backend-engineer', 'M'),
      s('05', 'HDCC bridge', 'Event/publish kanál z pipeline (Feed Generator/Publisher) → Content API cache invalidation/push.', 'Realtime čerstvost feedu = retence.', 'ai-pipeline', 'L'),
      s('06', 'CORS + caching + rate limit', 'CORS pro native origin, ETag/Cache-Control, rate limiting, error envelope.', 'Výkon, bezpečnost a stabilita pod zátěží.', 'security', 'M'),
    ],
  },
  // ─────────────────────────────────────────────────────────────────── BUILD
  {
    ...base(203),
    id: 'HDUA-03-APP-SHELL-NAV',
    name: 'App shell + spodní navigace',
    purpose: 'Skelet aplikace s Expo Router a spodní navigací Home / Search / Create / Alerts / Profile.',
    phase: 'Build',
    priority: 'P0',
    domains: ['FRONTEND', 'UI'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/app/**',
    description:
      'Spodní menu ve stylu Instagram/TikTok/Spotify, pouze outline ikony, minimal design. 5 sekcí. Tab navigace přes Expo Router, perzistentní mini-player nad tab barem. Splash + auth gate.',
    importantInfo:
      'Mini-player (HDUA-08) sedí nad tab barem — nav layout musí počítat s jeho výškou od začátku. Safe-area insets (notch) na iOS.',
    rationale:
      'Navigace je kostra, do které se zavěsí feed, detail, search a profil. Musí být hotová dřív než obsahové obrazovky.',
    successCriteria: [
      '5 tabů funkčních s outline ikonami a aktivním stavem',
      'Expo Router file-based routing nastaven',
      'Safe-area + místo pro mini-player',
      'Splash screen + redirect na login když není session',
    ],
    subMissions: [
      s('01', 'Expo Router layout', 'Root layout, (tabs) skupina, auth gate, splash.', 'Definuje celou navigační strukturu.', 'frontend-engineer', 'M'),
      s('02', 'Tab bar', '5 outline ikon (Home/Search/Create/Alerts/Profile), aktivní stav neon-green, haptika.', 'Hlavní orientace v appce.', 'ui-ux-designer', 'M'),
      s('03', 'Auth gate', 'Supabase session check, login/redirect, OAuth callback handling.', 'Chrání uživatelská data a personalizaci.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(204),
    id: 'HDUA-04-MEDIA-LAYER',
    name: 'Media vrstva',
    purpose: 'Zobrazení a přehrávání médií: obrázky, galerie, audio preview, YouTube/Spotify embedy.',
    phase: 'Build',
    priority: 'P1',
    domains: ['FRONTEND', 'UI'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/components/media/**',
    description:
      'Napojení na HDCC Media Storage. Podpora: images, artwork, galleries, music previews, youtube videos, spotify embeds, artist photos, cover arts. Lazy/progressive loading, cache, blur placeholder.',
    importantInfo:
      'Native: použít expo-image (cache, blurhash), expo-av pro audio/video, WebView jen pro spotify/youtube embed (nebo native SDK). Embed iframy z webu NEpřenášet 1:1.',
    rationale:
      'Feed karty i detail bez media vrstvy nemají co zobrazit. Společná media vrstva = konzistence a výkon napříč obrazovkami.',
    successCriteria: [
      'expo-image s blurhash placeholderem a cache',
      'Audio preview přes expo-av (play/pause/seek)',
      'YouTube + Spotify embed přehratelný',
      'Galerie se swipe + pinch zoom',
    ],
    subMissions: [
      s('01', 'Image + galerie', 'expo-image, progressive load, blurhash, swipe galerie, pinch zoom.', 'Vizuál je hlavní hook feedu.', 'frontend-engineer', 'M'),
      s('02', 'Audio preview', 'expo-av preview snippet s progress a waveform.', 'Hudební preview drží uživatele u obrazovky.', 'frontend-engineer', 'M'),
      s('03', 'Embeds', 'YouTube + Spotify přehrávání (native SDK nebo WebView fallback).', 'Přístup k plnému obsahu bez opuštění appky.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(205),
    id: 'HDUA-05-FEED-ENGINE',
    name: 'Feed Engine (klient)',
    purpose: 'Nekonečný, výkonný, virtualizovaný feed konzumující Content API.',
    phase: 'Build',
    priority: 'P0',
    domains: ['FRONTEND', 'PIPELINE'],
    estimatedComplexity: 'XL',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/feed/**',
    description:
      'Nejdůležitější část appky. Infinite scroll bez stránkování: lazy loading, virtualized list (FlashList), cursor pagination. Type registry pro: release, article, video, fashion, drama, global_news, did_you_know, fun_fact, quote, artist_update, playlist, event, festival, interview, ranking, trend.',
    importantInfo:
      'Výkon je vše — FlashList (ne FlatList) kvůli recyklaci, stabilní keyExtractor, getItemType per feed type, prefetch dalšího okna, optimistic UI pro akce. TanStack Query infinite query s cursorem.',
    rationale:
      'Feed je produkt. Pomalý nebo sekající feed = okamžitý odchod uživatele. Proto vlastní engine s virtualizací a prefetchem.',
    successCriteria: [
      'Plynulý 60fps scroll na 1000+ položkách',
      'Cursor-based infinite query (žádné stránky)',
      'Type registry renderuje všech 17 typů',
      'Prefetch + cache, offline poslední okno',
      'Pull-to-refresh + "nové příspěvky" indikátor',
    ],
    subMissions: [
      s('01', 'Virtualizovaný list', 'FlashList s getItemType, recyklace, estimatedItemSize, prefetch.', 'Bez virtualizace feed nezvládne tisíce položek.', 'frontend-engineer', 'L'),
      s('02', 'Infinite query', 'TanStack Query useInfiniteQuery nad /feed s cursorem, dedupe, retry.', 'Nekonečné načítání bez stránkování.', 'frontend-engineer', 'L'),
      s('03', 'Type registry', 'Mapování feed type → renderer komponenta, fallback pro neznámé typy.', 'Rozšiřitelnost o nové typy obsahu bez zásahu do jádra.', 'frontend-engineer', 'M'),
      s('04', 'Refresh & realtime', 'Pull-to-refresh, "X nových" pill, napojení na realtime kanál z Content API.', 'Čerstvost = důvod se vracet.', 'frontend-engineer', 'M'),
      s('05', 'Optimistic akce', 'Like/save/boost optimisticky s rollbackem při chybě.', 'Okamžitá odezva = návykovost.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(206),
    id: 'HDUA-06-FEED-CARD',
    name: 'Feed Card layout',
    purpose: 'Vizuál karty příspěvku dle referenčních mockupů.',
    phase: 'Build',
    priority: 'P0',
    domains: ['UI', 'FRONTEND'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/components/cards/**',
    description:
      'Struktura: hero image, headline, tagy, metadata, krátký preview obsahu, action bar. Tagy: Artist, Country, Genre, Category, Type. Plus prvky z mockupu: live signals (+284%, #3 trending, listening now), action bar (like/add/comment/share/boost), source pills (Spotify/Apple/YouTube), AI take, related.',
    importantInfo:
      'Mockupy: tmavé pozadí, neon-green akcenty, "NEW DROP" badge, waveform overlay u release. Karty musí mít variace podle typu (release vs article vs quote). Drop-post varianta = celoobrazovkový hero (druhý mockup).',
    rationale:
      'Karta je první dojem každého příspěvku. Promyšlený layout s jasnou hierarchií rozhoduje o tom, zda uživatel scrolluje dál nebo otevře detail.',
    successCriteria: [
      'Karta odpovídá mockupům (hero, tagy, signals, action bar, source pills, AI take)',
      'Varianty podle feed type',
      'Action bar s optimistickými akcemi a počty',
      'Plně přístupné (a11y labels, kontrast)',
    ],
    subMissions: [
      s('01', 'Base card', 'Hero image, headline, tagy (artist/country/genre/category/type), metadata, preview.', 'Společný základ všech karet.', 'ui-ux-designer', 'M'),
      s('02', 'Live signals + action bar', '+284%/trending/listening now, like/add/comment/share/boost s počty.', 'Sociální důkaz a interakce zvyšují engagement.', 'frontend-engineer', 'M'),
      s('03', 'Source pills + AI take', 'Spotify/Apple/YouTube piluky, AI take blok, related náhledy.', 'Kontext a cesta k plnému obsahu.', 'frontend-engineer', 'M'),
      s('04', 'Type varianty', 'Release (waveform), article, quote, fun_fact, drop-post hero varianta.', 'Každý typ obsahu má optimální prezentaci.', 'ui-ux-designer', 'M'),
    ],
  },
  {
    ...base(207),
    id: 'HDUA-07-POST-DETAIL',
    name: 'Post Detail Engine + plynulý přechod',
    purpose: 'Detail příspěvku se smooth expand a nekonečným navázáním na další obsah (TikTok + Apple News).',
    phase: 'Build',
    priority: 'P0',
    domains: ['FRONTEND', 'UI'],
    estimatedComplexity: 'XL',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/posts/**',
    description:
      'Tap → smooth expand → full content page. Podpora: long articles, image galleries, videos, audio players, spotify/youtube embeds, source links, related content. Po dočtení: scroll down → automaticky navazuje další příspěvek bez návratu do feedu. Tok: Feed → Open Post → Read → Continue → Next Post.',
    importantInfo:
      'Toto je srdce "udrží člověka u obrazovky". Shared element transition (Reanimated) z karty do detailu. Po konci článku prefetchnout a vykreslit další post pod ním — kontinuální vertikální čtečka, ne modal. Stav scrollu a historie musí zůstat konzistentní s feedem.',
    rationale:
      'Plynulý přechod feed↔detail a auto-navázání dalšího obsahu je hlavní retenční mechanika celé appky (kombinace TikTok a Apple News). Bez něj je to jen další čtečka.',
    successCriteria: [
      'Shared-element expand z karty do detailu (60fps)',
      'Detail renderuje všechny typy obsahu + embeds',
      'Po dočtení se plynule načte další post (bez návratu do feedu)',
      'Related posts pod obsahem',
      'Zpět gesto zachová pozici ve feedu',
    ],
    subMissions: [
      s('01', 'Expand transition', 'Reanimated shared element z FeedCard do PostDetail, gesture-driven.', 'Plynulost přechodu = prémiový pocit.', 'frontend-engineer', 'L'),
      s('02', 'Content renderer', 'Long article, galerie, video, audio, spotify/youtube embed, source links.', 'Detail musí zvládnout libovolný typ obsahu.', 'frontend-engineer', 'L'),
      s('03', 'Continuous reader', 'Po konci obsahu prefetch + render dalšího postu pod ním (vertikální kontinuita).', 'Klíčová návyková mechanika — nekonečné pokračování.', 'frontend-engineer', 'XL'),
      s('04', 'Related + zpět', 'Related posts blok, zpět gesto se zachováním feed pozice.', 'Udržení kontextu a objevování dalšího obsahu.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(208),
    id: 'HDUA-08-PLAYER',
    name: 'Globální přehrávač',
    purpose: 'Perzistentní audio/preview přehrávač (mini-player + full screen).',
    phase: 'Build',
    priority: 'P1',
    domains: ['FRONTEND', 'UI'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/player/**',
    description:
      'Mini-player nad tab barem (dle mockupu: cover, název, artist, play/pause, skip) → tap → full player s waveform, progress barem, frontou. Pokračuje napříč obrazovkami.',
    importantInfo:
      'Stav přehrávače globální (Zustand) nezávislý na navigaci. Background audio (expo-av + iOS background mode). Waveform z preview snippetu.',
    rationale:
      'Hudební preview, které běží i při scrollování dál, výrazně prodlužuje čas v appce a propojuje feed s reálným poslechem.',
    successCriteria: [
      'Mini-player perzistentní napříč taby',
      'Full player s waveform + frontou',
      'Background přehrávání',
      'Napojení na source pills (přechod do Spotify/YouTube)',
    ],
    subMissions: [
      s('01', 'Player store', 'Globální Zustand store (track, queue, stav, pozice).', 'Jeden zdroj pravdy pro přehrávání napříč appkou.', 'frontend-engineer', 'M'),
      s('02', 'Mini + full UI', 'Mini-player bar + full screen s waveform a progress, gesto pro expand.', 'Ovládání bez vytržení z feedu.', 'ui-ux-designer', 'M'),
      s('03', 'Background audio', 'expo-av background mode, lock-screen kontrolky.', 'Poslech pokračuje i mimo appku = retence.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(209),
    id: 'HDUA-09-PERSONALIZATION',
    name: 'Personalizace a doporučování',
    purpose: 'AI doporučovací vrstva produkující personalizovaný feed ze signálů uživatele.',
    phase: 'Build',
    priority: 'P1',
    domains: ['AI_SYSTEM', 'BACKEND'],
    estimatedComplexity: 'L',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/api/recommend/**',
    description:
      'Signály: likes, views, saves, shares, followed artists/countries/genres, session duration, scroll depth. Výstup: recommended feed (/feed/recommended). Sběr signálů na klientu, scoring na serveru.',
    importantInfo:
      'Začít rule-based scoringem (čerstvost × afinita × trend) než bude dost dat na ML. Signály posílat batchovaně, ne per-event (baterie/síť). GDPR: signály jsou osobní data — opt-out + retence.',
    rationale:
      'Personalizovaný feed dramaticky zvyšuje relevanci a retenci. Bez doporučování je feed jen chronologický a rychle nudí.',
    successCriteria: [
      'Klient sbírá a batchuje signály (view, scroll depth, dwell)',
      '/feed/recommended vrací personalizované pořadí',
      'Rule-based scoring s jasnými váhami (dokumentováno)',
      'Opt-out + GDPR retence signálů',
    ],
    subMissions: [
      s('01', 'Sběr signálů', 'Klientský tracker (impression, dwell, scroll depth, akce) s batchováním.', 'Bez dat není co personalizovat.', 'frontend-engineer', 'M'),
      s('02', 'Scoring engine', 'Server-side rule-based ranking (čerstvost × afinita × trend), váhy konfigurovatelné.', 'Jádro doporučování, vysvětlitelné a laditelné.', 'ai-pipeline', 'L'),
      s('03', 'Recommended feed', '/feed/recommended napojený na scoring + fallback na latest.', 'Doručení personalizace do appky.', 'backend-engineer', 'M'),
    ],
  },
  // ─────────────────────────────────────────────────────────────────── SCALE
  {
    ...base(210),
    id: 'HDUA-10-PIPELINE-MONITOR',
    name: 'HDCC Live Pipeline Monitor',
    purpose: 'Extrémně detailní realtime logovací panel pipeline uvnitř HDCC.',
    phase: 'Scale',
    priority: 'P1',
    domains: ['ANALYTICS', 'PIPELINE'],
    estimatedComplexity: 'L',
    modulePath: 'command-centrum/app/(dashboard)/**',
    description:
      'Sekce: Scout, Parser, Normalizer, Translator, Classifier, Deduplicator, Cluster Engine, Artist Engine, Release Engine, Trend Engine, Feed Generator, Publisher. U každé: status, latency, queue size, items processed, errors, warnings, last update. Realtime refresh.',
    importantInfo:
      'Toto je HDCC-side (ne v native appce). Reuse existující pipeline state/log infrastrukturu v command-centrum. Realtime přes Supabase realtime nebo SSE. Nepřetěžovat — agregace, ne každý řádek logu.',
    rationale:
      'Provozní viditelnost pipeline je nutná pro důvěru v obsah a rychlou diagnostiku. Tvoří i datový základ pro Live Preview (HDUA-11).',
    successCriteria: [
      '12 stage panelů s metrikami (status/latency/queue/processed/errors/warnings)',
      'Realtime refresh bez reloadu',
      'Historie a barevné stavy (ok/warn/error)',
    ],
    subMissions: [
      s('01', 'Stage metriky API', 'Agregovaný endpoint se stavem 12 stage z pipeline state.', 'Jeden zdroj metrik pro panel.', 'backend-engineer', 'M'),
      s('02', 'Monitor UI', '12 panelů, barevné stavy, latency/queue grafy.', 'Přehled celé pipeline na jedné obrazovce.', 'frontend-engineer', 'M'),
      s('03', 'Realtime kanál', 'Supabase realtime/SSE napojení s throttlingem.', 'Živá data bez reloadu.', 'backend-engineer', 'M'),
    ],
  },
  {
    ...base(211),
    id: 'HDUA-11-LIVE-PREVIEW',
    name: 'HDUA Live Preview v HDCC',
    purpose: 'Split náhled v HDCC: 60 % pipeline log + 40 % živý mobilní náhled feedu.',
    phase: 'Scale',
    priority: 'P2',
    domains: ['UI', 'ANALYTICS'],
    estimatedComplexity: 'M',
    modulePath: 'command-centrum/app/(dashboard)/**',
    description:
      'Na hlavní HDCC stránce: vlevo (60 %) HDCC Pipeline Log, vpravo (40 %) Live Mobile Preview s aktuálním feedem, novými příspěvky, trendy a live aktualizacemi v reálném čase.',
    importantInfo:
      'Mobilní náhled = web render feedu (sdílené feed komponenty nebo expo web build v iframe/device rámu). Reuse Content API a feed komponent, ať preview odpovídá realitě native appky.',
    rationale:
      'CEO/editor vidí okamžitě, co uživatel uvidí, hned jak to vyjde z pipeline — zkracuje smyčku mezi obsahem a kontrolou kvality.',
    successCriteria: [
      'Split layout 60/40 na HDCC dashboardu',
      'Live mobile preview renderuje reálný feed z Content API',
      'Nové příspěvky/trendy se objevují realtime',
    ],
    subMissions: [
      s('01', 'Split layout', '60/40 resizable panel na HDCC overview.', 'Současně log i náhled.', 'frontend-engineer', 'S'),
      s('02', 'Device preview', 'Telefonní rám s web renderem feedu (sdílené komponenty / expo web).', 'Náhled odpovídá native appce.', 'frontend-engineer', 'M'),
      s('03', 'Realtime sync', 'Napojení preview na stejný realtime kanál jako monitor.', 'Živá shoda s produkcí.', 'frontend-engineer', 'M'),
    ],
  },
  {
    ...base(212),
    id: 'HDUA-12-ANALYTICS',
    name: 'User Analytics Dashboard',
    purpose: 'Metriky chování uživatelů HDUA.',
    phase: 'Scale',
    priority: 'P2',
    domains: ['ANALYTICS'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/src/analytics/**',
    description:
      'Metriky: DAU, MAU, Retention, Session Length, Scroll Depth, Top Artists, Top Countries, Top Categories, CTR, Engagement Rate. Dashboard v HDCC nad signály z personalizace.',
    importantInfo:
      'Reuse signály z HDUA-09 (žádný druhý tracking SDK). Agregace server-side, dashboard read-only. GDPR-safe (anonymizované agregáty).',
    rationale:
      'Bez metrik retence a engagementu nelze řídit produkt ani prokázat růst. Staví na signálech, které už personalizace sbírá.',
    successCriteria: [
      'Dashboard s 10 klíčovými metrikami',
      'DAU/MAU/retention výpočet ze sessions',
      'Top artists/countries/categories žebříčky',
      'Engagement rate + CTR z interakcí',
    ],
    subMissions: [
      s('01', 'Agregace metrik', 'Server-side výpočet DAU/MAU/retention/session/scroll depth.', 'Spolehlivá čísla pro rozhodování.', 'backend-engineer', 'M'),
      s('02', 'Dashboard UI', 'Karty + grafy 10 metrik v HDCC.', 'Přehled zdraví produktu.', 'frontend-engineer', 'M'),
    ],
  },
  // ───────────────────────────────────────────────────────────── CROSS-CUTTING
  {
    ...base(213),
    id: 'HDUA-13-DOCS',
    name: 'HDUA dokumentace',
    purpose: 'Kompletní dokumentace architektury, DB, feed enginu, API, UI systému a nasazení.',
    phase: 'Validate',
    priority: 'P2',
    domains: ['QUALITY'],
    estimatedComplexity: 'M',
    modulePath: 'SYSTEM/hotdroppz/HDUA/docs/**',
    description:
      'Vygenerovat: HDUA_ARCHITECTURE.md, HDUA_DATABASE.md, HDUA_FEED_ENGINE.md, HDUA_API.md, HDUA_UI_SYSTEM.md, HDUA_DEPLOYMENT.md. Živá dokumentace, aktualizovaná průběžně s misemi.',
    importantInfo:
      'Není to "až nakonec" — každá mise při dokončení aktualizuje svůj doc. Tato mise zajišťuje kostru a finální konsolidaci + deployment (EAS build, store submission).',
    rationale:
      'Dokumentace drží škálovatelnost a onboarding při růstu týmu. Deployment doc je nutný pro vydání do storů.',
    successCriteria: [
      '6 dokumentů vytvořeno a propojeno',
      'Architecture diagram HDCC→Events→Content API→HDUA',
      'Deployment: EAS build + store submission postup',
      'Každý doc odkazován z příslušné mise',
    ],
    subMissions: [
      s('01', 'Architektura + DB + Feed', 'HDUA_ARCHITECTURE.md, HDUA_DATABASE.md, HDUA_FEED_ENGINE.md.', 'Pochopení systému pro nové vývojáře.', 'frontend-engineer', 'M'),
      s('02', 'API + UI systém', 'HDUA_API.md (kontrakt v1), HDUA_UI_SYSTEM.md (design tokeny, komponenty).', 'Stabilní kontrakt a konzistentní UI.', 'frontend-engineer', 'M'),
      s('03', 'Deployment', 'HDUA_DEPLOYMENT.md: EAS build, env, store submission, OTA updates.', 'Cesta od kódu k vydané appce.', 'devops', 'M'),
    ],
  },
]

// ── Apply ────────────────────────────────────────────────────────────────────
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const before = plan.missions.length
// Idempotent: drop any prior HDUA-* missions so re-running re-seeds cleanly.
plan.missions = plan.missions.filter((m) => !String(m.id).startsWith('HDUA-'))
const removed = before - plan.missions.length
plan.missions.push(...missions)
plan.updatedAt = NOW
plan.version = (plan.version ?? 0)

fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2))
console.log(
  `OK — removed ${removed} old HDUA, added ${missions.length}. Total missions: ${plan.missions.length}`,
)
console.log('HDUA ids:', missions.map((m) => m.id).join(', '))
