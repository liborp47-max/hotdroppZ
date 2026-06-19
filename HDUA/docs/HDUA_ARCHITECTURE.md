# HDUA — Architecture

> HotDroppZ User App: the native, public-facing client for the content the HDCC
> pipeline produces. Read-only over the pipeline's output; owns only per-user
> state (profile, settings, saves, likes, history, notifications).

## Tech stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Runtime | **Expo** (SDK 52, New Architecture on) | `app.json` · `newArchEnabled: true` |
| Routing | **expo-router 4** (typed routes) | file-based, `src/app/**` |
| Data fetching | **@tanstack/react-query 5** | `src/hooks/useFeed.ts`, `usePost.ts` |
| Backend client | **@supabase/supabase-js 2** | anon key only — `src/lib/supabase.ts` |
| Lists | **@shopify/flash-list** | feed pager + reader |
| Animation | **react-native-reanimated 3** | parallax, the global scrollbar |
| Local state | **zustand 5** | `src/stores/**` (feed expand, scrollbar) |
| Media | **expo-av** | audio/preview (player mission HDUA-08) |

## Data flow (HDCC → HDUA)

1. **HDCC pipeline** (separate app, `command-centrum/`) scouts, clusters, enriches,
   writes articles, and builds feed cards. Output lands in Supabase tables
   `scout_items`, `story_clusters`, `posts` (status `published`), `feed_posts`.
   See `command-centrum/CLAUDE.md` for the pipeline stages.
2. **`hdua_feed_items` view** projects `feed_posts ∪ posts(status='published')` into
   one stable content contract, COALESCE-ing enrichment from `story_clusters`.
   This is the *only* surface HDUA reads for content — content is never duplicated.
   See [HDUA_DATABASE.md](HDUA_DATABASE.md).
3. **Content API v1** (`src/api/content.ts`) is, for the MVP, a thin typed wrapper
   over Supabase PostgREST against that view. The function signatures **are** the
   v1 contract — a later dedicated host (NestJS) can sit behind the same signatures
   for rate-limiting/caching/the HDCC event bridge without touching callers.
   See [HDUA_API.md](HDUA_API.md).
4. **React Query hooks** (`useFeed`, `usePost`, `useFeedRealtime`) cache + paginate
   + subscribe to the realtime topic `hdua:feed` (broadcast by an HDCC trigger on
   `feed_posts` insert) so new drops appear without a manual refresh.
5. **Screens** render the data. See [HDUA_UI_SYSTEM.md](HDUA_UI_SYSTEM.md).

## App structure (`src/`)

```
app/            expo-router routes
  _layout.tsx        root: providers (React Query, SafeArea, GestureHandler), GlobalScrollbar
  (tabs)/            Home(index) · Search · Create · Alerts · Profile + _layout (tab bar)
  post/[id].tsx      continuous reader (HDUA-07): opens a post, streams the rest inline
  auth.tsx           sign-in gate
api/            content.ts (feed/post/search) · mappers.ts (DB row → domain) · user.ts
components/     auth · brand · cards · media · post · share · shared
feed/           FeedPager · FeedPage · FeedList (the vertical pager surface)
hooks/          useFeed · usePost · useFeedRealtime
stores/         zustand: feedExpand, scrollbarShared
lib/            supabase client, share, utils
styles/         theme.ts (design tokens) · global.css (web)
types/          shared domain types (FeedItem, Post, Artist, Paginated, …)
```

## Boundaries / decisions

- **HDUA never writes pipeline content.** It reads `hdua_feed_items` and writes only
  `hdua_*` user tables (RLS owner-only).
- **Anon key only** in the client; the service role stays server-side in HDCC.
- **Shared Supabase project** with HDCC (`cudycxvbpewmuhxydcas`); HDUA tables are
  `hdua_`-prefixed to avoid name collisions.

Related missions: HDUA-01 (DB), HDUA-02 (Content API + bridge), HDUA-06 (pager),
HDUA-07 (reader), HDUA-09 (recommended), HDUA-14 (auth gate).
