-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260517000003_sources_views_backwards_compat
-- PR-S1 — Backwards-compat views (legacy queries beze změny)
-- Spec: SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/03-registry-schema.md
--
-- Scope (sub-mission #03):
--   1. RENAME scout_sources -> _legacy_scout_sources (preserved for rollback)
--   2. VIEW scout_sources over the new registry (sources + source_handles)
--   3. VIEW v_artists_legacy for legacy code reading the artists table
--
-- The legacy scout_sources was a read/write table (app code does insert/update/
-- delete — lib/actions/scout.ts, app/(dashboard)/sources/page.tsx). To honour
-- "legacy queries beze změny" the scout_sources view carries INSTEAD OF triggers
-- that redirect writes to sources + source_handles. Known residual: PostgREST
-- .upsert() (ON CONFLICT) is unsupported on a view with INSTEAD OF triggers —
-- scout.ts importDefaultSources() must be rewired in PR-S4.
--
-- Run order: _001 -> _002 -> _003. Idempotent: safe to re-run.
-- Requires PostgreSQL 15+ (security_invoker views).
-- ──────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Atomic switch — rename legacy table out of the way (only if still a table)
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name   = 'scout_sources'
      and table_type   = 'BASE TABLE'
  ) then
    alter table scout_sources rename to _legacy_scout_sources;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. scout_sources VIEW — legacy column set over the new registry
--    health domain mapped back: green->ok, red/amber->error, else unknown
-- ──────────────────────────────────────────────────────────────────────────────
create or replace view scout_sources
with (security_invoker = true) as
select
  s.id,
  s.name,
  coalesce(s.metadata->>'rss_url', sh.url)                  as url,
  s.category,
  s.language                                               as lang,
  (s.status = 'active')                                    as active,
  s.last_validated_at                                      as last_fetched_at,
  coalesce((s.metadata->>'total_items_found')::int, 0)     as total_items_found,
  case s.health
    when 'green' then 'ok'
    when 'red'   then 'error'
    when 'amber' then 'error'
    else 'unknown'
  end                                                      as health,
  s.metadata->>'error_message'                             as error_message,
  s.created_at
from sources s
left join source_handles sh on sh.source_id = s.id and sh.platform = 'rss'
where s.type = 'feed';

-- ── INSTEAD OF INSERT — redirect to sources (+ rss handle) ─────────────────────
create or replace function scout_sources_view_insert()
returns trigger language plpgsql as $$
declare
  v_id   uuid := coalesce(new.id, gen_random_uuid());
  v_slug text;
begin
  -- legacy enforced UNIQUE(url) — preserve that contract
  if new.url is not null and exists (
    select 1 from source_handles where platform = 'rss' and handle = new.url
  ) then
    raise exception 'duplicate key value violates unique constraint "scout_sources_url_key"'
      using errcode = 'unique_violation';
  end if;

  v_slug := btrim(lower(regexp_replace(
              coalesce(nullif(btrim(new.name), ''), v_id::text),
              '[^a-zA-Z0-9]+', '-', 'g')), '-');
  if exists (select 1 from sources where slug = v_slug) then
    v_slug := v_slug || '-' || left(v_id::text, 8);
  end if;

  insert into sources (
    id, type, name, slug, status, category, language,
    health, last_validated_at, metadata, created_at, updated_at
  )
  values (
    v_id, 'feed', new.name, v_slug,
    case when coalesce(new.active, true) then 'active' else 'archived' end,
    new.category, new.lang,
    case lower(coalesce(new.health, 'unknown'))
      when 'ok' then 'green' when 'error' then 'red' else 'unknown' end,
    new.last_fetched_at,
    jsonb_build_object(
      'rss_url',           new.url,
      'total_items_found', coalesce(new.total_items_found, 0),
      'error_message',     new.error_message,
      'legacy_table',      'scout_sources'
    ),
    coalesce(new.created_at, now()), now()
  );

  if new.url is not null then
    insert into source_handles (source_id, platform, handle, url, verified, verified_by)
    values (v_id, 'rss', new.url, new.url, true, 'crawler');
  end if;

  new.id := v_id;
  return new;
end;
$$;

-- ── INSTEAD OF UPDATE — apply changes back to sources / source_handles ─────────
create or replace function scout_sources_view_update()
returns trigger language plpgsql as $$
begin
  update sources s set
    name              = new.name,
    category          = new.category,
    language          = new.lang,
    status            = case when coalesce(new.active, true) then 'active' else 'archived' end,
    health            = case lower(coalesce(new.health, 'unknown'))
                           when 'ok' then 'green' when 'error' then 'red' else 'unknown' end,
    last_validated_at = new.last_fetched_at,
    metadata          = s.metadata || jsonb_build_object(
                          'rss_url',           new.url,
                          'total_items_found', coalesce(new.total_items_found, 0),
                          'error_message',     new.error_message
                        ),
    updated_at        = now()
  where s.id = old.id and s.type = 'feed';

  if new.url is distinct from old.url then
    update source_handles
       set handle = new.url, url = new.url
     where source_id = old.id and platform = 'rss';
  end if;

  return new;
end;
$$;

-- ── INSTEAD OF DELETE — drop the source (source_handles cascade) ───────────────
create or replace function scout_sources_view_delete()
returns trigger language plpgsql as $$
begin
  delete from sources where id = old.id and type = 'feed';
  return old;
end;
$$;

drop trigger if exists scout_sources_instead_insert on scout_sources;
create trigger scout_sources_instead_insert instead of insert on scout_sources
  for each row execute function scout_sources_view_insert();

drop trigger if exists scout_sources_instead_update on scout_sources;
create trigger scout_sources_instead_update instead of update on scout_sources
  for each row execute function scout_sources_view_update();

drop trigger if exists scout_sources_instead_delete on scout_sources;
create trigger scout_sources_instead_delete instead of delete on scout_sources
  for each row execute function scout_sources_view_delete();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. v_artists_legacy VIEW — read-only artist projection over the registry
--    (the artists table is kept as-is; this view is additive)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace view v_artists_legacy
with (security_invoker = true) as
select
  s.id,
  s.name,
  s.slug                                            as normalized_name,
  s.metadata->>'country'                            as country,
  s.metadata->>'genre'                              as genre,
  (s.metadata->>'base_score')::numeric              as base_score,
  s.metadata->>'priority_level'                     as priority_level,
  (s.metadata->>'is_tracking_active')::boolean      as is_tracking_active,
  (select sh.url from source_handles sh
     where sh.source_id = s.id and sh.platform = 'spotify_artists' limit 1) as spotify_url,
  (select sh.url from source_handles sh
     where sh.source_id = s.id and sh.platform = 'youtube' limit 1)         as youtube_url,
  s.tags,
  s.metadata,
  s.created_at,
  s.updated_at
from sources s
where s.type = 'artist';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Grants — match legacy accessibility (RLS on sources stays the real gate)
-- ──────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on scout_sources    to authenticated, service_role;
grant select                         on v_artists_legacy to authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verification (run manually on shadow DB — sub-mission #05):
--   select count(*) from _legacy_scout_sources;          -- legacy snapshot
--   select count(*) from scout_sources;                  -- expect == above
--   select * from scout_sources order by category limit 5;
--   insert into scout_sources (name,url,category,lang,active)
--     values ('t','https://t.test/rss','rap_core','en',true);   -- INSTEAD OF insert
--   update scout_sources set active = false where url = 'https://t.test/rss';
--   delete from scout_sources where url = 'https://t.test/rss';
--   select count(*) from v_artists_legacy;               -- expect == artists
-- ──────────────────────────────────────────────────────────────────────────────
