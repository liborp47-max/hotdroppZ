-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ — ARTIST BOOST FEED VIEW
-- Creates ranked feed views using artist intelligence boost
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Posts with effective score (ai_score × artist boost multiplier)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view posts_with_artist_boost as
select
  p.*,
  coalesce(a.boost_multiplier, 1.0)           as artist_boost_factor,
  round(p.ai_score::numeric * coalesce(a.boost_multiplier, 1.0), 2) as boosted_score,
  a.name                                      as artist_name,
  a.country                                   as artist_country,
  a.genre                                     as artist_genre,
  a.trending_boost                           as artist_trending,
  a.priority_level                           as artist_priority
from posts p
left join artists a on p.artist_id = a.id
where p.status in ('approved','published');

-- Index to support fast ordering by boosted_score
create index if not exists idx_posts_with_boost_score
  on posts(ai_score desc)
  where status in ('approved','published');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Top-boosted feed (for homepage / featured carousel)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view ranked_feed as
select
  id,
  title,
  short_text,
  category,
  tags,
  image_url,
  ai_score,
  boosted_score,
  artist_name,
  artist_country,
  artist_genre,
  artist_trending,
  published_at,
  created_at,
  -- Fire-system flags
  case
    when boosted_score >= 90 and artist_trending then 'fire'
    when boosted_score >= 85 then 'hot'
    when boosted_score >= 75 then 'rising'
    else 'standard'
  end as fire_tier
from posts_with_artist_boost
where status = 'published'
order by
  case
    when boosted_score >= 90 and artist_trending then 1
    when boosted_score >= 85 then 2
    when boosted_score >= 75 then 3
    else 4
  end,
  boosted_score desc,
  published_at desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trending artist spotlight (for sidebar widget)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view trending_artists as
select
  a.id,
  a.name,
  a.country,
  a.genre,
  a.base_score,
  a.boost_multiplier,
  a.trending_boost,
  a.last_release_at,
  ar.last_release_at as most_recent_release,
  ar.title         as latest_release_title,
  ar.type          as latest_release_type,
  (
    select count(*) from artist_releases ar2
    where ar2.artist_id = a.id
      and ar2.release_date >= (current_date - interval '30 days')
  ) as releases_last_30d
from artists a
left join lateral (
  select title, release_date, type
  from artist_releases ar_
  where ar_.artist_id = a.id
  order by release_date desc
  limit 1
) ar on true
where a.trending_boost = true
   or a.last_release_at >= (current_date - interval '7 days')
order by
  a.trending_boost desc,
  a.last_release_at desc,
  a.base_score desc
limit 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Country-specific feed (for regional dashboards)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view ranked_feed_by_country as
select
  p.id,
  p.title,
  p.category,
  p.ai_score,
  p.boosted_score,
  p.artist_name,
  p.artist_country,
  p.published_at
from posts_with_artist_boost p
where p.status = 'published'
  and (p.artist_country is not null)
order by
  p.artist_country,
  p.boosted_score desc,
  p.published_at desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Materialized view for ultra-fast top feed (refresh via cron/webhook)
-- ─────────────────────────────────────────────────────────────────────────────

create materialized view if not exists mv_top_feed as
select
  id,
  title,
  short_text,
  category,
  image_url,
  boosted_score,
  artist_name,
  artist_country,
  published_at
from ranked_feed
where fire_tier in ('fire','hot')
order by boosted_score desc
limit 50;

-- Unique index for refresh
create unique index if not exists idx_mv_top_feed_id on mv_top_feed(id);

-- Function to refresh materialized view (call after writer run)
create or replace function refresh_top_feed()
returns void language sql as $$
  refresh materialized view mv_top_feed;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table posts_with_artist_boost;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table ranked_feed;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table trending_artists;
exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE — Artist Intelligence Layer complete
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this SQL file in Supabase SQL Editor after ARTIST_INTELLIGENCE.sql
-- Then enable Realtime on these views in Supabase Dashboard:
--   • posts_with_artist_boost
--   • ranked_feed
--   • trending_artists
-- ─────────────────────────────────────────────────────────────────────────────
