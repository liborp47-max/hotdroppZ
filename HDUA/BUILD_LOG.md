# HDUA — Build Log

Chronologický záznam reálně provedených změn (zdroj pravdy = `NOTES/plan.json` mise).

## 2026-06-12

### HDUA-14 — Auth gate (Supabase) ✅ MISSION_DONE
- **Pre-check (hard-stop detekce):** ověřeny signup triggery na `auth.users`. Dva:
  `hdua_handle_new_user` (→ `hdua_profiles` + `hdua_settings`, `on conflict do nothing`,
  `search_path` set) i HDCC `handle_new_user` (→ `profiles`) jsou schématem v pořádku →
  **žádný blocker**, signup vznik profilu funguje. Anon klíč + URL v `.env.local` nastaveny.
- **Auth store** `stores/auth.ts` (Zustand): `status` (loading|authed|guest), `session`,
  `user`; `init()` idempotentně seedne z perzistované session + odebírá `onAuthStateChange`.
  Akce: `signInWithPassword`, `signUp` (vrací `needsConfirmation` když je zapnutý e-mail
  confirm), `signInWithGoogle` (OAuth), `signOut`. `display_name` se posílá do
  `raw_user_meta_data` (čte ho trigger).
- **lib/supabase.ts:** `detectSessionInUrl` zapnuto jen na webu → OAuth callback se parsuje
  z URL fragmentu (native má vlastní deep-link flow).
- **AuthProvider** (root) bootne auth jednou + synchronizuje per-user interakční cache:
  hydrate na přihlášení, reset na odhlášení. Feed zůstává veřejně čitelný i bez loginu.
- **RequireAuth** gate komponenta (venom): loading spinner / sign-in prompt → `/auth` modal.
- **Auth screen** `app/auth.tsx` (modal): segment Přihlásit/Registrovat, e-mail+heslo,
  jméno (nepovinné), Google OAuth, error/notice stavy, venom styl. Po vzniku session se
  modal sám zavře.
- **Profil** přepsán: za `RequireAuth`, reálná data (`getProfile`/`getSettings`), staty
  Líbí/Uloženo/Sleduji, řádky nastavení, **Odhlásit se**.
- **Like/Save napojeno na DB:** nový `stores/userInteractions.ts` (optimistic + rollback)
  zapisuje do RLS `hdua_liked_posts` / `hdua_saved_posts`; `FeedCard` čte stav z něj,
  hosty posílá na `/auth`. Přidána akce „Uložit" (bookmark), odebrán placeholder „Boost".
  Nová `api/user.getMyInteractions()` hydratuje liked+saved id naráz.
- **Ověřeno:** `tsc --noEmit` čistý; `expo lint` 0 errors (4 warnings, pre-existing v cizích
  souborech; unused `AudioPreview` import ve FeedCard odstraněn). Router typy přegenerovány
  (typedRoutes) → `/auth` v `.expo/types/router.d.ts`.
- **Pozn. pro CEO:** Google OAuth vyžaduje zapnutí Google providera v Supabase Auth
  (Dashboard → Authentication → Providers) + redirect URL = origin webu; bez toho tlačítko
  vrátí chybu. E-mail/heslo funguje hned.

## 2026-06-11

### HDUA-02 sub05 — HDCC ↔ HDUA propojení (enrichment + realtime bridge) ✅
- **Problém 1 — enrichment netekl do feedu.** `hdua_feed_items` četl artist/cover/
  spotify/… jen z denormalizovaných sloupců `feed_posts` (často stale/prázdné).
  Reálný enrichment je na `story_clusters` (+ country na `artists`). View přepsán
  na `COALESCE(feed_posts → story_clusters → artists)` přes `cluster_id`/`artist_id`.
  **Efekt:** `apple_music_url` ve feedu 0 → 17, category 17/17; artist/spotify/cover
  potečou automaticky, jakmile enrichment doběhne (teď řídké — chybí API klíče).
  Zachován SECURITY DEFINER + grant anon (HDUA-02 model).
- **Backfill:** 17 stale `feed_posts` doplněno z jejich clusteru (jen NULL pole) —
  konzistence i pro HDCC konzumenty feed_posts.
- **Problém 2 — žádný realtime HDCC→HDUA.** Trigger `hdua_feed_posts_broadcast`
  na `feed_posts` INSERT → `realtime.send(...)` na **veřejný** topic `hdua:feed`
  (anon smí odebírat, RLS raw tabulky se neoslabuje; obsah dál jen přes view).
- **Klient:** `src/hooks/useFeedRealtime.ts` (subscribe broadcast `hdua:feed` →
  počítadlo nových), napojeno do `FeedList` jako „X nových příspěvků" pill (jen
  `latest`), tap → invalidace feed query. Migrace ve `database/05_feed_enrichment_join_and_bridge.sql`.
- **Ověřeno:** `tsc --noEmit` čistý; view counts (apple 17); trigger enabled;
  `realtime.send` proběhla bez chyby.

## 2026-06-10

### HDUA-00 — Scaffold ✅ MISSION_DONE
- Založen Expo (RN, SDK 52) projekt v `SYSTEM/hotdroppz/HDUA` s Expo Router, TanStack
  Query, Zustand, FlashList, Reanimated, Supabase, expo-image/av.
- Struktura `src/{app,feed,posts,...}`, design system (`src/styles/theme.ts`, dark +
  neon-green), sdílené typy (`src/types`), 5-tab navigace, post detail route.
- `lounchapp/` → `ZALOHA/legacy-lounchapp/` (archiv).
- **Ověřeno:** `npx expo start --web` → HTTP 200, `<title>HotDroppZ</title>`, 1134 modulů,
  `tsc --noEmit` čistý.

### HDUA-01 — Database ✅ MISSION_DONE — APLIKOVÁNO DO ŽIVÉ DB
- Migrace přes Supabase MCP `apply_migration` (projekt `cudycxvbpewmuhxydcas`):
  - `hdua_profiles, hdua_settings, hdua_sessions, hdua_search_history` (+ auth trigger)
  - `hdua_saved_posts, hdua_liked_posts, hdua_comments, hdua_post_views`
  - `hdua_feed_items` VIEW (projekce feed_posts + published posts)
  - `hdua_trending_topics, hdua_alerts, hdua_notifications`
- RLS owner-only na všech user tabulkách; security hardening (pinned search_path, revoke RPC).
- **Ověřeno:** 11 tabulek + view existují; view vrací 17 reálných řádků; advisors bez RLS chyb na HDUA.

### HDUA-02 — Content API v1 ⏳ MVP (server-tier odložen)
- Klientská v1 vrstva: `src/api/content.ts` (feed/latest/trending/recommended/post/search),
  `src/api/user.ts` (alerts/notifications/profile/settings + like/save), `src/api/mappers.ts`,
  `src/hooks/useFeed.ts` (infinite cursor query). Doc: `docs/HDUA_API.md`.
- **Veřejná feed projekce:** `hdua_feed_items` → SECURITY DEFINER + `grant select to anon`
  (kurátorský public read; raw `scout_items`/`posts` zůstávají anon nepřístupné). Záměrné.
- **Ověřeno:** anon klíč přes PostgREST → HTTP 200, 17 položek. `tsc` čistý.
- **Odloženo (follow-up):** sub-05 HDCC realtime bridge, sub-06 CORS/cache/rate-limit (server-tier NestJS).

---

### HDUA-06 — Feed Card ✅ MISSION_DONE
- `src/components/cards/FeedCard.tsx` dle mockupů: cover + NEW DROP badge + play overlay,
  header (artist/kategorie/čas), titulek + preview, tagy, live signals (+%, #trending, now),
  action bar (like/add/comment/share/boost s optimistic like + haptika), source pills
  (Spotify/Apple/YouTube), type-aware. `src/utils/text.ts` (decode HTML entit, timeAgo, compact).
- Refinement (sub04, todo): plné per-type layouty (quote/fun_fact/drop-post hero), AI-take blok.

### HDUA-05 — Feed Engine ✅ MISSION_DONE
- `src/feed/FeedList.tsx`: FlashList virtualizovaný nekonečný feed, cursor pagination
  (useInfiniteQuery), getItemType recyklace, pull-to-refresh, optimistic like,
  loading/error/empty stavy. Home (`(tabs)/index.tsx`) napojen: brand header + segment
  Latest/Trending/For You.
- Fix: doinstalován `@opentelemetry/api` (Metro neuměl resolvnout z supabase-js).
- **Ověřeno:** typecheck čistý; `expo --web` Web Bundled 1329 modulů bez chyb; servíruje 200;
  data layer vrací 17 reálných položek. Realtime new-posts (sub04) čeká na Content API bridge.

### HDUA-07 — Post Detail + continuous reader ✅ MISSION_DONE
- `src/app/post/[id].tsx`: otevře post → plný `PostView` → scroll plynule navazuje další
  posty inline (FlashList infinite, `DALŠÍ` oddělovač) → back drží feed pozici. Floating back.
- `src/components/post/PostView.tsx` (cover, meta, titulek, body, source tlačítka, audio),
  `src/components/media/AudioPreview.tsx` (expo-av preview, HDUA-04 seed), `usePost` hook.
- Shared-element expand transition (sub01) = refinement (teď stack fade).
- **Ověřeno:** typecheck čistý, web bundle 8.5 MB bez chyb.

### HDUA-03 — App shell + nav 🔶 (funkční, auth pending)
- 5-tab shell hotový (HDUA-00). Zfunkčněny taby s reálnými daty:
  Home (feed), Search (`src/app/(tabs)/search.tsx`, full-text), Alerts
  (`src/app/(tabs)/alerts.tsx`, radar). Auth gate / login (sub03) = todo.

### Full-screen feed + Share (CEO UX požadavky) ✅
- **Full-bleed posty:** FeedCard přepsán na edge-to-edge (hero ~50 % výšky obrazovky,
  overlay titulek/artist/tagy, scrim), žádná ohraničená "okna" (border/radius/margin pryč),
  posty oddělené tenkým dividerem. FeedList bez horizontálního paddingu.
- **Instant open (žádné loadingy):** `stores/feedCache.ts` (Zustand) drží feed itemy podle id;
  `usePost` je bere jako `placeholderData` → detail se vykreslí okamžitě, plný obsah dotéká na pozadí.
- **Continuous reader:** detail full-screen přes taby; scroll plynule navazuje další posty.
- **Sdílení:** `stores/shareSheet.ts` + `components/share/ShareSheet.tsx` (bottom modal,
  9 platforem + náhled captionu), `lib/share.ts` (web intent / native share sheet / clipboard).
  Share tlačítko na kartě i v detailu.
- **Spodní menu fix:** tab bar drží dole (scroll běží uvnitř seznamů díky web height-fixu).
- **Agenti:** `content/share-templates.ts` (marketing — copy/hashtags/UTM per platforma),
  `assets/share-card-template.svg` + README (graphic — 1080×1080 branded share card s {{tokeny}}).
- **Ověřeno:** typecheck čistý, web bundle 8.6 MB bez chyb.

### HDUA-09 — Personalizace ✅ MISSION_DONE
- `lib/analytics.ts`: batchovaný signal tracker (view/dwell/scroll) → `hdua_post_views`
  (anon insert ověřen 201), flush na visibilitychange, GDPR opt-out flag. Dwell se měří
  v FeedCard po dobu rozbalení článku.
- Recommended přes RPC `hdua_recommended_feed` (engagement×2 + score, pak recency) —
  aplikováno do živé DB; `getRecommended` ho volá (fallback na trending).

### HDUA-04 — Media ✅ MISSION_DONE
- `lib/embeds.ts` (Spotify/YouTube URL → embed), `components/media/Embed.web.tsx` (reálný
  iframe přehrávač na webu) + `Embed.tsx` (nativní link fallback). Napojeno do rozbaleného
  článku. expo-image cover + AudioPreview už dříve.
- Pozn.: embedy/source-pills se rozsvítí, až enrichment naplní spotify/youtube URL (teď 0/17).

### Accordion feed (CEO UX) ✅
- FeedCard přepsán z navigace na **inline rozbalení**: klik → článek se vyroluje dolů
  (Reanimated FadeInDown + LinearTransition), accordion jeden naráz (`stores/feedExpand.ts`,
  recycle-safe), „Číst víc/Sbalit". Žádné loadingy, žádné přechody.

### Produkční dopady (k vědomí)
- Do živé Supabase DB přidáno 11 `hdua_` tabulek + 1 view (aditivní, vratné: `drop`).
- Feed je nově **veřejně čitelný** přes view `hdua_feed_items` (anon). Reverze:
  `alter view hdua_feed_items set (security_invoker = on); revoke select ... from anon;`
- `HDUA/.env.local` obsahuje veřejný anon klíč (bezpečné, gitignored).
