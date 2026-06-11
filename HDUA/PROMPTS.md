# HDUA — Prompty pro jednotlivé mise

> Ready-to-run prompty. Spouštěj **v pořadí** (00 → 13). Každý prompt předpokládá dokončené předchozí mise.
> Stack je fixní: **Expo (React Native) + Expo Router + TanStack Query + Zustand + FlashList + Reanimated + Supabase**.
> Umístění modulu: `D:\hot droppZ\SYSTEM\hotdroppz\HDUA`. Mise v systému: `NOTES/plan.json`, prefix `HDUA-`.

**Globální pravidla pro každou misi:**
- Po dokončení aktualizuj příslušnou misi v `NOTES/plan.json` (status, subMission.status, auditLog) a re-generuj `HDUA/MISSIONS.md` (`node scripts/gen-hdua-docs.mjs`).
- Žádné míchání s HDCC kódem mimo mise 10/11. frontend-web se needituje (zůstává web).
- Vždy nech app spustitelnou (`expo start` naběhne) — žádné rozbité commity.

---

## HDUA-00 — Scaffold + úklid složek

```
Založ nativní HDUA app. V D:\hot droppZ\SYSTEM\hotdroppz\HDUA vytvoř čistý Expo
(React Native, TypeScript) projekt s Expo Router. Přidej a nakonfiguruj: Zustand,
@tanstack/react-query, @shopify/flash-list, react-native-reanimated +
react-native-gesture-handler, @supabase/supabase-js, expo-image, expo-av.

Vytvoř strukturu složek: src/{app,screens,components,feed,posts,profiles,search,
notifications,settings,player,analytics,api,hooks,stores,utils,types,styles,assets},
plus database/, docs/, tests/, public/.

Postav design system v src/styles (dark-first, neon-green accent dle mockupů v
HDUA/PROMPTS.md kontextu): barvy, typografie, spacing, radius, outline ikony.
Prázdná tab navigace (5 tabů) ať naběhne.

Úklid: frontend-web NEMĚŇ (zůstává veřejný web). lounchapp přesuň do
SYSTEM/hotdroppz/ZALOHA/legacy-lounchapp s poznámkou. Do HDUA/docs/ zapiš, co se
sdílí s frontend-web/HDCC (DB schéma, typy, Content API).

Vytáhni sdílené typy (FeedItem, Post, Artist) do src/types tak, aby šly použít i jinde.
Hotovo když: expo start naběhne, struktura sedí, téma aplikované, lounchapp uklizen.
Pak označ HDUA-00-SCAFFOLD v plan.json jako in_progress→done a re-generuj MISSIONS.md.
```

---

## HDUA-01 — Databázová vrstva

```
Vytvoř datový model HDUA do HDUA/database/ jako SQL migrace (aplikovatelné přes
command-centrum/scripts/apply-sql.mjs).

User/interakce tabulky (NOVÉ): users, profiles, user_settings, user_sessions,
search_history, saved_posts, liked_posts, comments, post_views — vše s RLS owner-only.
Realtime/trendy: trending_topics, alerts, notifications.

Obsah NEDUPLIKUJ: vytvoř feed_items jako VIEW/projekci nad existujícími feed_posts+posts
z pipeline, s povinnými poli kontraktu: id, type, title, content, cover_image, artist,
country, language, category, subcategory, source, source_url, score, created_at,
updated_at, published_at.

Přidej indexy pro cursor pagination (created_at, score) a fulltext (GIN) pro search.
Ověř RLS na všech user tabulkách (security audit).
Hotovo když: migrace běží, feed_items projekce vrací správný tvar, RLS sedí.
Aktualizuj HDUA-01-DATABASE v plan.json + MISSIONS.md.
```

---

## HDUA-02 — Content API + HDCC bridge

```
Postav read Content API v1, které konzumuje nativní app, plněné z HDCC pipeline.

Endpointy (cursor pagination kde dává smysl): /feed, /feed/trending, /feed/latest,
/feed/recommended, /post/:id (plný obsah + related), /search, /search/artists,
/search/releases, /alerts, /profile, /settings, /notifications.

Rozhodni a zdůvodni hosting: reuse backend (NestJS) NEBO Next route handlers. Auth =
Supabase JWT. Přidej: versioned kontrakt v1 (OpenAPI + sdílené TS typy), CORS pro
native origin, ETag/Cache-Control, rate limiting, jednotný error envelope.

Bridge: napoj Feed Generator/Publisher z HDCC na invalidaci/refresh cache, ať se nové
itemy objeví ve feedu do pár sekund.

Napiš smoke testy na každý endpoint.
Hotovo když: kontrakt v1 hotov, /feed* stránkuje cursorem, auth+rate limit fungují,
nový obsah z pipeline se propisuje. Aktualizuj HDUA-02-CONTENT-API v plan.json + MISSIONS.md.
```

---

## HDUA-03 — App shell + spodní navigace

```
Postav kostru appky přes Expo Router. Spodní tab navigace (outline ikony, minimal,
styl IG/TikTok/Spotify): Home, Search, Create, Alerts, Profile. Aktivní stav neon-green,
haptika. Root layout, (tabs) skupina, auth gate (Supabase session → login/redirect,
OAuth callback), splash screen.

Počítej s mini-playerem nad tab barem (HDUA-08) — rezervuj výšku. Safe-area insets (notch).
Hotovo když: 5 tabů funguje, routing nastaven, auth gate chrání obsah, je místo pro player.
Aktualizuj HDUA-03-APP-SHELL-NAV v plan.json + MISSIONS.md.
```

---

## HDUA-04 — Media vrstva

```
Postav media vrstvu do src/components/media/. expo-image s blurhash placeholderem +
cache + progressive load. Swipe galerie s pinch zoom. Audio preview přes expo-av
(play/pause/seek) + jednoduchý waveform. YouTube + Spotify embed (native SDK nebo
WebView fallback). Napoj na HDCC Media Storage URL.
Hotovo když: obrázky/galerie, audio preview a embedy fungují plynule s cache.
Aktualizuj HDUA-04-MEDIA-LAYER v plan.json + MISSIONS.md.
```

---

## HDUA-05 — Feed Engine (klient)

```
Postav jádro produktu: nekonečný virtualizovaný feed v src/feed/. Použij FlashList
(getItemType per feed type, estimatedItemSize, recyklace, stabilní keyExtractor) +
TanStack useInfiniteQuery nad /feed s cursorem (žádné stránky), prefetch dalšího okna,
dedupe, retry.

Type registry: mapuj feed type → renderer pro release, article, video, fashion, drama,
global_news, did_you_know, fun_fact, quote, artist_update, playlist, event, festival,
interview, ranking, trend (+ fallback pro neznámý typ).

Pull-to-refresh, "X nových" pill napojený na realtime kanál Content API, optimistic UI
pro like/save/boost s rollbackem.
Hotovo když: 60fps scroll na 1000+ položkách, cursor infinite query, všech 17 typů se
renderuje, refresh+realtime+optimistic akce fungují.
Aktualizuj HDUA-05-FEED-ENGINE v plan.json + MISSIONS.md.
```

---

## HDUA-06 — Feed Card layout

```
Postav FeedCard komponenty v src/components/cards/ přesně dle mockupů (tmavé pozadí,
neon-green akcenty). Base card: hero image, headline, tagy (Artist, Country, Genre,
Category, Type), metadata, krátký preview.

Doplň prvky z mockupu: NEW DROP badge, live signals (+284% since 24h, #3 trending,
listening now), action bar (like/add/comment/share/boost s počty), source pills
(Spotify/Apple/YouTube), AI take blok, related náhledy.

Varianty podle typu: release (waveform overlay), article, quote, fun_fact, a
celoobrazovková drop-post hero varianta (druhý mockup). a11y labels + kontrast.
Hotovo když: karty sedí na mockupy, varianty per typ, action bar s optimistickými akcemi.
Aktualizuj HDUA-06-FEED-CARD v plan.json + MISSIONS.md.
```

---

## HDUA-07 — Post Detail Engine + plynulý přechod (KRITICKÉ)

```
Toto je hlavní retenční mechanika. Postav src/posts/.

1) Tap na kartu → shared-element expand (Reanimated, gesture-driven, 60fps) z FeedCard
   do PostDetail.
2) Content renderer: long article, image galleries, video, audio player, spotify/youtube
   embedy, source links.
3) Continuous reader: po dočtení obsahu prefetchni a vykresli DALŠÍ post pod ním —
   vertikální kontinuální čtečka (ne modal). Tok: Feed → Open Post → Read → Continue → Next.
   Bez návratu do feedu.
4) Related posts blok. Zpět gesto zachová pozici ve feedu.
Hotovo když: expand je plynulý, detail zvládá všechny typy, po dočtení plynule navazuje
další post, zpět drží feed pozici. Aktualizuj HDUA-07-POST-DETAIL v plan.json + MISSIONS.md.
```

---

## HDUA-08 — Globální přehrávač

```
Postav globální audio přehrávač v src/player/. Zustand store (track, queue, stav, pozice)
nezávislý na navigaci. Mini-player nad tab barem (cover, název, artist, play/pause, skip)
→ tap → full player s waveform, progress barem a frontou. Background audio (expo-av iOS
background mode) + lock-screen kontrolky. Napoj na source pills (přechod do Spotify/YouTube).
Hotovo když: mini-player perzistuje napříč taby, full player s frontou, background přehrávání.
Aktualizuj HDUA-08-PLAYER v plan.json + MISSIONS.md.
```

---

## HDUA-09 — Personalizace a doporučování

```
Postav doporučovací vrstvu. Klient (src/analytics/): tracker signálů — impression, dwell
time, scroll depth, like/save/share/follow — odesílaný BATCHOVĚ (ne per-event).

Server: rule-based scoring engine (čerstvost × afinita × trend), váhy konfigurovatelné a
zdokumentované; napoj na /feed/recommended (fallback na latest). GDPR: opt-out + retence
signálů. (ML až bude dost dat.)
Hotovo když: signály se sbírají+batchují, /feed/recommended vrací personalizované pořadí,
scoring je vysvětlitelný, opt-out funguje. Aktualizuj HDUA-09-PERSONALIZATION v plan.json + MISSIONS.md.
```

---

## HDUA-10 — HDCC Live Pipeline Monitor (HDCC-side)

```
V command-centrum (NE v native appce) postav detailní realtime monitor pipeline.
Agregovaný endpoint se stavem 12 stage: Scout, Parser, Normalizer, Translator, Classifier,
Deduplicator, Cluster Engine, Artist Engine, Release Engine, Trend Engine, Feed Generator,
Publisher. U každé: status, latency, queue size, items processed, errors, warnings, last update.

UI: 12 panelů, barevné stavy (ok/warn/error), latency/queue grafy. Realtime přes Supabase
realtime/SSE s throttlingem. Reuse existující pipeline state infrastrukturu.
Hotovo když: 12 panelů s metrikami, realtime bez reloadu, historie+barvy.
Aktualizuj HDUA-10-PIPELINE-MONITOR v plan.json + MISSIONS.md.
```

---

## HDUA-11 — HDUA Live Preview v HDCC

```
Na hlavní HDCC stránce postav split layout: vlevo 60% Pipeline Log (z HDUA-10), vpravo 40%
Live Mobile Preview — telefonní rám s web renderem reálného feedu (sdílené feed komponenty
nebo expo web build v iframe). Napoj na stejný realtime kanál jako monitor: nové příspěvky,
trendy a live aktualizace se objevují v reálném čase.
Hotovo když: 60/40 split, preview renderuje reálný feed z Content API, realtime sync.
Aktualizuj HDUA-11-LIVE-PREVIEW v plan.json + MISSIONS.md.
```

---

## HDUA-12 — User Analytics Dashboard

```
Postav analytics dashboard (v HDCC) nad signály z HDUA-09 (žádný druhý tracking SDK).
Server-side agregace: DAU, MAU, Retention, Session Length, Scroll Depth, Top Artists,
Top Countries, Top Categories, CTR, Engagement Rate. GDPR-safe anonymizované agregáty.
UI: karty + grafy 10 metrik, read-only.
Hotovo když: dashboard ukazuje 10 metrik, DAU/MAU/retention ze sessions, žebříčky a
engagement/CTR z interakcí. Aktualizuj HDUA-12-ANALYTICS v plan.json + MISSIONS.md.
```

---

## HDUA-13 — Dokumentace

```
Vygeneruj/konsoliduj dokumentaci do HDUA/docs/: HDUA_ARCHITECTURE.md (diagram
HDCC→Events→Content API→HDUA), HDUA_DATABASE.md, HDUA_FEED_ENGINE.md, HDUA_API.md
(kontrakt v1), HDUA_UI_SYSTEM.md (design tokeny, komponenty), HDUA_DEPLOYMENT.md
(EAS build, env, store submission, OTA updates). Každý doc odkaž z příslušné mise.
Pozn.: dokumentace je živá — každá mise při dokončení aktualizuje svůj doc; tato mise
zajišťuje kostru a finální konsolidaci. Aktualizuj HDUA-13-DOCS v plan.json + MISSIONS.md.
```
