# HDUA — Database

Shared Supabase project with HDCC (`cudycxvbpewmuhxydcas`). All HDUA user tables are
**`hdua_`-prefixed** for isolation (HDCC already owns `profiles` etc.). Canonical
source + apply instructions live in [`../database/README.md`](../database/README.md);
this doc is the reference overview.

## Migrations (order)

| # | File | Contents |
|---|------|----------|
| 01 | `database/01_profiles_settings.sql` | `hdua_profiles`, `hdua_settings`, `hdua_sessions`, `hdua_search_history` + auth trigger |
| 02 | `database/02_interactions.sql` | `hdua_saved_posts`, `hdua_liked_posts`, `hdua_comments`, `hdua_post_views` |
| 03 | `database/03_feed_items.sql` | **`hdua_feed_items` view** — the content contract |
| 04 | `database/04_trending_alerts_notifications.sql` | `hdua_trending_topics`, `hdua_alerts`, `hdua_notifications` |
| 05 | `database/05_feed_enrichment_join_and_bridge.sql` | view hardening + enrichment COALESCE + realtime trigger |

**Applied to live DB 2026-06-10** via Supabase MCP `apply_migration`. 11 `hdua_*`
tables + the view exist; RLS owner-only on all user tables.

## The content contract: `hdua_feed_items` (VIEW)

A read-only **projection** (not a copy) of pipeline output:

```
feed_posts                       → type track/album → 'release', video_release → 'video', event → 'event'
   ∪
posts WHERE status = 'published' → type 'article'
```

It COALESCEs enrichment so the feed reflects the latest pipeline state regardless of
denormalization timing: cover/artist/spotify/youtube/apple/genius fall back
`feed_posts → story_clusters → artists`. `security_invoker = on` so the view respects
the *caller's* RLS (anon/authenticated read on `feed_posts`/`posts`). Columns consumed
by the client: see `FEED_COLUMNS` in `src/api/content.ts`.

> Editorial articles only appear here once `posts.status = 'published'`. The HDCC
> auto-publish gate (mission HDUA-16) is what promotes high-quality drafts.

## Schema drift notes (contract verified against live schema)

The `.sql` files drifted from the live schema; the view/contract uses the live names:
`attention_score → score`, `published_at` (was missing), `language_detected → language`.
`country` is not yet in the pipeline → `null` (TODO: derive from source/language).
`post_id` in interaction tables is **not** a FK (content lives in re-projected pipeline
tables). `time_window` is used instead of reserved `window`.

## RLS

User tables are owner-only (`auth.uid() = user_id`). The content view is readable by
`anon` + `authenticated`. Verified clean by `get_advisors` (no RLS errors on HDUA).

## Re-apply (other environments)

```bash
node command-centrum/scripts/apply-sql.mjs \
  HDUA/database/01_profiles_settings.sql \
  HDUA/database/02_interactions.sql \
  HDUA/database/03_feed_items.sql \
  HDUA/database/04_trending_alerts_notifications.sql
# 05 hardening was applied via MCP; re-run its statements the same way.
```

Related: [HDUA_FEED_ENGINE.md](HDUA_FEED_ENGINE.md), [HDUA_API.md](HDUA_API.md).
