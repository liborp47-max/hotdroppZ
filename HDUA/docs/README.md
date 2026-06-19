# HDUA — Documentation (HDUA-13)

Living documentation for **HDUA** (HotDroppZ User App) — the native Expo client
that consumes the HDCC content pipeline. Keep these updated alongside missions.

## Documents

| Doc | Scope |
|-----|-------|
| [HDUA_ARCHITECTURE.md](HDUA_ARCHITECTURE.md) | System shape, data flow HDCC → Content API → HDUA, tech stack |
| [HDUA_DATABASE.md](HDUA_DATABASE.md) | Supabase schema (`hdua_*` tables + `hdua_feed_items` view), RLS |
| [HDUA_FEED_ENGINE.md](HDUA_FEED_ENGINE.md) | How the feed is fetched, mapped, ranked, paginated, kept live |
| [HDUA_API.md](HDUA_API.md) | Content API v1 contract (client function surface) |
| [HDUA_UI_SYSTEM.md](HDUA_UI_SYSTEM.md) | Venom design tokens, components, navigation, scrollbar |
| [HDUA_DEPLOYMENT.md](HDUA_DEPLOYMENT.md) | Env, EAS build, store submission, OTA |

## Architecture diagram

```
┌──────────────────────────── HDCC (command-centrum) ────────────────────────────┐
│  Scout → Filter → Curator → Cluster → Enrichment → Writer → Publish → Feed       │
│  writes: scout_items · story_clusters · posts(status=published) · feed_posts     │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │  (shared Supabase project cudycxvbpewmuhxydcas)
                          ┌──────────────▼───────────────┐
                          │   hdua_feed_items  (VIEW)      │   ← single content contract
                          │   feed_posts ∪ published posts │      (security_invoker = on, RLS)
                          └──────────────┬───────────────┘
                                         │  PostgREST + anon JWT (RLS) │ realtime topic `hdua:feed`
                          ┌──────────────▼───────────────┐
                          │  Content API v1 (src/api/*)   │   ← client fn surface == the contract
                          │  getFeed/Trending/Recommended  │      (later: NestJS host, same sigs)
                          │  getPost / search / searchArtists│
                          └──────────────┬───────────────┘
                                         │  @tanstack/react-query (useFeed/usePost/useFeedRealtime)
                          ┌──────────────▼───────────────┐
                          │   HDUA (Expo Router app)      │   tabs: Home/Search/Create/Alerts/Profile
                          │   FeedPager · post/[id] reader │   + persistent GlobalScrollbar
                          └───────────────────────────────┘
```

See [HDUA_ARCHITECTURE.md](HDUA_ARCHITECTURE.md) for the narrative version.
