-- ═══════════════════════════════════════════════════════════════════════════════
-- ARTIST TRACKING ENGINE — COMPLETE INTEGRATION
-- 1. Scout → Artist auto-link when new item created
-- 2. Droppz → Scout priority injection
-- 3. Learning feedback loop
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SCOUT ITEM → ARTIST AUTO-LINK
-- When scout creates a scout_item from droppz_queue or RSS with an artist_name,
-- automatically link to existing artist record
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function link_scout_item_to_artist(
  p_scout_item_id uuid,
  p_artist_name    text,
  p_country_hint   text default null
) returns uuid language plpgsql as $$
declare
  v_artist_id  uuid;
  v_normalized text := lower(trim(p_artist_name));
begin
  -- Try to find existing artist
  select id into v_artist_id
  from artists
  where normalized_name = v_normalized
    and (p_country_hint is null or country = p_country_hint)
  limit 1;

  -- If not found, create on-the-fly with default score
  if v_artist_id is null then
    insert into artists (
      name, normalized_name, country, genre,
      priority_score, is_tracking_active, last_checked
    ) values (
      p_artist_name,
      v_normalized,
      coalesce(p_country_hint, 'global'),
      'rap',
      50,
      true,
      now()
    ) returning id into v_artist_id;
  end if;

  -- Optionally: Log this linkage (for analytics)
  -- Could extend scout_items with artist_id column if tracking per-item

  return v_artist_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SCOUT PRE-PROCESSOR: get priority input from droppz_queue
-- Use this in place of (or in addition to) scout_sources
-- ─────────────────────────────────────────────────────────────────────────────

-- Create view combining high-priority droppz items + active RSS sources
-- This is the "hybrid scout input" mentioned in the spec

create or replace view hybrid_scout_input as
select
  -- Droppz (priority P0)
  dq.id::uuid          as source_id,
  dq.artist_name       as source_name,
  dq.url               as feed_url,
  dq.category          as category,
  'P0'                 as priority,
  'artist_tracking'    as source_type,
  dq.detected_at       as last_seen,
  dq.status            as queue_status
from droppz_queue dq
where dq.status = 'pending'

union all

-- RSS sources (priority P1)
select
  ss.id::uuid          as source_id,
  ss.name              as source_name,
  ss.url               as feed_url,
  ss.category          as category,
  'P1'                 as priority,
  'rss'                as source_type,
  ss.last_fetched_at   as last_seen,
  null::text           as queue_status
from scout_sources ss
where ss.active = true

order by priority desc, last_seen desc nulls last;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRIORITY BOOSTING RULES
-- When scout processes a droppz item, it should automatically get a boost
-- This can be done in the scout service or via a DB default
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function apply_artist_boost_to_scout_item(
  p_title       text,
  p_priority    text,
  p_source_type text,
  p_artist_name text
) returns integer language sql immutable as $$
  -- Base AI score boost: +20 to +40 for artist-tracked items
  select case
    when p_source_type = 'artist_tracking' then 30   -- flat +30 boost
    else 0
  end;
$$;

-- Usage: during writer/clustering, add boost to final score
--   boosted_score = ai_score + apply_artist_boost(...)


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DEDUPLICATION CHECK (pre-insert)
-- Don't enqueue if URL already exists in scout_items (regardless of status)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function is_duplicate_release(p_url text) returns boolean language sql stable as $$
  select exists (
    select 1 from scout_items where url = p_url
    union
    select 1 from droppz_queue where url = p_url and status != 'duplicate'
  );
$$;

-- Use in enqueue flow:
--   if is_duplicate_release(url) then return 'duplicate';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRACKING FREQUENCY AUTO-ADJUST
-- Already covered by mark_artist_checked() in TRACKING_ENGINE.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FAIL HANDLING — retry/backoff on API errors
-- Enforce in artist-tracker service (Edge Function) with exponential backoff
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. LEARNING INTEGRATION — daily priority & interval adjustment
-- Learning service calls runDailyLearning() (see lib/learning/artist-performance.ts)
-- which updates artists.priority_score and check_interval_min
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. VIEW — Scout Pipeline Priority Order
-- For the HD Central dashboard: show how many P0 (droppz) items are waiting vs RSS
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view pipeline_priority_breakdown as
select
  'droppz' as source_type,
  count(*) as pending_count
from droppz_queue
where status = 'pending'

union all

select
  'rss' as source_type,
  count(*) as pending_count
from scout_items
where status = 'SCOUTED'
  and source not in (select artist_name from droppz_queue where status = 'pending')
  -- exclude items that originated from droppz (they have separate queue)
group by 'rss';

-- For dashboard use:
--   SELECT * FROM pipeline_priority_breakdown;
-- Shows how many droppz-tracked releases are pending vs regular RSS items


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. MATERIALIZED VIEW — Fast top tracking artists for UI
-- ─────────────────────────────────────────────────────────────────────────────

create materialized view if not exists mv_top_tracking_artists as
select
  a.id,
  a.name,
  a.country,
  a.genre,
  a.priority_score,
  a.is_tracking_active,
  a.last_checked,
  count(dq.id) filter (where dq.detected_at >= current_date - interval '7 days') as releases_7d,
  count(dq.id) filter (where dq.detected_at >= current_date - interval '30 days') as releases_30d,
  max(dq.detected_at) as last_release_at,
  round(avg(dq.priority_score),1) as avg_queue_priority
from artists a
left join droppz_queue dq on dq.artist_id = a.id
group by a.id
order by releases_7d desc, a.priority_score desc;

create unique index if not exists idx_mv_top_tracking_artists_id
  on mv_top_tracking_artists(id);
create index if not exists idx_mv_top_tracking_active
  on mv_top_tracking_artists(is_tracking_active, releases_7d desc);

-- Refresh helper
create or replace function refresh_top_tracking_artists()
returns void language sql as $$
  refresh materialized view mv_top_tracking_artists;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE — INTEGRATION COMPLETE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:      droppz_queue, tracking_log (artists extended)
-- Views:       hybrid_scout_input, pipeline_priority_breakdown, mv_top_tracking_artists
-- Functions:   link_scout_item_to_artist, is_duplicate_release, apply_artist_boost_to_scout_item
-- Edge funcs:  artist-tracking (cron), artist-learning (daily)
--
-- NEXT:
--  1. Deploy edge functions: supabase functions deploy artist-tracking
--  2. Set Functions secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
--  3. Create cron in Supabase: `*/5 * * * *` → artist-tracking URL
--  4. Create cron: `0 6 * * *` → artist-learning URL
--  5. Modify scout service to query `hybrid_scout_input` instead of only scout_sources
--  6. In writer/clustering, call `link_scout_item_to_artist()` with extracted artist_name
-- ─────────────────────────────────────────────────────────────────────────────
