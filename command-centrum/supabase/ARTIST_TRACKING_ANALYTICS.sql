-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ — ARTIST TRACKING ANALYTICS & LEARNING
-- Connects ATE to analytics and learning modules
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ARTIST ACTIVITY METRICS (materialized for fast dashboard queries)
-- ─────────────────────────────────────────────────────────────────────────────

create materialized view if not exists mv_artist_activity as
select
  a.id,
  a.name,
  a.country,
  a.genre,
  a.priority_score,
  a.is_tracking_active,
  
  -- Release stats (last 7/30/90 days)
  count(dq.id) filter (where dq.detected_at >= current_date - interval '7 days')  as releases_7d,
  count(dq.id) filter (where dq.detected_at >= current_date - interval '30 days') as releases_30d,
  count(dq.id) filter (where dq.detected_at >= current_date - interval '90 days') as releases_90d,
  
  -- Platform breakdown
  count(dq.id) filter (where dq.platform = 'spotify')   as spotify_releases,
  count(dq.id) filter (where dq.platform = 'youtube')   as youtube_releases,
  count(dq.id) filter (where dq.platform = 'rss')       as rss_releases,
  
  -- Media quality (has thumbnail?)
  count(dq.id) filter (where dq.thumbnail_url is not null) as with_media,
  
  -- Avg priority score of queued items
  round(avg(dq.priority_score), 1) as avg_queue_priority,
  
  -- Latest release
  max(dq.detected_at) as last_release_at,
  
  -- Queue health
  count(dq.id) filter (where dq.status = 'pending')    as pending_count,
  count(dq.id) filter (where dq.status = 'scouting')   as scouting_count,
  count(dq.id) filter (where dq.status = 'written')    as written_count,
  
  a.last_checked,
  a.created_at
from artists a
left join droppz_queue dq on dq.artist_id = a.id
group by a.id
order by a.priority_score desc, releases_7d desc;

-- Refresh function (call hourly or via webhook after tracking cycle)
create or replace function refresh_artist_activity()
returns void language sql as $$
  refresh materialized view mv_artist_activity;
$$;

-- Index for fast lookups
create unique index if not exists idx_mv_artist_activity_id
  on mv_artist_activity(id);
create index if not exists idx_mv_artist_activity_country
  on mv_artist_activity(country, releases_7d desc);
create index if not exists idx_mv_artist_activity_active
  on mv_artist_activity(is_tracking_active, last_release_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RELEASE TIMELINE (for learning: release → pipeline conversion rate)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view release_conversion_funnel as
select
  a.id                   as artist_id,
  a.name                 as artist_name,
  a.country,
  a.genre,
  
  -- Funnel stages
  count(dq.id)                                   as detected_total,
  count(dq.id) filter (where dq.status = 'pending')    as pending,
  count(dq.id) filter (where dq.status = 'scouting')   as scouting,
  count(dq.id) filter (where dq.status = 'clustered')  as clustered,
  count(dq.id) filter (where dq.status = 'written')    as written,
  count(dq.id) filter (where dq.status = 'duplicate')  as duplicate,
  count(dq.id) filter (where dq.status = 'error')      as error,
  
  -- Conversion rate: written / detected
  round(
    count(dq.id) filter (where dq.status = 'written')::numeric
    / nullif(count(dq.id), 0) * 100,
    1
  ) as conversion_rate_pct,
  
  -- Avg time from detection to written
  avg(
    extract(epoch from (
      coalesce(
        (select min(created_at) from scout_items si where si.url = dq.url),
        now()
      ) - dq.detected_at
    ))
  ) as avg_detection_to_written_seconds,
  
  max(dq.detected_at) as last_detected_at
from artists a
left join droppz_queue dq on dq.artist_id = a.id
group by a.id, a.name, a.country, a.genre
order by conversion_rate_pct desc nulls last, detected_total desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WEEKLY TREND ANALYSIS (for learning: which artists are heating up?)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view artist_weekly_trends as
select
  artist_id,
  artist_name,
  country,
  
  -- This week
  count(*) filter (where detected_at >= date_trunc('week', now())) as week_releases,
  
  -- Last week
  count(*) filter (where detected_at >= date_trunc('week', now() - interval '1 week')
                    and detected_at < date_trunc('week', now())) as last_week_releases,
  
  -- Trend delta
  case
    when count(*) filter (where detected_at >= date_trunc('week', now() - interval '1 week')) = 0 then null
    else round(
      (count(*) filter (where detected_at >= date_trunc('week', now()))::numeric
       / nullif(count(*) filter (where detected_at >= date_trunc('week', now() - interval '1 week')), 0) - 1
    ) * 100, 1)
  end as week_growth_pct,
  
  -- Heat flag
  count(*) filter (where detected_at >= date_trunc('week', now())) >= 3 as is_heating_up,
  
  max(detected_at) as last_release_at
from droppz_queue
where detected_at >= date_trunc('week', now() - interval '2 week')
group by artist_id, artist_name, country
order by week_growth_pct desc nulls last, week_releases desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PLATFORM EFFECTIVENESS (for learning: which platform gives best hits?)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view platform_effectiveness as
select
  platform,
  count(*)                                   as total_detections,
  count(*) filter (where status = 'written') as written_count,
  round(
    count(*) filter (where status = 'written')::numeric
    / nullif(count(*),0) * 100,
    1
  ) as conversion_rate,
  avg(priority_score)                       as avg_priority,
  count(distinct artist_id)                 as unique_artists
from droppz_queue
group by platform
order by conversion_rate desc, total_detections desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ARTIST FEED ENGAGEMENT (joins with feed_posts to see post performance)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view artist_feed_performance as
select
  a.id                     as artist_id,
  a.name                   as artist_name,
  a.country,
  a.genre,
  count(fp.id)             as feed_posts_count,
  round(avg(fp.ai_score),1) as avg_ai_score,
  round(avg(fp.ai_score) * coalesce(a.boost_multiplier, 1.0), 1) as avg_boosted_score,
  max(fp.published_at)     as latest_post_at,
  -- Engagement proxy: count of posts with high score (≥75)
  count(fp.id) filter (where fp.ai_score >= 75) as high_score_count
from artists a
left join feed_posts fp on fp.artist_id = a.id
group by a.id, a.name, a.country, a.genre, a.boost_multiplier
order by avg_boosted_score desc, feed_posts_count desc;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table mv_artist_activity;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table release_conversion_funnel;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table artist_weekly_trends;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table platform_effectiveness;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table artist_feed_performance;
exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS (read-only for these views)
-- ─────────────────────────────────────────────────────────────────────────────
-- Views inherit RLS from base tables (droppz_queue, artists)
-- No additional policies needed


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. LEARNING EXPORT FUNCTION (called by learning module)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function artist_tracking_learning_export(
  p_since timestamptz default (now() - interval '30 days')
)
returns table (
  artist_id          uuid,
  artist_name        text,
  country            text,
  release_count      integer,
  avg_priority       numeric(5,2),
  platforms          text[],
  last_detected_at   timestamptz
) language sql stable as $$
  select
    dq.artist_id,
    dq.artist_name,
    a.country,
    count(*)::integer                            as release_count,
    round(avg(dq.priority_score), 2)             as avg_priority,
    array_agg(distinct dq.platform)              as platforms,
    max(dq.detected_at)                          as last_detected_at
  from droppz_queue dq
  left join artists a on a.id = dq.artist_id
  where dq.detected_at >= p_since
    and dq.status != 'duplicate'
  group by dq.artist_id, dq.artist_name, a.country
  order by release_count desc;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Next: refresh materialized views after tracking runs
--   SELECT refresh_artist_activity();
-- ─────────────────────────────────────────────────────────────────────────────
