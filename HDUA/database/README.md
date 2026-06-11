# HDUA — Database layer (HDUA-01)

Sdílený Supabase projekt s HDCC (`cudycxvbpewmuhxydcas`). Všechny HDUA uživatelské
tabulky mají prefix **`hdua_`**, protože HDCC už vlastní `profiles` a další názvy —
prefix = izolace bez kolizí.

## Migrace (pořadí)

| # | Soubor | Obsah |
|---|--------|-------|
| 01 | `01_profiles_settings.sql` | `hdua_profiles`, `hdua_settings`, `hdua_sessions`, `hdua_search_history` + auth trigger |
| 02 | `02_interactions.sql` | `hdua_saved_posts`, `hdua_liked_posts`, `hdua_comments`, `hdua_post_views` |
| 03 | `03_feed_items.sql` | `hdua_feed_items` **view** — content contract (projekce feed_posts + published posts) |
| 04 | `04_trending_alerts_notifications.sql` | `hdua_trending_topics`, `hdua_alerts`, `hdua_notifications` |
| 05 | *(hardening, applied via MCP)* | `security_invoker` na view, `search_path` na trigger fn, revoke RPC |

## Stav: APLIKOVÁNO ✅ (2026-06-10)

Aplikováno do živého Supabase přes MCP `apply_migration`. Ověřeno:
- 11 `hdua_*` tabulek + view `hdua_feed_items` existují.
- `hdua_feed_items` vrací 17 řádků (reálná pipeline data).
- RLS zapnuté na všech user tabulkách (owner-only); `get_advisors` bez RLS chyb na HDUA.

## Re-aplikace / jiné prostředí

```bash
# přes HDCC apply-sql (potřebuje SUPABASE_DB_URL nebo service role)
node command-centrum/scripts/apply-sql.mjs \
  HDUA/database/01_profiles_settings.sql \
  HDUA/database/02_interactions.sql \
  HDUA/database/03_feed_items.sql \
  HDUA/database/04_trending_alerts_notifications.sql
```

## Klíčová rozhodnutí

- **Obsah se neduplikuje.** `hdua_feed_items` je read-only VIEW (projekce), ne kopie.
  `security_invoker = on` → respektuje RLS volajícího (feed_posts/posts mají
  authenticated-read).
- **Kontrakt ověřen proti živému schématu**, které driftovalo od `.sql` souborů:
  `scout_items.attention_score` → `score`, `scout_items.published_at` → `published_at`,
  `language_detected` → `language`. `feed_posts.type` mapováno na contract type
  (`track/album`→`release`, `video_release`→`video`, `event`→`event`), `posts`→`article`.
- **`country` zatím není** v pipeline → `null` (TODO: odvodit ze zdroje/jazyka v pozdější misi).
- `post_id` v interakcích není FK (obsah žije v pipeline tabulkách, které se re-projektují).
- `time_window` místo `window` (rezervované slovo).
