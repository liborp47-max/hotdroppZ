-- HDUA-01 · 03 — feed_items projection (the content contract)
-- A read-only VIEW that normalizes HDCC pipeline output (feed_posts + published
-- posts) into the single shape the Content API and native client consume
-- (see HDUA/src/types/index.ts → FeedItem). NO content is duplicated; projection
-- only. Columns verified against the LIVE schema 2026-06-10 (it has drifted from
-- the .sql files — feed_posts has summary/tags/apple_music_url; scout_items has
-- published_at + attention_score + language_detected, which we use for score and
-- freshness). Cursor pagination uses (published_at, id), backed by indexes below.

create or replace view hdua_feed_items as
-- ── Music / event drops from the feed engine ────────────────────────────────
select
  fp.id,
  case fp.type
    when 'track'         then 'release'
    when 'album'         then 'release'
    when 'video_release' then 'video'
    when 'event'         then 'event'
    else 'release'
  end::text                                          as type,
  fp.title,
  coalesce(fp.content, fp.summary, '')               as content,
  fp.image_url                                       as cover_image,
  fp.artist,
  null::text                                         as country,
  coalesce(si.language_detected, si.language)        as language,
  si.category,
  null::text                                         as subcategory,
  si.source,
  si.url                                             as source_url,
  coalesce(si.attention_score, 0)::numeric           as score,
  coalesce(fp.tags, '{}')                            as tags,
  fp.created_at,
  fp.created_at                                      as updated_at,
  coalesce(si.published_at, fp.created_at)           as published_at,
  jsonb_build_object(
    'spotify_url',     fp.spotify_url,
    'youtube_url',     fp.youtube_url,
    'apple_music_url', fp.apple_music_url,
    'genius_url',      fp.genius_url,
    'card_metadata',   fp.card_metadata
  )                                                  as extra
from feed_posts fp
left join scout_items si on si.id = fp.scout_item_id

union all

-- ── Published articles from the writer/CMS stage ─────────────────────────────
select
  p.id,
  'article'::text                                    as type,
  p.title,
  coalesce(p.summary, p.short_text, left(coalesce(p.body, ''), 280)) as content,
  coalesce(p.selected_image_url, p.graphic_url, p.image_url) as cover_image,
  null::text                                         as artist,
  null::text                                         as country,
  'en'::text                                         as language,
  p.category,
  p.droppz_type                                      as subcategory,
  p.source_name                                      as source,
  p.source_url,
  coalesce(p.ai_score, 0)::numeric                   as score,
  coalesce(p.tags, '{}')                             as tags,
  p.created_at,
  p.updated_at,
  p.published_at,
  coalesce(p.embeds, '[]'::jsonb)                    as extra
from posts p
where p.status = 'published';

-- Cursor-pagination + ordering support on the source tables.
create index if not exists idx_feed_posts_created on feed_posts(created_at desc);
create index if not exists idx_posts_published on posts(published_at desc) where status = 'published';

comment on view hdua_feed_items is
  'HDUA content contract: normalized projection of feed_posts + published posts. Read-only.';
