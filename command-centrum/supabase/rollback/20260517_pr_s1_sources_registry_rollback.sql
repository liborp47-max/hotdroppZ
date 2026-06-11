-- ──────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: PR-S1 Sources Registry DB Migration
-- Reverts: 20260517000001_sources_registry.sql
--          20260517000002_sources_backfill.sql
--          20260517000003_sources_views_backwards_compat.sql
--          20260517000004_sources_triggers.sql
--
-- WARNING — this is NOT a forward migration. It lives outside supabase/migrations/
-- on purpose so it is never auto-applied. Run manually only:
--   node scripts/apply-sql.mjs supabase/rollback/20260517_pr_s1_sources_registry_rollback.sql
--
-- DATA LOSS: feed/artist rows created in `sources` AFTER the migration (e.g. RSS
-- feeds added via the scout_sources view) are dropped — they exist only in the
-- new tables. Original data is safe: `_legacy_scout_sources` retains every
-- pre-migration scout_sources row; `artists` / `artist_links` were never altered.
-- Take a backup of `sources` before running if post-migration rows matter.
--
-- Idempotent: guarded drops/renames — safe to re-run, safe if migration was
-- never (or only partially) applied.
-- ──────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Drop backwards-compat views (cascade removes their INSTEAD OF triggers).
--    scout_sources is dropped only if it is currently a VIEW — if the migration
--    was never applied it is still the original BASE TABLE and must be kept.
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'scout_sources'
  ) then
    drop view scout_sources cascade;
  end if;
end $$;

drop view if exists v_artists_legacy;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Restore the legacy table — rename _legacy_scout_sources back to scout_sources.
--    Only when the legacy table exists and the name is free (view already dropped).
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public'
          and table_name   = '_legacy_scout_sources'
          and table_type   = 'BASE TABLE'
     )
     and not exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'scout_sources'
     )
  then
    alter table _legacy_scout_sources rename to scout_sources;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Drop the registry tables (children before parent; cascade also removes
--    indexes, RLS policies, FKs and the _004 triggers attached to them).
-- ──────────────────────────────────────────────────────────────────────────────
drop table if exists source_history       cascade;
drop table if exists source_assignments   cascade;
drop table if exists platform_identifiers cascade;
drop table if exists source_handles       cascade;
drop table if exists sources              cascade;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Drop functions created by _003 / _004.
--    update_updated_at() is intentionally KEPT — it is a shared helper
--    (MASTER_SCHEMA.sql, used by posts_updated_at and other triggers).
--    pgcrypto extension is also kept — shared across the schema.
-- ──────────────────────────────────────────────────────────────────────────────
drop function if exists log_source_change()         cascade;
drop function if exists sync_to_source_handles()    cascade;
drop function if exists scout_sources_view_insert() cascade;
drop function if exists scout_sources_view_update() cascade;
drop function if exists scout_sources_view_delete() cascade;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verification (run manually on shadow DB):
--   select table_name, table_type from information_schema.tables
--     where table_name in ('scout_sources','_legacy_scout_sources','sources');
--     -- expect: scout_sources = BASE TABLE; _legacy_scout_sources / sources absent
--   select count(*) from scout_sources;          -- expect == pre-migration count
--   select to_regclass('public.source_handles'); -- expect NULL
--   select proname from pg_proc where proname in
--     ('log_source_change','sync_to_source_handles','scout_sources_view_insert');
--     -- expect 0 rows
--   select proname from pg_proc where proname = 'update_updated_at';
--     -- expect 1 row (helper preserved)
-- ──────────────────────────────────────────────────────────────────────────────
