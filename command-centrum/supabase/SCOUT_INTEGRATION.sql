-- ─────────────────────────────────────────────────────────────────────────────
-- ARTIST TRACKING — SCOUT INTEGRATION
-- How droppz_queue items become high-priority scout_items
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Scout pre-processor: pull from droppz_queue first
-- Modify the existing scout pipeline to check droppz_queue BEFORE RSS

-- Create function that scout pipeline can call to get priority items
create or replace function get_priority_scout_input(
  p_limit integer default 50
) returns table (
  id               uuid,
  title            text,
  url              text,
  source           text,
  category         text,
  content          text,
  priority         text,
  is_release       boolean,
  source_type      text
) language sql stable as $$
  -- Select from droppz_queue first (high priority), then fall back to RSS if needed
  -- This view is consumed by the scout service
  select
    dq.id::uuid               as id,
    dq.title                  as title,
    dq.url                    as url,
    dq.artist_name            as source,
    'droppz_news'             as category,   -- todo: map artist genre → category
    dq.title                  as content,     -- placeholder — content will be enriched later
    'P0'                      as priority,
    true                      as is_release,
    'artist_tracking'         as source_type
  from droppz_queue dq
  where dq.status = 'pending'
  order by dq.priority_score desc, dq.detected_at desc
  limit p_limit;
$$;

-- 2. When scout runs and creates a scout_item from droppz_queue, mark queue item
create or replace function link_droppz_to_scout_item(
  p_droppz_id uuid,
  p_scout_item_id uuid
) returns void language plpgsql as $$
begin
  update droppz_queue set
    status        = 'scouting',
    scout_item_id = p_scout_item_id,
    processed_at  = now()
  where id = p_droppz_id;
end;
$$;

-- 3. Auto-update queue status when linked scout_item progresses
-- (call from curator / cluster stages via webhook or trigger)

create or replace function update_droppz_from_scout_status(
  p_scout_item_id uuid,
  p_new_status text
) returns void language plpgsql as $$
  -- Update associated droppz_queue item(s) status to match pipeline flow
  update droppz_queue set
    status = case
      when p_new_status = 'CURATED'  then 'curated'
      when p_new_status = 'CLUSTERED' then 'clustered'
      when p_new_status = 'WRITTEN'   then 'written'
      else status
    end,
    processed_at = now()
  where scout_item_id = p_scout_item_id;
$$;

-- 4. Scout pre-filter: query function to get combined input (droppz + RSS sources)
-- This replaces the old "scout_sources" only approach for hybrid runs

create or replace function get_hybrid_scout_sources(
  p_include_droppz boolean default true,
  p_include_rss    boolean default true,
  p_limit          integer  default 100
) returns table (
  source_name text,
  source_url  text,
  category    text,
  priority    text,
  source_type text   -- 'rss' | 'artist_tracking'
) language sql stable as $$
  -- RSS sources
  with rss_src as (
    select
      name   as source_name,
      url    as source_url,
      category,
      'P1'   as priority,
      'rss'  as source_type,
      active,
      last_fetched_at
    from scout_sources
    where active = true
  ),
  -- Droppz high-priority artist tracking (treated as synthetic source)
  droppz_src as (
    select
      artist_name             as source_name,
      url                     as source_url,
      'droppz_news'           as category,   -- will be re-mapped by curator
      'P0'                    as priority,
      'artist_tracking'       as source_type,
      true                    as active,
      detected_at             as last_fetched_at
    from droppz_queue
    where status = 'pending'
    group by artist_name, url, detected_at
  )
  select *
  from (
    select * from droppz_src where p_include_droppz
    union all
    select * from rss_src    where p_include_rss
  ) combined
  order by
    case priority when 'P0' then 1 when 'P1' then 2 else 3 end,
    last_fetched_at desc nulls last
  limit p_limit;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER — auto-category mapping from artist genre
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function map_artist_genre_to_category()
returns trigger language plpgsql as $$
begin
  -- When inserting into droppz_queue, map artist's primary genre to a scout category
  -- If artist genre is 'rap' → category 'rap_core'
  -- If 'hiphop' → 'rap_core'
  -- If 'drill'  → 'rap_core' (same pipeline)
  -- Future: can expand to pop, electronic, etc.
  
  if NEW.category is null or NEW.category = '' then
    NEW.category := 'rap_core';  -- default
  end if;
  
  return NEW;
end;
$$;

drop trigger if exists trg_map_genre on droppz_queue;
create trigger trg_map_genre
  before insert on droppz_queue
  for each row execute function map_artist_genre_to_category();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VIEW — High-priority queue ready for scout
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view priority_scout_queue as
select
  dq.id,
  dq.artist_name,
  dq.title,
  dq.type,
  dq.platform,
  dq.url,
  dq.thumbnail_url,
  dq.priority_score,
  a.country   as artist_country,
  a.genre     as artist_genre,
  a.priority_score as artist_priority,
  dq.detected_at
from droppz_queue dq
left join artists a on a.id = dq.artist_id
where dq.status = 'pending'
order by dq.priority_score desc, dq.detected_at desc;

-- Index for fast retrieval
create unique index if not exists idx_priority_scout_queue_id
  on droppz_queue(id)
  where status = 'pending';
create index if not exists idx_priority_scout_queue_priority
  on droppz_queue(priority_score desc, detected_at desc)
  where status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE — SCOUT INTEGRATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Usage in scout pipeline (api/scout/run or service):
--
--   1. Call SELECT * FROM get_hybrid_scout_sources() to get merged RSS+artist sources
--   2. For each droppz_queue row returned, create a scout_item with:
--        source = artist_name
--        url    = droppz url
--        priority = 'P0'
--        is_release = true
--   3. After creating scout_item, call link_droppz_to_scout_item(droppz_id, scout_item_id)
--   4. As scout_item progresses through pipeline, call update_droppz_from_scout_status()
--
-- This ensures artist tracking releases are injected FIRST (P0 priority) and tracked
-- ─────────────────────────────────────────────────────────────────────────────
