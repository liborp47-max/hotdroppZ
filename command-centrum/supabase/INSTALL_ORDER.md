# Supabase Migration Install Order

Run via Supabase MCP (`mcp__supabase__apply_migration`) or via:
```
node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/<file>.sql
```

## Phase 1 — Core Pipeline Tables

| Order | File | Purpose |
|-------|------|---------|
| 01 | `schema.sql` | Base extensions + helper functions |
| 02 | `MASTER_SCHEMA.sql` | Auth, roles, `scout_items`, `curated_items`, `posts`, `feed_posts` |
| 03 | `schema-scout.sql` | `scout_sources`, `scout_runs` |
| 04 | `schema-pipeline.sql` | `pipeline_runs` + status enums |
| 05 | `schema-translation.sql` | Translation columns on `scout_items` |
| 06 | `schema-cluster.sql` | `story_clusters`, `story_cluster_sources` |
| 07 | `schema-enrichment.sql` | Enrichment columns on `story_clusters` |
| 08 | `schema-writer-v2.sql` | `content_structured` + writer v2 columns on `posts` |
| 09 | `schema-multilang.sql` | `post_translations` table (v1) |
| 10 | `schema-multilang-v2.sql` | Multilang v2 improvements |

## Phase 2 — Feature Extensions

| Order | File | Purpose |
|-------|------|---------|
| 11 | `schema-editorial.sql` | `editorial_notes`, CMS workflow columns |
| 12 | `schema-monetizer.sql` | `post_monetization` table |
| 13 | `schema-ai-usage.sql` | AI usage tracking table |
| 14 | `schema-apple-music.sql` | Apple Music enrichment columns |
| 15 | `schema-droppz.sql` | `droppz_queue` base table |
| 16 | `schema-pipeline-upgrade.sql` | `pipeline_stage_runs` + analytics views |
| 17 | `schema-sources-update.sql` | Source metadata columns update |
| 18 | `schema-sources-fix.sql` | Source constraint fixes |

## Phase 3 — Artist Intelligence Layer

| Order | File | Purpose |
|-------|------|---------|
| 19 | `ARTIST_INTELLIGENCE.sql` | `artists`, `artist_releases`, `artist_sources` + RLS |
| 20 | `ARTIST_DATABASE_EXTENSION.sql` | Extended artist columns (aliases, city, tracking fields) |
| 21 | `ARTIST_BOOST_VIEWS.sql` | `artist_priority_view`, boost calculation views |
| 22 | `ARTIST_TRACKING_ANALYTICS.sql` | Tracking performance views |
| 23 | `ARTIST_HISTORY.sql` | Release history + label history columns |
| 24 | `TRACKING_ENGINE.sql` | `artist_links`, `artist_images` + RLS |

## Phase 4 — Integrations & Data

| Order | File | Purpose |
|-------|------|---------|
| 25 | `INTEGRATION.sql` | Cross-table foreign keys + integration indexes |
| 26 | `PIPELINE_EXTENSIONS.sql` | Pipeline analytics + stage health views |
| 27 | `SCOUT_INTEGRATION.sql` | Scout ↔ Artist matching + droppz injection |
| 28 | `IMAGE_MATCHING.sql` | Image scoring + license tracking columns |

## Phase 5 — Seeds

| Order | File | Purpose |
|-------|------|---------|
| 29 | `insert-all-rss-sources.sql` | Seed 50+ RSS sources for all markets |
| 30 | `seed_scout_sources.sql` | Additional scout sources seed |

## Notes

- All files use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — safe to re-run
- `schema-full-install.sql` bundles phases 1-2 for a fast single-shot base install
- RLS is enabled on all tables; service_role key bypasses it for pipeline writes
- After adding new artists tables, run `ARTIST_BOOST_VIEWS.sql` to refresh the view materialization
