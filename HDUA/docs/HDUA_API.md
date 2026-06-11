# HDUA_API — Content API v1

Stav: **MVP klientská vrstva hotová** (HDUA-02). Backed přímo Supabase PostgREST +
view `hdua_feed_items` (HDUA-01). Funkce v `src/api/` JSOU kontrakt v1 — dedikovaný
server-tier (NestJS) může později sednout za stejné signatury bez změny volajících.

## Architektura

```
HDCC pipeline ──(feed_posts / posts)──► hdua_feed_items (view, RLS security_invoker)
                                              │
                          Supabase PostgREST + JWT (anon key + user session)
                                              │
                         src/api/content.ts + user.ts  (v1 contract)
                                              │
                         src/hooks/useFeed.ts (TanStack infinite query)
                                              ▼
                                        HDUA (Expo)
```

## Endpointy (klientské funkce)

| Kontrakt | Funkce | Zdroj | Stránkování |
|----------|--------|-------|-------------|
| `GET /feed` | `getFeed(q)` | `hdua_feed_items` order published_at desc | cursor (`publishedAt`) |
| `GET /feed/latest` | `getLatest` | = getFeed | cursor |
| `GET /feed/trending` | `getTrending(q)` | order score desc | — |
| `GET /feed/recommended` | `getRecommended(q)` | fallback → trending (HDUA-09 nahradí) | — |
| `GET /post/:id` | `getPost(id)` | view + related (stejná kategorie) | — |
| `GET /search` | `search(term)` | ilike title | limit |
| `GET /search/artists` | `searchArtists(term)` | distinct artist | limit |
| `GET /alerts` | `getAlerts()` | `hdua_alerts` | limit |
| `GET /notifications` | `getNotifications()` | `hdua_notifications` (RLS) | limit |
| `GET /profile` | `getProfile()` | `hdua_profiles` (RLS owner) | — |
| `GET /settings` | `getSettings()` | `hdua_settings` (RLS owner) | — |
| akce | `toggleLike/toggleSave` | `hdua_liked/saved_posts` (optimistic) | — |

## Cursor pagination

`getFeed` řadí `published_at desc`; `nextCursor` = `publishedAt` posledního prvku.
Další stránka: `published_at < cursor`. `nextCursor=null` když došla data.
(Tie-break na `id` doplní server-tier; pro MVP dostačuje.)

## FeedItem kontrakt

Viz `src/types/index.ts`. Mapování row→kontrakt v `src/api/mappers.ts`
(snake_case → camelCase, `extra` jsonb → source pills).

## Auth model

- **User data** (profile, settings, likes, saves, notifications): RLS owner-only,
  vyžaduje přihlášení (Supabase JWT).
- **Feed/obsah**: aktuálně `authenticated`-read (view security_invoker nad
  feed_posts/posts s `auth_all` policy). Login gate v HDUA-03.

## Realtime bridge (HDCC → HDUA) — hotovo 2026-06-11

`feed_posts` INSERT (pipeline feed-builder) → trigger `hdua_broadcast_new_feed_item`
→ `realtime.send(... , 'new_feed_item', 'hdua:feed', false)` na **veřejný** topic.
Klient `useFeedRealtime` odebírá `hdua:feed` (anon, bez oslabení RLS — raw tabulky
zůstávají skryté, obsah jen přes view) a ukazuje „X nových" pill → invalidace feedu.

## Enrichment join (view) — hotovo 2026-06-11

`hdua_feed_items` COALESCEuje enrichment z `feed_posts → story_clusters → artists`
(artist, cover, country, spotify/youtube/apple/genius). Feed tak reflektuje nejnovější
pipeline enrichment bez ohledu na časování denormalizace. Migrace:
`database/05_feed_enrichment_join_and_bridge.sql`.

## Otevřená rozhodnutí (follow-up)

1. **Veřejný (anon) feed** bez loginu: ✅ vyřešeno přes SECURITY DEFINER view
   `hdua_feed_items` (anon grant); raw `scout_items`/`posts`/`feed_posts` zůstávají
   anon nepřístupné.
2. **Server-tier (NestJS)**: rate limiting, ETag/cache, OpenAPI. Realtime invalidace
   už řešena DB broadcast bridgem (výše) — server-tier ji může převzít beze změny klienta.
3. **`country`**: view ho teď bere z `artists.country` přes `artist_id`. Naplní se,
   až enrichment přiřadí `artist_id` (teď řídké).
4. **Editorial `posts`**: do feedu vstupují jen `status='published'` (teď 0) — publikace
   je editorský krok v HDCC, ne auto-flip.
