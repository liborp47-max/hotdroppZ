# HDUA — Mise (chronologicky)

> Generováno z `NOTES/plan.json` (`scripts/gen-hdua-docs.mjs`). Needituj ručně — uprav misi v plan.json a re-generuj.

Celkem 21 misí. Pořadí = `sequenceIndex`. Označení v systému: `moduleId: "HDUA"`, `userMission: true`.

## Přehled

| seq | id | fáze | prio | komplexita | mise |
|-----|----|------|------|-----------|------|
| 200 | `HDUA-00-SCAFFOLD` | Foundation | P0 | L | HDUA modul — scaffold nativní Expo app + úklid složek |
| 201 | `HDUA-01-DATABASE` | Foundation | P0 | L | HDUA databázová vrstva |
| 202 | `HDUA-02-CONTENT-API` | Foundation | P0 | XL | Content API + HDCC→HDUA bridge |
| 203 | `HDUA-03-APP-SHELL-NAV` | Build | P0 | M | App shell + spodní navigace |
| 204 | `HDUA-04-MEDIA-LAYER` | Build | P1 | L | Media vrstva |
| 205 | `HDUA-05-FEED-ENGINE` | Build | P0 | XL | Feed Engine (klient) |
| 206 | `HDUA-06-FEED-CARD` | Build | P0 | L | Feed Card layout |
| 207 | `HDUA-07-POST-DETAIL` | Build | P0 | XL | Post Detail Engine + plynulý přechod |
| 208 | `HDUA-08-PLAYER` | Build | P1 | L | Globální přehrávač |
| 209 | `HDUA-09-PERSONALIZATION` | Build | P1 | L | Personalizace a doporučování |
| 210 | `HDUA-10-PIPELINE-MONITOR` | Scale | P1 | L | HDCC Live Pipeline Monitor |
| 211 | `HDUA-11-LIVE-PREVIEW` | Scale | P2 | M | HDUA Live Preview v HDCC |
| 212 | `HDUA-12-ANALYTICS` | Scale | P2 | M | User Analytics Dashboard |
| 213 | `HDUA-13-DOCS` | Validate | P2 | M | HDUA dokumentace |
| 214 | `HDUA-14-AUTH-GATE` | Build | P0 | M | Auth gate — přihlášení (Supabase) |
| 215 | `HDUA-15-ENRICHMENT-ACTIVATION` | Build | P0 | M | Aktivace enrichmentu — feed s reálnými médii |
| 216 | `HDUA-16-EDITORIAL-PUBLISH` | Build | P1 | M | Publikace editorial článků do HDUA |
| 217 | `HDUA-17-VENOM-DESIGN-PROPAGATION` | Build | P1 | M | Venom/sharp design napříč appkou + úklid |
| 218 | `HDUA-18-GLOBAL-SCROLLBAR-READER` | Build | P2 | S | Globální posuvník i pro čtečku/detail |
| 219 | `HDUA-19-VCS-CHECKPOINT` | Foundation | P0 | S | Git checkpoint — HDUA + HDCC pod verzí |
| 220 | `HDUA-20-QUALITY-GATE` | Validate | P2 | M | Quality gate — testy, lint, CI |

---

## 0. HDUA modul — scaffold nativní Expo app + úklid složek

- **ID:** `HDUA-00-SCAFFOLD`  ·  **Fáze:** Foundation  ·  **Priorita:** P0  ·  **Komplexita:** L
- **Domény:** FRONTEND, INFRASTRUCTURE  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/**`

**Účel.** Založit samostatný HDUA modul jako nativní React Native (Expo) aplikaci a uklidit/sjednotit předešlé složky.

**Co (popis).** Vytvořit /SYSTEM/hotdroppz/HDUA jako čistý Expo (React Native) projekt s Expo Router, TypeScript, Zustand, TanStack Query, Reanimated, FlashList a Supabase JS. Plně oddělené od HDCC. Reconcile: frontend-web zůstává jako veřejný web, lounchapp archivovat (legacy start skripty).

**Proč (rationale).** Bez čistého odděleného modulu by se nativní app míchala s Next.js webem a vznikl by chaos. Samostatný Expo projekt je nutná podmínka pro všechny další mise.

> **Pozor / důležité:** POZOR na duplicitu: frontend-web má v CLAUDE.md napsáno "HotDroppZ User App (HDUA)" a už obsahuje feed/api/akce/auth (Next.js PWA). Rozhodnutí CEO: HDUA = NATIVNÍ app, z frontend-web se reusne jen DB schéma + Content API, frontend-web zůstává jako web. Nezakládat znovu to, co půjde sdílet (typy, schéma).

**Hotovo když (success criteria):**
- HDUA/ existuje jako spustitelný Expo projekt (expo start naběhne)
- Struktura složek dle specifikace (src/app, screens, components, feed, posts, ...)
- Design system: dark téma + neon-green accent dle mockupů, sdílené tokeny
- frontend-web nedotčen jako web; lounchapp přesunut do ZALOHA/legacy s poznámkou
- README + .env.example + funkční prázdná navigace

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Init Expo projekt | create-expo-app v SYSTEM/hotdroppz/HDUA, TypeScript, Expo Router (file-based), ESLint/Prettier sjednocené s repo. | Základ, na kterém stojí vše ostatní. | frontend-engineer | M |
| 02 | Struktura složek | Vytvořit src/{app,screens,components,feed,posts,profiles,search,notifications,settings,player,analytics,api,hooks,stores,utils,types,styles,assets} + database, docs, tests, public. | Pevná struktura = škálovatelnost a jasné vlastnictví kódu. | frontend-engineer | S |
| 03 | Design system / téma | Definovat barvy (černá/neon-green dle mockupů), typografii, spacing, ikony (outline), komponentové primitivy. Dark-first. | Konzistentní moderní vzhled, který udrží uživatele u obrazovky. | ui-ux-designer | M |
| 04 | Reconcile složek | frontend-web ponechat (web). lounchapp → ZALOHA/legacy. Zdokumentovat v HDUA/docs/ANALYSIS.md co se sdílí (DB, typy, Content API). | Odstranit duplicitu a zmatek mezi web/app/launcher. | devops | S |
| 05 | Sdílené typy | Vytáhnout FeedItem/Post/Artist typy do sdíleného balíčku/komponenty mezi HDCC, frontend-web a HDUA (single source of truth). | Aby se kontrakt obsahu nerozjel mezi web a native. | backend-engineer | M |

---

## 1. HDUA databázová vrstva

- **ID:** `HDUA-01-DATABASE`  ·  **Fáze:** Foundation  ·  **Priorita:** P0  ·  **Komplexita:** L
- **Domény:** DATABASE, BACKEND  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/database/**`

**Účel.** Připravit datový model HDUA: uživatelské tabulky + sjednocený feed pohled nad pipeline daty.

**Co (popis).** Tabulky: users, profiles, feed_items, artists, releases, articles, videos, images, alerts, notifications, saved_posts, liked_posts, comments, post_views, user_sessions, user_settings, search_history, trending_topics. Feed item musí mít: id, type, title, content, cover_image, artist, country, language, category, subcategory, source, source_url, score, created_at, updated_at, published_at.

**Proč (rationale).** Feed Engine i personalizace potřebují stabilní schéma. Bez oddělení "obsah (pipeline)" vs "interakce (user)" by se míchaly zodpovědnosti a RLS by byl nemožný.

> **Pozor / důležité:** Pipeline už produkuje feed_posts/posts/scout_items v HDCC Supabase. NEDUPLIKOVAT obsah — feed_items je čtecí pohled/projekce nad pipeline výstupem; user_* tabulky jsou nové (interakce). RLS: každý uživatel vidí jen svá data; obsah je public-read přes Content API.

**Hotovo když (success criteria):**
- Migrace v HDUA/database/ aplikovatelné přes apply-sql
- feed_items projekce mapuje pipeline výstup na kontrakt feed item
- User interaction tabulky s RLS politikami
- Indexy pro cursor pagination (created_at, score) a fulltext search

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | User & profile tabulky | users, profiles, user_settings, user_sessions, search_history s RLS (owner-only). | Identita a personalizace stojí na těchto tabulkách. | backend-engineer | M |
| 02 | Interaction tabulky | saved_posts, liked_posts, comments, post_views s indexy a RLS. | Signály pro personalizaci a sociální funkce. | backend-engineer | M |
| 03 | Feed projekce | feed_items view/materializace nad feed_posts+posts s povinnými poli kontraktu (type, cover_image, country, language, category, score...). | Jednotný tvar dat pro klienta nezávislý na interním schématu pipeline. | backend-engineer | L |
| 04 | Trending & notifications | trending_topics, alerts, notifications tabulky + plnění z Trend Engine. | Realtime trendy a upozornění jsou klíč pro retenci. | backend-engineer | M |
| 05 | Indexy + RLS audit | Cursor pagination indexy, fulltext (GIN), ověření RLS na všech user tabulkách. | Výkon pro nekonečný feed a bezpečnost dat. | security | M |

---

## 2. Content API + HDCC→HDUA bridge

- **ID:** `HDUA-02-CONTENT-API`  ·  **Fáze:** Foundation  ·  **Priorita:** P0  ·  **Komplexita:** XL
- **Domény:** BACKEND, PIPELINE  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/api/**`

**Účel.** Stabilní read-API, které nativní HDUA app konzumuje, plněné eventy z HDCC pipeline.

**Co (popis).** Endpointy: /feed, /feed/trending, /feed/latest, /feed/recommended, /post/:id, /search, /search/artists, /search/releases, /alerts, /profile, /settings, /notifications. Komunikace HDCC → Events → Content API → HDUA. Versioned kontrakt, CORS pro native, cursor pagination, ETag/caching.

**Proč (rationale).** Feed Engine (HDUA-05) bez stabilního API nemá co konzumovat. Verzovaný kontrakt chrání nasazené appky před breaking changes z pipeline.

> **Pozor / důležité:** Native app nemůže číst DB přímo jako Next SSR — potřebuje HTTP API s tokenem (Supabase JWT). Rozhodnout hosting API: reuse backend (NestJS) NEBO dedikované route handlers. Kontrakt musí být verzovaný (v1) — mobilní klienti se neaktualizují okamžitě.

**Hotovo když (success criteria):**
- OpenAPI/typovaný kontrakt v1 pro všechny endpointy
- Cursor pagination (?cursor=...&limit=...) na /feed*
- Auth přes Supabase JWT + rate limiting
- Event/publish cesta z HDCC plní feed (nové itemy se objeví do X s)
- Smoke testy na každý endpoint

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Kontrakt v1 | Definovat request/response typy a OpenAPI pro všechny endpointy, sdílet typy s klientem. | Bez kontraktu se klient a server rozjedou. | backend-engineer | M |
| 02 | Feed endpointy | /feed, /trending, /latest, /recommended s cursor pagination nad feed_items. | Jádro datového toku do appky. | backend-engineer | L |
| 03 | Post & search | /post/:id (plný obsah + related), /search, /search/artists, /search/releases (fulltext). | Detail a vyhledávání obsahu. | backend-engineer | L |
| 04 | User endpointy | /profile, /settings, /alerts, /notifications s JWT auth + RLS. | Personalizovaná a chráněná data. | backend-engineer | M |
| 05 | HDCC bridge | Event/publish kanál z pipeline (Feed Generator/Publisher) → Content API cache invalidation/push. | Realtime čerstvost feedu = retence. | ai-pipeline | L |
| 06 | CORS + caching + rate limit | CORS pro native origin, ETag/Cache-Control, rate limiting, error envelope. | Výkon, bezpečnost a stabilita pod zátěží. | security | M |

---

## 3. App shell + spodní navigace

- **ID:** `HDUA-03-APP-SHELL-NAV`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** M
- **Domény:** FRONTEND, UI  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/app/**`

**Účel.** Skelet aplikace s Expo Router a spodní navigací Home / Search / Create / Alerts / Profile.

**Co (popis).** Spodní menu ve stylu Instagram/TikTok/Spotify, pouze outline ikony, minimal design. 5 sekcí. Tab navigace přes Expo Router, perzistentní mini-player nad tab barem. Splash + auth gate.

**Proč (rationale).** Navigace je kostra, do které se zavěsí feed, detail, search a profil. Musí být hotová dřív než obsahové obrazovky.

> **Pozor / důležité:** Mini-player (HDUA-08) sedí nad tab barem — nav layout musí počítat s jeho výškou od začátku. Safe-area insets (notch) na iOS.

**Hotovo když (success criteria):**
- 5 tabů funkčních s outline ikonami a aktivním stavem
- Expo Router file-based routing nastaven
- Safe-area + místo pro mini-player
- Splash screen + redirect na login když není session

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Expo Router layout | Root layout, (tabs) skupina, auth gate, splash. | Definuje celou navigační strukturu. | frontend-engineer | M |
| 02 | Tab bar | 5 outline ikon (Home/Search/Create/Alerts/Profile), aktivní stav neon-green, haptika. | Hlavní orientace v appce. | ui-ux-designer | M |
| 03 | Auth gate | Supabase session check, login/redirect, OAuth callback handling. | Chrání uživatelská data a personalizaci. | frontend-engineer | M |

---

## 4. Media vrstva

- **ID:** `HDUA-04-MEDIA-LAYER`  ·  **Fáze:** Build  ·  **Priorita:** P1  ·  **Komplexita:** L
- **Domény:** FRONTEND, UI  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/components/media/**`

**Účel.** Zobrazení a přehrávání médií: obrázky, galerie, audio preview, YouTube/Spotify embedy.

**Co (popis).** Napojení na HDCC Media Storage. Podpora: images, artwork, galleries, music previews, youtube videos, spotify embeds, artist photos, cover arts. Lazy/progressive loading, cache, blur placeholder.

**Proč (rationale).** Feed karty i detail bez media vrstvy nemají co zobrazit. Společná media vrstva = konzistence a výkon napříč obrazovkami.

> **Pozor / důležité:** Native: použít expo-image (cache, blurhash), expo-av pro audio/video, WebView jen pro spotify/youtube embed (nebo native SDK). Embed iframy z webu NEpřenášet 1:1.

**Hotovo když (success criteria):**
- expo-image s blurhash placeholderem a cache
- Audio preview přes expo-av (play/pause/seek)
- YouTube + Spotify embed přehratelný
- Galerie se swipe + pinch zoom

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Image + galerie | expo-image, progressive load, blurhash, swipe galerie, pinch zoom. | Vizuál je hlavní hook feedu. | frontend-engineer | M |
| 02 | Audio preview | expo-av preview snippet s progress a waveform. | Hudební preview drží uživatele u obrazovky. | frontend-engineer | M |
| 03 | Embeds | YouTube + Spotify přehrávání (native SDK nebo WebView fallback). | Přístup k plnému obsahu bez opuštění appky. | frontend-engineer | M |

---

## 5. Feed Engine (klient)

- **ID:** `HDUA-05-FEED-ENGINE`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** XL
- **Domény:** FRONTEND, PIPELINE  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/feed/**`

**Účel.** Nekonečný, výkonný, virtualizovaný feed konzumující Content API.

**Co (popis).** Nejdůležitější část appky. Infinite scroll bez stránkování: lazy loading, virtualized list (FlashList), cursor pagination. Type registry pro: release, article, video, fashion, drama, global_news, did_you_know, fun_fact, quote, artist_update, playlist, event, festival, interview, ranking, trend.

**Proč (rationale).** Feed je produkt. Pomalý nebo sekající feed = okamžitý odchod uživatele. Proto vlastní engine s virtualizací a prefetchem.

> **Pozor / důležité:** Výkon je vše — FlashList (ne FlatList) kvůli recyklaci, stabilní keyExtractor, getItemType per feed type, prefetch dalšího okna, optimistic UI pro akce. TanStack Query infinite query s cursorem.

**Hotovo když (success criteria):**
- Plynulý 60fps scroll na 1000+ položkách
- Cursor-based infinite query (žádné stránky)
- Type registry renderuje všech 17 typů
- Prefetch + cache, offline poslední okno
- Pull-to-refresh + "nové příspěvky" indikátor

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Virtualizovaný list | FlashList s getItemType, recyklace, estimatedItemSize, prefetch. | Bez virtualizace feed nezvládne tisíce položek. | frontend-engineer | L |
| 02 | Infinite query | TanStack Query useInfiniteQuery nad /feed s cursorem, dedupe, retry. | Nekonečné načítání bez stránkování. | frontend-engineer | L |
| 03 | Type registry | Mapování feed type → renderer komponenta, fallback pro neznámé typy. | Rozšiřitelnost o nové typy obsahu bez zásahu do jádra. | frontend-engineer | M |
| 04 | Refresh & realtime | Pull-to-refresh, "X nových" pill, napojení na realtime kanál z Content API. | Čerstvost = důvod se vracet. | frontend-engineer | M |
| 05 | Optimistic akce | Like/save/boost optimisticky s rollbackem při chybě. | Okamžitá odezva = návykovost. | frontend-engineer | M |

---

## 6. Feed Card layout

- **ID:** `HDUA-06-FEED-CARD`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** L
- **Domény:** UI, FRONTEND  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/components/cards/**`

**Účel.** Vizuál karty příspěvku dle referenčních mockupů.

**Co (popis).** Struktura: hero image, headline, tagy, metadata, krátký preview obsahu, action bar. Tagy: Artist, Country, Genre, Category, Type. Plus prvky z mockupu: live signals (+284%, #3 trending, listening now), action bar (like/add/comment/share/boost), source pills (Spotify/Apple/YouTube), AI take, related.

**Proč (rationale).** Karta je první dojem každého příspěvku. Promyšlený layout s jasnou hierarchií rozhoduje o tom, zda uživatel scrolluje dál nebo otevře detail.

> **Pozor / důležité:** Mockupy: tmavé pozadí, neon-green akcenty, "NEW DROP" badge, waveform overlay u release. Karty musí mít variace podle typu (release vs article vs quote). Drop-post varianta = celoobrazovkový hero (druhý mockup).

**Hotovo když (success criteria):**
- Karta odpovídá mockupům (hero, tagy, signals, action bar, source pills, AI take)
- Varianty podle feed type
- Action bar s optimistickými akcemi a počty
- Plně přístupné (a11y labels, kontrast)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Base card | Hero image, headline, tagy (artist/country/genre/category/type), metadata, preview. | Společný základ všech karet. | ui-ux-designer | M |
| 02 | Live signals + action bar | +284%/trending/listening now, like/add/comment/share/boost s počty. | Sociální důkaz a interakce zvyšují engagement. | frontend-engineer | M |
| 03 | Source pills + AI take | Spotify/Apple/YouTube piluky, AI take blok, related náhledy. | Kontext a cesta k plnému obsahu. | frontend-engineer | M |
| 04 | Type varianty | Release (waveform), article, quote, fun_fact, drop-post hero varianta. | Každý typ obsahu má optimální prezentaci. | ui-ux-designer | M |

---

## 7. Post Detail Engine + plynulý přechod

- **ID:** `HDUA-07-POST-DETAIL`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** XL
- **Domény:** FRONTEND, UI  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/posts/**`

**Účel.** Detail příspěvku se smooth expand a nekonečným navázáním na další obsah (TikTok + Apple News).

**Co (popis).** Tap → smooth expand → full content page. Podpora: long articles, image galleries, videos, audio players, spotify/youtube embeds, source links, related content. Po dočtení: scroll down → automaticky navazuje další příspěvek bez návratu do feedu. Tok: Feed → Open Post → Read → Continue → Next Post.

**Proč (rationale).** Plynulý přechod feed↔detail a auto-navázání dalšího obsahu je hlavní retenční mechanika celé appky (kombinace TikTok a Apple News). Bez něj je to jen další čtečka.

> **Pozor / důležité:** Toto je srdce "udrží člověka u obrazovky". Shared element transition (Reanimated) z karty do detailu. Po konci článku prefetchnout a vykreslit další post pod ním — kontinuální vertikální čtečka, ne modal. Stav scrollu a historie musí zůstat konzistentní s feedem.

**Hotovo když (success criteria):**
- Shared-element expand z karty do detailu (60fps)
- Detail renderuje všechny typy obsahu + embeds
- Po dočtení se plynule načte další post (bez návratu do feedu)
- Related posts pod obsahem
- Zpět gesto zachová pozici ve feedu

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Expand transition | Reanimated shared element z FeedCard do PostDetail, gesture-driven. | Plynulost přechodu = prémiový pocit. | frontend-engineer | L |
| 02 | Content renderer | Long article, galerie, video, audio, spotify/youtube embed, source links. | Detail musí zvládnout libovolný typ obsahu. | frontend-engineer | L |
| 03 | Continuous reader | Po konci obsahu prefetch + render dalšího postu pod ním (vertikální kontinuita). | Klíčová návyková mechanika — nekonečné pokračování. | frontend-engineer | XL |
| 04 | Related + zpět | Related posts blok, zpět gesto se zachováním feed pozice. | Udržení kontextu a objevování dalšího obsahu. | frontend-engineer | M |

---

## 8. Globální přehrávač

- **ID:** `HDUA-08-PLAYER`  ·  **Fáze:** Build  ·  **Priorita:** P1  ·  **Komplexita:** L
- **Domény:** FRONTEND, UI  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/player/**`

**Účel.** Perzistentní audio/preview přehrávač (mini-player + full screen).

**Co (popis).** Mini-player nad tab barem (dle mockupu: cover, název, artist, play/pause, skip) → tap → full player s waveform, progress barem, frontou. Pokračuje napříč obrazovkami.

**Proč (rationale).** Hudební preview, které běží i při scrollování dál, výrazně prodlužuje čas v appce a propojuje feed s reálným poslechem.

> **Pozor / důležité:** Stav přehrávače globální (Zustand) nezávislý na navigaci. Background audio (expo-av + iOS background mode). Waveform z preview snippetu.

**Hotovo když (success criteria):**
- Mini-player perzistentní napříč taby
- Full player s waveform + frontou
- Background přehrávání
- Napojení na source pills (přechod do Spotify/YouTube)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Player store | Globální Zustand store (track, queue, stav, pozice). | Jeden zdroj pravdy pro přehrávání napříč appkou. | frontend-engineer | M |
| 02 | Mini + full UI | Mini-player bar + full screen s waveform a progress, gesto pro expand. | Ovládání bez vytržení z feedu. | ui-ux-designer | M |
| 03 | Background audio | expo-av background mode, lock-screen kontrolky. | Poslech pokračuje i mimo appku = retence. | frontend-engineer | M |

---

## 9. Personalizace a doporučování

- **ID:** `HDUA-09-PERSONALIZATION`  ·  **Fáze:** Build  ·  **Priorita:** P1  ·  **Komplexita:** L
- **Domény:** AI_SYSTEM, BACKEND  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/api/recommend/**`

**Účel.** AI doporučovací vrstva produkující personalizovaný feed ze signálů uživatele.

**Co (popis).** Signály: likes, views, saves, shares, followed artists/countries/genres, session duration, scroll depth. Výstup: recommended feed (/feed/recommended). Sběr signálů na klientu, scoring na serveru.

**Proč (rationale).** Personalizovaný feed dramaticky zvyšuje relevanci a retenci. Bez doporučování je feed jen chronologický a rychle nudí.

> **Pozor / důležité:** Začít rule-based scoringem (čerstvost × afinita × trend) než bude dost dat na ML. Signály posílat batchovaně, ne per-event (baterie/síť). GDPR: signály jsou osobní data — opt-out + retence.

**Hotovo když (success criteria):**
- Klient sbírá a batchuje signály (view, scroll depth, dwell)
- /feed/recommended vrací personalizované pořadí
- Rule-based scoring s jasnými váhami (dokumentováno)
- Opt-out + GDPR retence signálů

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Sběr signálů | Klientský tracker (impression, dwell, scroll depth, akce) s batchováním. | Bez dat není co personalizovat. | frontend-engineer | M |
| 02 | Scoring engine | Server-side rule-based ranking (čerstvost × afinita × trend), váhy konfigurovatelné. | Jádro doporučování, vysvětlitelné a laditelné. | ai-pipeline | L |
| 03 | Recommended feed | /feed/recommended napojený na scoring + fallback na latest. | Doručení personalizace do appky. | backend-engineer | M |

---

## 10. HDCC Live Pipeline Monitor

- **ID:** `HDUA-10-PIPELINE-MONITOR`  ·  **Fáze:** Scale  ·  **Priorita:** P1  ·  **Komplexita:** L
- **Domény:** ANALYTICS, PIPELINE  ·  **Cesta:** `command-centrum/app/(dashboard)/**`

**Účel.** Extrémně detailní realtime logovací panel pipeline uvnitř HDCC.

**Co (popis).** Sekce: Scout, Parser, Normalizer, Translator, Classifier, Deduplicator, Cluster Engine, Artist Engine, Release Engine, Trend Engine, Feed Generator, Publisher. U každé: status, latency, queue size, items processed, errors, warnings, last update. Realtime refresh.

**Proč (rationale).** Provozní viditelnost pipeline je nutná pro důvěru v obsah a rychlou diagnostiku. Tvoří i datový základ pro Live Preview (HDUA-11).

> **Pozor / důležité:** Toto je HDCC-side (ne v native appce). Reuse existující pipeline state/log infrastrukturu v command-centrum. Realtime přes Supabase realtime nebo SSE. Nepřetěžovat — agregace, ne každý řádek logu.

**Hotovo když (success criteria):**
- 12 stage panelů s metrikami (status/latency/queue/processed/errors/warnings)
- Realtime refresh bez reloadu
- Historie a barevné stavy (ok/warn/error)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Stage metriky API | Agregovaný endpoint se stavem 12 stage z pipeline state. | Jeden zdroj metrik pro panel. | backend-engineer | M |
| 02 | Monitor UI | 12 panelů, barevné stavy, latency/queue grafy. | Přehled celé pipeline na jedné obrazovce. | frontend-engineer | M |
| 03 | Realtime kanál | Supabase realtime/SSE napojení s throttlingem. | Živá data bez reloadu. | backend-engineer | M |

---

## 11. HDUA Live Preview v HDCC

- **ID:** `HDUA-11-LIVE-PREVIEW`  ·  **Fáze:** Scale  ·  **Priorita:** P2  ·  **Komplexita:** M
- **Domény:** UI, ANALYTICS  ·  **Cesta:** `command-centrum/app/(dashboard)/**`

**Účel.** Split náhled v HDCC: 60 % pipeline log + 40 % živý mobilní náhled feedu.

**Co (popis).** Na hlavní HDCC stránce: vlevo (60 %) HDCC Pipeline Log, vpravo (40 %) Live Mobile Preview s aktuálním feedem, novými příspěvky, trendy a live aktualizacemi v reálném čase.

**Proč (rationale).** CEO/editor vidí okamžitě, co uživatel uvidí, hned jak to vyjde z pipeline — zkracuje smyčku mezi obsahem a kontrolou kvality.

> **Pozor / důležité:** Mobilní náhled = web render feedu (sdílené feed komponenty nebo expo web build v iframe/device rámu). Reuse Content API a feed komponent, ať preview odpovídá realitě native appky.

**Hotovo když (success criteria):**
- Split layout 60/40 na HDCC dashboardu
- Live mobile preview renderuje reálný feed z Content API
- Nové příspěvky/trendy se objevují realtime

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Split layout | 60/40 resizable panel na HDCC overview. | Současně log i náhled. | frontend-engineer | S |
| 02 | Device preview | Telefonní rám s web renderem feedu (sdílené komponenty / expo web). | Náhled odpovídá native appce. | frontend-engineer | M |
| 03 | Realtime sync | Napojení preview na stejný realtime kanál jako monitor. | Živá shoda s produkcí. | frontend-engineer | M |

---

## 12. User Analytics Dashboard

- **ID:** `HDUA-12-ANALYTICS`  ·  **Fáze:** Scale  ·  **Priorita:** P2  ·  **Komplexita:** M
- **Domény:** ANALYTICS  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/analytics/**`

**Účel.** Metriky chování uživatelů HDUA.

**Co (popis).** Metriky: DAU, MAU, Retention, Session Length, Scroll Depth, Top Artists, Top Countries, Top Categories, CTR, Engagement Rate. Dashboard v HDCC nad signály z personalizace.

**Proč (rationale).** Bez metrik retence a engagementu nelze řídit produkt ani prokázat růst. Staví na signálech, které už personalizace sbírá.

> **Pozor / důležité:** Reuse signály z HDUA-09 (žádný druhý tracking SDK). Agregace server-side, dashboard read-only. GDPR-safe (anonymizované agregáty).

**Hotovo když (success criteria):**
- Dashboard s 10 klíčovými metrikami
- DAU/MAU/retention výpočet ze sessions
- Top artists/countries/categories žebříčky
- Engagement rate + CTR z interakcí

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Agregace metrik | Server-side výpočet DAU/MAU/retention/session/scroll depth. | Spolehlivá čísla pro rozhodování. | backend-engineer | M |
| 02 | Dashboard UI | Karty + grafy 10 metrik v HDCC. | Přehled zdraví produktu. | frontend-engineer | M |

---

## 13. HDUA dokumentace

- **ID:** `HDUA-13-DOCS`  ·  **Fáze:** Validate  ·  **Priorita:** P2  ·  **Komplexita:** M
- **Domény:** QUALITY  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/docs/**`

**Účel.** Kompletní dokumentace architektury, DB, feed enginu, API, UI systému a nasazení.

**Co (popis).** Vygenerovat: HDUA_ARCHITECTURE.md, HDUA_DATABASE.md, HDUA_FEED_ENGINE.md, HDUA_API.md, HDUA_UI_SYSTEM.md, HDUA_DEPLOYMENT.md. Živá dokumentace, aktualizovaná průběžně s misemi.

**Proč (rationale).** Dokumentace drží škálovatelnost a onboarding při růstu týmu. Deployment doc je nutný pro vydání do storů.

> **Pozor / důležité:** Není to "až nakonec" — každá mise při dokončení aktualizuje svůj doc. Tato mise zajišťuje kostru a finální konsolidaci + deployment (EAS build, store submission).

**Hotovo když (success criteria):**
- 6 dokumentů vytvořeno a propojeno
- Architecture diagram HDCC→Events→Content API→HDUA
- Deployment: EAS build + store submission postup
- Každý doc odkazován z příslušné mise

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Architektura + DB + Feed | HDUA_ARCHITECTURE.md, HDUA_DATABASE.md, HDUA_FEED_ENGINE.md. | Pochopení systému pro nové vývojáře. | frontend-engineer | M |
| 02 | API + UI systém | HDUA_API.md (kontrakt v1), HDUA_UI_SYSTEM.md (design tokeny, komponenty). | Stabilní kontrakt a konzistentní UI. | frontend-engineer | M |
| 03 | Deployment | HDUA_DEPLOYMENT.md: EAS build, env, store submission, OTA updates. | Cesta od kódu k vydané appce. | devops | M |

---

## 14. Auth gate — přihlášení (Supabase)

- **ID:** `HDUA-14-AUTH-GATE`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** M
- **Domény:** FRONTEND, SECURITY  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/app/**`

**Účel.** Dokončit HDUA-03 sub03: login/session, aby fungovala uživatelská data.

**Co (popis).** Audit: feed je veřejný (anon view), ale profile/settings/likes/saves jsou RLS owner-only a bez přihlášení nedostupné. Doplnit Supabase auth flow (email/OAuth), session persistence, auth gate / redirect, a napojit user.ts akce na přihlášeného uživatele.

**Proč (rationale).** Bez loginu nejde personalizace, ukládání ani profil — polovina appky je mrtvá.

> **Pozor / důležité:** Supabase client už persistuje session (autoRefreshToken). Chybí UI flow + gate. Pozor na broken signup trigger (supabase-admin-account-blocker) — ověřit vznik hdua_profiles na signup.

**Hotovo když (success criteria):**
- Login/registrace (email + alespoň 1 OAuth) funkční
- Session přežije reload; logout funguje
- Like/Save/Profile/Settings čtou+zapisují data přihlášeného uživatele
- hdua_profiles se založí při signup (trigger ověřen)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Auth UI | Login/registrace obrazovka, venom styl, error stavy. | Vstupní bod pro uživatelská data. | frontend-engineer | M |
| 02 | Session + gate | Session check, redirect, logout, ochrana user routes. | Bezpečnost a perzistence. | frontend-engineer | M |
| 03 | Napojení akcí | Like/save/profile/settings na auth uživatele + RLS ověření. | Funkční personalizace. | frontend-engineer | M |

---

## 15. Aktivace enrichmentu — feed s reálnými médii

- **ID:** `HDUA-15-ENRICHMENT-ACTIVATION`  ·  **Fáze:** Build  ·  **Priorita:** P0  ·  **Komplexita:** M
- **Domény:** PIPELINE, BACKEND  ·  **Cesta:** `SYSTEM/hotdroppz/command-centrum/lib/pipeline/**`

**Účel.** Naplnit feed reálnými daty (artist, cover, Spotify/YouTube) — teď je vizuálně prázdný.

**Co (popis).** Audit: hdua_feed_items má artist 0/17, spotify 0/17, cover 2/17 — view je správně napojen na story_clusters (2026-06-11), ale enrichment nikdy nedoběhl (chybí API klíče). Doplnit GROQ/SPOTIFY/YOUTUBE/GENIUS klíče do command-centrum/.env.local, spustit enrichment + feed-builder, ověřit, že data tečou přes view do HDUA.

**Proč (rationale).** Bez médií vypadá appka prázdně; je to největší viditelný nedostatek.

> **Pozor / důležité:** View i realtime bridge už hotové (HDUA-02 sub05). Tohle je čistě HDCC-side: klíče + běh pipeline. Enrichment má fallbacky — pipeline nespadne, jen vrací prázdno bez klíčů.

**Hotovo když (success criteria):**
- API klíče doplněny a ověřeny (Spotify token, YouTube, Genius)
- Enrichment doběhl: story_clusters mají artist_name/image/spotify > 0
- hdua_feed_items vrací cover/artist/spotify pro většinu položek

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Klíče + ověření | Doplnit a otestovat GROQ/SPOTIFY/YOUTUBE/GENIUS klíče. | Enrichment bez nich degraduje na prázdno. | backend-engineer | S |
| 02 | Běh enrichment + feed-builder | Spustit pipeline, naplnit clustery, postavit feed_posts. | Naplnit kontrakt reálnými daty. | ai-pipeline | M |
| 03 | Ověření v HDUA | Refresh HDUA, ověřit cover/artist/source pills + realtime nový post. | Konec-konec ověření propojení. | frontend-engineer | S |

---

## 16. Publikace editorial článků do HDUA

- **ID:** `HDUA-16-EDITORIAL-PUBLISH`  ·  **Fáze:** Build  ·  **Priorita:** P1  ·  **Komplexita:** M
- **Domény:** BACKEND, PIPELINE  ·  **Cesta:** `SYSTEM/hotdroppz/command-centrum/**`

**Účel.** Dostat psané články (posts) do feedu — teď je 0 published.

**Co (popis).** Audit: posts má 20 řádků, 0 ve status=published, takže editorial větev hdua_feed_items nepřispívá ničím — HDUA ukazuje jen 17 music karet. Přidat v HDCC publikační akci (a/nebo kvalitní auto-publish gate) a ověřit, že published články se objeví v HDUA feedu.

**Proč (rationale).** Polovina obsahového typu (články) je pro uživatele neviditelná.

> **Pozor / důležité:** View už editorial větev má (WHERE status=published). Publikace je editorský krok — neflipovat naslepo, ale dát na to UI/gate v HDCC.

**Hotovo když (success criteria):**
- HDCC umožní publikovat post (UI akce nebo gate)
- Published post se objeví v hdua_feed_items jako type=article
- Ověřeno v HDUA feedu

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Publish akce | UI/akce v HDCC pro publish + audit stopa. | Kontrolovaný tok do produkce. | backend-engineer | M |
| 02 | Ověření v HDUA | Publikovat 1 článek, ověřit zobrazení a detail. | Konec-konec ověření. | frontend-engineer | S |

---

## 17. Venom/sharp design napříč appkou + úklid

- **ID:** `HDUA-17-VENOM-DESIGN-PROPAGATION`  ·  **Fáze:** Build  ·  **Priorita:** P1  ·  **Komplexita:** M
- **Domény:** UI, FRONTEND  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/**`

**Účel.** Sjednotit nový venom/sharp jazyk na všechny obrazovky a uklidit dead code.

**Co (popis).** Po UI overhaulu (2026-06-11) projít FeedCard, FeedPage reader, Search, Alerts, Profile, ShareSheet a doladit venom #00EC88 + ostré hrany + glow konzistentně. Úklid: smazat nepoužitý src/components/brand/FlameMark.tsx (nahrazen rasterem flame.png); přebarvit share-card-template.svg a assets/README z legacy lime #B6FF3B na venom; odstranit stray console.

**Proč (rationale).** Nesourodé obrazovky a dead code sráží „luxury 2026" dojem a matou údržbu.

> **Pozor / důležité:** Komponenty čerpají z theme tokenů, takže barvy se z větší části propsaly samy — tahle mise je o konzistenci, detailech a úklidu, ne o přebarvování tokenů.

**Hotovo když (success criteria):**
- Všechny taby (Home/Search/Create/Alerts/Profile) i reader ve venom/sharp stylu
- FlameMark.tsx smazán (nebo reálně použit pro splash)
- share-card-template.svg + README ve venom (#00EC88), žádné #B6FF3B
- Žádné stray console.* ve src

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Surface pass | Projít a doladit všechny obrazovky + reader (venom/sharp/glow). | Konzistentní prémiový vzhled. | ui-ux-designer | M |
| 02 | Brand assety | Share card SVG + README na venom; sjednotit odstín. | Sdílené obrázky musí být on-brand. | graphic-designer | S |
| 03 | Úklid kódu | Smazat FlameMark, odstranit console, mrtvé importy. | Čistá údržba. | frontend-engineer | S |

---

## 18. Globální posuvník i pro čtečku/detail

- **ID:** `HDUA-18-GLOBAL-SCROLLBAR-READER`  ·  **Fáze:** Build  ·  **Priorita:** P2  ·  **Komplexita:** S
- **Domény:** FRONTEND  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/src/feed/**`

**Účel.** Posuvník teď reflektuje jen feed; napojit i na scroll článku a post/[id].

**Co (popis).** Globální posuvník (root layout, tažitelný) řídí jen feed přes sbProgress/sbThumbFraction. Na statických obrazovkách a v otevřeném postu/čtečce ukazuje stale pozici feedu. Napojit aktivní scroll surface (FeedPage inner ScrollView při expandu, post/[id] reader) na stejné sdílené hodnoty + registrovat scroller, aby thumb odpovídal tomu, co se reálně scrolluje.

**Proč (rationale).** Aby posuvník byl pravdivý všude, ne jen na feedu.

> **Pozor / důležité:** Mechanika hotová (scrollbarShared: sbProgress/sbThumbFraction/setScroller/driveScroll). Jde o napojení dalších scroll kontejnerů a reset na screenech bez scrollu.

**Hotovo když (success criteria):**
- Otevřený článek/čtečka řídí thumb (pozice odpovídá obsahu)
- post/[id] reader napojen
- Na obrazovkách bez scrollu thumb neukazuje cizí pozici

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Reader scroll → sb | Napojit FeedPage inner ScrollView + post/[id] na sdílené hodnoty. | Pravdivý posuvník v detailu. | frontend-engineer | S |
| 02 | Reset/ownership | Předávání „active scroller" mezi surfacy + reset. | Žádná stale pozice. | frontend-engineer | S |

---

## 19. Git checkpoint — HDUA + HDCC pod verzí

- **ID:** `HDUA-19-VCS-CHECKPOINT`  ·  **Fáze:** Foundation  ·  **Priorita:** P0  ·  **Komplexita:** S
- **Domény:** INFRASTRUCTURE  ·  **Cesta:** `SYSTEM/hotdroppz/**`

**Účel.** Dostat veškerou HDUA/command-centrum práci pod verzování; teď je celé untracked.

**Co (popis).** Audit zjistil, že HDUA/ i command-centrum/ jsou v gitu kompletně UNTRACKED (41 uncommitted, žádná historie, žádný remote). Doplnit .gitignore (node_modules, .expo, dist, .env*), provést první commit HDUA, nastavit remote a push. Bez toho je veškerá práce na jediný omyl ztracená.

**Proč (rationale).** Žádná historie = žádný rollback a vysoké riziko ztráty. P0 hygiena.

> **Pozor / důležité:** Souvisí s repo-structure-no-remote-blocker. NEcommitovat .env.local (obsahuje anon klíč — gitignore). Ověřit, že se necommitnou node_modules a .expo.

**Hotovo když (success criteria):**
- .gitignore pokrývá node_modules/.expo/dist/.env*
- HDUA + command-centrum commitnuté (čistý git status)
- Remote nastaven a push proběhl (nebo zdokumentováno proč ne)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | .gitignore + commit | Doplnit .gitignore, git add/commit HDUA a command-centrum. | Základní bezpečnost práce. | devops | S |
| 02 | Remote + push | Nastavit git remote (GitHub) a push; volitelně CI lint+typecheck. | Záloha mimo lokál + základ CI/CD. | devops | M |

---

## 20. Quality gate — testy, lint, CI

- **ID:** `HDUA-20-QUALITY-GATE`  ·  **Fáze:** Validate  ·  **Priorita:** P2  ·  **Komplexita:** M
- **Domény:** QUALITY  ·  **Cesta:** `SYSTEM/hotdroppz/HDUA/**`

**Účel.** Zavést minimální testovací a lint bránu pro HDUA.

**Co (popis).** Audit: tests/ je prázdné, žádné testy. Doplnit unit testy pro mappers (row→FeedItem), api/content (cursor pagination, fallbacky) a hooks; zajistit čistý eslint a typecheck v CI (lint + tsc + test).

**Proč (rationale).** Bez bran se regrese (jako rozbité scrolly/gesta) chytají až u uživatele.

> **Pozor / důležité:** tsc je čistý. Eslint dořešit (běžel pomalu v auditu). Priorita: mappers + api kontrakt.

**Hotovo když (success criteria):**
- Testy pro mappers + content API + 1 hook
- eslint čistý, žádné warningy nad limit
- CI: lint + typecheck + test (alespoň lokálně skript)

**Kroky (sub-mise):**

| # | krok | jak | proč | owner | odhad |
|---|------|-----|------|-------|-------|
| 01 | Unit testy | mappers, content API, useFeed. | Chytat regrese kontraktu. | frontend-engineer | M |
| 02 | Lint + CI | eslint clean + CI skript (lint/tsc/test). | Automatická brána kvality. | devops | S |

---
