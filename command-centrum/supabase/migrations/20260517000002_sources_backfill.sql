-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260517000002_sources_backfill
-- PR-S1 — Sources Registry backfill (legacy tables -> canonical registry)
-- Spec: SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/06-migration-plan.md
--
-- Scope (sub-mission #02):
--   scout_sources -> sources (type='feed') + source_handles (platform='rss')
--   artists       -> sources (type='artist')
--   artist_links  -> source_handles + platform_identifiers
-- Out of scope: artist_releases -> platform_identifiers (separate); views (_003).
--
-- UUID identity preserved: sources.id = legacy scout_sources.id / artists.id.
-- Idempotent: every insert uses ON CONFLICT DO NOTHING — safe to re-run.
-- Depends on: 20260517000001_sources_registry.sql (tables must exist).
-- ──────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. scout_sources -> sources (type='feed')
--    slug derived from name, de-duplicated via row_number to keep it UNIQUE.
--    health enum/text ('ok','error','unknown') mapped to registry health domain.
-- ──────────────────────────────────────────────────────────────────────────────
with feed_base as (
  select
    s.*,
    lower(regexp_replace(coalesce(nullif(btrim(s.name), ''), s.id::text),
                         '[^a-zA-Z0-9]+', '-', 'g')) as base_slug
  from scout_sources s
),
feed_ranked as (
  select
    fb.*,
    row_number() over (partition by base_slug order by created_at nulls last, id) as rn
  from feed_base fb
)
insert into sources (
  id, type, name, slug, status, category, region, language,
  authority_score, health, last_validated_at, metadata, created_at, updated_at
)
select
  id,
  'feed',
  name,
  btrim(base_slug || case when rn = 1 then '' else '-' || rn::text end, '-'),
  case when active then 'active' else 'archived' end,
  category::text,
  null,
  lang,
  50,
  case lower(health::text)
    when 'ok'    then 'green'
    when 'error' then 'red'
    else 'unknown'
  end,
  last_fetched_at,
  jsonb_build_object(
    'rss_url',           url,
    'total_items_found', coalesce(total_items_found, 0),
    'error_message',     error_message,
    'legacy_table',      'scout_sources'
  ),
  coalesce(created_at, now()),
  coalesce(created_at, now())
from feed_ranked
on conflict do nothing;

-- scout_sources -> source_handles (platform='rss'); url is UNIQUE in scout_sources
insert into source_handles (
  source_id, platform, handle, url, verified, verified_at, verified_by, created_at
)
select
  s.id, 'rss', s.url, s.url, true, s.last_fetched_at, 'crawler', coalesce(s.created_at, now())
from scout_sources s
where exists (select 1 from sources t where t.id = s.id and t.type = 'feed')
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. artists -> sources (type='artist'); slug = normalized_name (already UNIQUE)
-- ──────────────────────────────────────────────────────────────────────────────
insert into sources (
  id, type, name, slug, status, category, region, language,
  authority_score, health, last_validated_at, metadata, tags, created_at, updated_at
)
select
  a.id,
  'artist',
  a.name,
  a.normalized_name,
  case when a.is_active then 'active' else 'archived' end,
  a.genre,
  a.country,
  null,
  least(100, greatest(0, round(coalesce(a.base_score, 50))::int)),
  'unknown',
  a.ai_fetched_at,
  jsonb_build_object(
    'country',            a.country,
    'genre',              a.genre,
    'base_score',         a.base_score,
    'priority_level',     a.priority_level,
    'is_tracking_active', coalesce(a.tracking_enabled, a.is_active),
    'ai_confidence',      a.ai_confidence,
    'trending_boost',     a.trending_boost,
    'boost_multiplier',   a.boost_multiplier,
    'legacy_table',       'artists'
  ),
  a.tags,
  a.created_at,
  a.updated_at
from artists a
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. artist_links -> source_handles (one handle row per populated platform)
--    handle = canonical platform id, falling back to url when no id column.
--    ON CONFLICT DO NOTHING absorbs duplicate (platform, handle) pairs.
-- ──────────────────────────────────────────────────────────────────────────────
insert into source_handles (
  source_id, platform, handle, url, verified, verified_at, verified_by, created_at
)
select
  h.source_id, h.platform, h.handle, h.url, h.verified,
  case when h.verified then h.last_enriched_at end,
  case when h.verified then 'enrichment' end,
  coalesce(h.created_at, now())
from (
  select artist_id as source_id, 'spotify_artists' as platform,
         coalesce(spotify_id, spotify_url) as handle, spotify_url as url,
         spotify_verified as verified, last_enriched_at, created_at
  from artist_links where coalesce(spotify_id, spotify_url) is not null
  union all
  select artist_id, 'apple_music', coalesce(apple_music_id, apple_music_url), apple_music_url,
         apple_verified, last_enriched_at, created_at
  from artist_links where coalesce(apple_music_id, apple_music_url) is not null
  union all
  select artist_id, 'youtube', coalesce(youtube_channel_id, youtube_url), youtube_url,
         youtube_verified, last_enriched_at, created_at
  from artist_links where coalesce(youtube_channel_id, youtube_url) is not null
  union all
  select artist_id, 'instagram', coalesce(instagram_handle, instagram_url), instagram_url,
         instagram_verified, last_enriched_at, created_at
  from artist_links where coalesce(instagram_handle, instagram_url) is not null
  union all
  select artist_id, 'tiktok', coalesce(tiktok_handle, tiktok_url), tiktok_url,
         tiktok_verified, last_enriched_at, created_at
  from artist_links where coalesce(tiktok_handle, tiktok_url) is not null
  union all
  select artist_id, 'facebook', facebook_url, facebook_url,
         facebook_verified, last_enriched_at, created_at
  from artist_links where facebook_url is not null
  union all
  select artist_id, 'soundcloud', soundcloud_url, soundcloud_url,
         soundcloud_verified, last_enriched_at, created_at
  from artist_links where soundcloud_url is not null
  union all
  select artist_id, 'genius', genius_url, genius_url,
         genius_verified, last_enriched_at, created_at
  from artist_links where genius_url is not null
) h
where exists (select 1 from sources s where s.id = h.source_id)
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. artist_links -> platform_identifiers (canonical id mapping, id columns only)
--    UNIQUE (platform, platform_id) enforces de-duplication of the 3x Spotify ID
--    problem: first artist keeps the canonical id, later duplicates are dropped.
-- ──────────────────────────────────────────────────────────────────────────────
insert into platform_identifiers (
  entity_type, entity_id, platform, platform_id, verified, verified_at, verified_by, confidence
)
select
  'artist', p.source_id, p.platform, p.platform_id, p.verified,
  case when p.verified then p.last_enriched_at end,
  case when p.verified then 'enrichment' end,
  1.00
from (
  select artist_id as source_id, 'spotify_artists' as platform, spotify_id as platform_id,
         spotify_verified as verified, last_enriched_at
  from artist_links where spotify_id is not null
  union all
  select artist_id, 'apple_music', apple_music_id, apple_verified, last_enriched_at
  from artist_links where apple_music_id is not null
  union all
  select artist_id, 'youtube', youtube_channel_id, youtube_verified, last_enriched_at
  from artist_links where youtube_channel_id is not null
  union all
  select artist_id, 'instagram', instagram_handle, instagram_verified, last_enriched_at
  from artist_links where instagram_handle is not null
  union all
  select artist_id, 'tiktok', tiktok_handle, tiktok_verified, last_enriched_at
  from artist_links where tiktok_handle is not null
) p
where exists (select 1 from artists a where a.id = p.source_id)
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually on shadow DB — sub-mission #05):
--   select count(*) from scout_sources;                       -- expect == feeds
--   select count(*) from sources where type = 'feed';
--   select count(*) from artists;                             -- expect == artists
--   select count(*) from sources where type = 'artist';
--   select platform, count(*) from source_handles group by platform;
--   select platform, count(*) from platform_identifiers group by platform;
-- Dropped-duplicate audit (3x Spotify ID problem):
--   select count(*) - count(distinct (platform, platform_id)) as dropped
--     from artist_links, lateral (values ('spotify_artists', spotify_id)) v(platform, platform_id)
--    where spotify_id is not null;
-- ──────────────────────────────────────────────────────────────────────────────
