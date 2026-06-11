-- ═══════════════════════════════════════════════════════════════════════════════
-- HOTDROPPZ — PIPELINE EXTENSIONS
-- Run AFTER MASTER_SCHEMA.sql (fully idempotent, safe to re-run)
-- Adds: filter columns, content_structured, pipeline_stage_runs,
--       post_monetization, social_posts, all RLS, realtime, views
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SCOUT_ITEMS — filter stage columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Reason the filter stage kept or discarded this item
alter table scout_items add column if not exists filter_reason     text;

-- Fingerprint used for duplicate detection (first 60 chars of title, lowercased)
alter table scout_items add column if not exists title_fingerprint text
  generated always as (lower(substring(trim(title), 1, 60))) stored;

-- Index for fast duplicate detection in filter.ts
create unique index if not exists idx_scout_items_title_fingerprint
  on scout_items(title_fingerprint)
  where status != 'discarded';

-- Index for filter stage: find SCOUTED items not yet processed
create index if not exists idx_scout_items_filter_queue
  on scout_items(created_at asc)
  where status = 'SCOUTED';

-- Index for filter: P0/P1 bypass check
create index if not exists idx_scout_items_priority_filter
  on scout_items(priority, status)
  where priority in ('P0','P1');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. POSTS — content_structured + writer metadata
-- ─────────────────────────────────────────────────────────────────────────────

-- Journalist writer structured output: sections[], key_points[], pull_quote
-- Shape: { sections: [{heading, body}], key_points: string[], pull_quote: string }
alter table posts add column if not exists content_structured jsonb not null default '{}';

-- Which prompt version generated this post (e.g. "JOURNALIST_WRITER_V2")
alter table posts add column if not exists writer_version text;

-- Monetization link (denormalized score for fast feed queries)
alter table posts add column if not exists revenue_tier text
  check (revenue_tier in ('low','medium','high','premium') or revenue_tier is null);

-- Index on structured content for posts that have it (feeds journalist article view)
create index if not exists idx_posts_content_structured
  on posts using gin(content_structured)
  where content_structured != '{}'::jsonb;

create index if not exists idx_posts_revenue_tier
  on posts(revenue_tier)
  where revenue_tier is not null;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PIPELINE_STAGE_RUNS — unified run tracking for all non-scout stages
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pipeline_stage_runs (
  id            uuid        primary key default gen_random_uuid(),
  stage         text        not null
                check (stage in (
                  'filter','translator','curator','cluster',
                  'enrichment','writer','feed','multilang','monetizer'
                )),
  status        text        not null default 'running'
                check (status in ('running','complete','error')),
  processed     integer     not null default 0,
  kept          integer     not null default 0,
  discarded     integer     not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  tokens_used   integer     not null default 0,
  duration_ms   integer,
  triggered_by  text        not null default 'manual'
                check (triggered_by in ('manual','cron','api','webhook')),
  error_message text,
  metadata      jsonb       not null default '{}',
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_stage_runs_stage       on pipeline_stage_runs(stage, started_at desc);
create index if not exists idx_stage_runs_status      on pipeline_stage_runs(status);
create index if not exists idx_stage_runs_started_at  on pipeline_stage_runs(started_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. POST_MONETIZATION — AI scoring for published posts
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists post_monetization (
  id              uuid        primary key default gen_random_uuid(),
  post_id         uuid        not null unique references posts(id) on delete cascade,
  ad_categories   text[]      not null default '{}',
  premium_score   smallint    not null default 0 check (premium_score >= 0 and premium_score <= 10),
  affiliate_hints text[]      not null default '{}',
  trending_boost  boolean     not null default false,
  sponsored_fit   text[]      not null default '{}',
  revenue_tier    text        not null default 'low'
                  check (revenue_tier in ('low','medium','high','premium')),
  scored_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_post_monetization_post_id       on post_monetization(post_id);
create index if not exists idx_post_monetization_revenue_tier  on post_monetization(revenue_tier);
create index if not exists idx_post_monetization_premium_score on post_monetization(premium_score desc);
create index if not exists idx_post_monetization_trending
  on post_monetization(trending_boost)
  where trending_boost = true;
create index if not exists idx_post_monetization_scored_at
  on post_monetization(scored_at desc);

-- Sync denormalized revenue_tier back to posts on upsert
create or replace function sync_post_revenue_tier()
returns trigger language plpgsql as $$
begin
  update posts set revenue_tier = new.revenue_tier where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists post_monetization_sync_tier on post_monetization;
create trigger post_monetization_sync_tier
  after insert or update of revenue_tier on post_monetization
  for each row execute function sync_post_revenue_tier();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SOCIAL_POSTS — generated IG / TikTok / X captions
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists social_posts (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        references posts(id) on delete cascade,
  platform   text        not null check (platform in ('instagram','tiktok','twitter')),
  hook       text        not null default '',
  caption    text        not null default '',
  hashtags   text[]      not null default '{}',
  cta        text        not null default 'hotdroppz.com',
  published  boolean     not null default false,
  created_at timestamptz not null default now()
);

-- One row per (post, platform)
create unique index if not exists idx_social_posts_post_platform
  on social_posts(post_id, platform);

create index if not exists idx_social_posts_platform   on social_posts(platform);
create index if not exists idx_social_posts_published  on social_posts(published);
create index if not exists idx_social_posts_created_at on social_posts(created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

alter table pipeline_stage_runs enable row level security;
alter table post_monetization   enable row level security;
alter table social_posts        enable row level security;

-- pipeline_stage_runs
drop policy if exists "stage_runs: read"  on pipeline_stage_runs;
drop policy if exists "stage_runs: write" on pipeline_stage_runs;
create policy "stage_runs: read"  on pipeline_stage_runs
  for select using (auth.role() = 'authenticated');
create policy "stage_runs: write" on pipeline_stage_runs
  for all    using (get_user_role() in ('admin','editor'));

-- post_monetization: editors read, service role writes via admin client
drop policy if exists "admin_editor_read_monetization" on post_monetization;
drop policy if exists "admin_write_monetization"       on post_monetization;
create policy "admin_editor_read_monetization" on post_monetization
  for select using (get_user_role() in ('admin','editor'));
create policy "admin_write_monetization"       on post_monetization
  for all    using (get_user_role() = 'admin');

-- social_posts
drop policy if exists "social_posts: read"   on social_posts;
drop policy if exists "social_posts: write"  on social_posts;
drop policy if exists "social_posts: delete" on social_posts;
create policy "social_posts: read"   on social_posts
  for select using (auth.role() = 'authenticated');
create policy "social_posts: write"  on social_posts
  for all    using (get_user_role() in ('admin','editor'));
create policy "social_posts: delete" on social_posts
  for delete using (get_user_role() = 'admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin alter publication supabase_realtime add table pipeline_stage_runs;
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table post_monetization;
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table social_posts;
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table story_clusters;
exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- 8a. Posts with full monetization data (for monetizer dashboard tab)
create or replace view posts_with_monetization as
select
  p.id,
  p.title,
  p.short_text,
  p.category,
  p.tags,
  p.ai_score,
  p.status,
  p.droppz_type,
  p.published_at,
  p.created_at,
  pm.revenue_tier,
  pm.premium_score,
  pm.trending_boost,
  pm.ad_categories,
  pm.affiliate_hints,
  pm.sponsored_fit,
  pm.scored_at
from posts p
left join post_monetization pm on p.id = pm.post_id
where p.status in ('approved','published');

-- 8b. Revenue tier breakdown summary
create or replace view monetization_summary as
select
  revenue_tier,
  count(*)                                          as post_count,
  avg(premium_score)::numeric(4,2)                 as avg_premium_score,
  count(*) filter (where trending_boost = true)    as trending_count
from post_monetization
group by revenue_tier
order by
  case revenue_tier
    when 'premium' then 1
    when 'high'    then 2
    when 'medium'  then 3
    when 'low'     then 4
  end;

-- 8c. Filter discard breakdown (for pipeline health dashboard)
create or replace view filter_discard_stats as
select
  filter_reason,
  count(*) as count,
  min(created_at) as oldest,
  max(created_at) as newest
from scout_items
where status = 'discarded' and filter_reason is not null
group by filter_reason
order by count desc;

-- 8d. Pipeline health — one row per stage, latest run stats
create or replace view pipeline_stage_health as
select distinct on (stage)
  stage,
  status,
  processed,
  kept,
  discarded,
  cost_usd,
  tokens_used,
  duration_ms,
  triggered_by,
  error_message,
  started_at,
  completed_at
from pipeline_stage_runs
order by stage, started_at desc;

-- 8e. Full pipeline queue sizes (extends existing getPipelineState logic)
create or replace view pipeline_queue_counts as
select
  count(*) filter (where status = 'SCOUTED')    as scouted,
  count(*) filter (where status = 'TRANSLATED') as translated,
  count(*) filter (where status = 'CURATED')    as curated,
  count(*) filter (where status = 'CLUSTERED')  as clustered,
  count(*) filter (where status = 'WRITTEN')    as written,
  count(*) filter (where status = 'discarded')  as discarded,
  count(*)                                       as total
from scout_items;

-- 8f. Social posts joined with parent post data (for social dashboard)
create or replace view social_posts_with_post as
select
  sp.id,
  sp.platform,
  sp.hook,
  sp.caption,
  sp.hashtags,
  sp.cta,
  sp.published,
  sp.created_at,
  p.id         as post_id,
  p.title      as post_title,
  p.category   as post_category,
  p.published_at as post_published_at
from social_posts sp
join posts p on sp.post_id = p.id
order by sp.created_at desc;

-- 8g. Cost tracking view across all stages + scout runs
create or replace view pipeline_cost_summary as
select
  stage,
  count(*)               as run_count,
  sum(cost_usd)          as total_cost_usd,
  sum(tokens_used)       as total_tokens,
  avg(duration_ms)::int  as avg_duration_ms,
  max(started_at)        as last_run
from pipeline_stage_runs
where status = 'complete'
group by stage
union all
select
  'scout'                as stage,
  count(*)               as run_count,
  null::numeric          as total_cost_usd,
  null::integer          as total_tokens,
  avg(duration_ms)::int  as avg_duration_ms,
  max(started_at)        as last_run
from scout_runs
where status = 'complete'
group by 1
order by stage;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SCORING_WEIGHTS — seed monetization category weights
-- ─────────────────────────────────────────────────────────────────────────────

-- Extend scoring_weights to also store ad category CPM estimates (for revenue planning)
alter table scoring_weights add column if not exists cpm_estimate numeric(6,2) default null;
alter table scoring_weights add column if not exists ad_category  boolean not null default false;

-- Ad category weight seeds (used by monetizer for targeting hints)
insert into scoring_weights (category, weight, reason, ad_category) values
  ('music_streaming', 1.00, 'Spotify / Apple Music affiliate CPC',      true),
  ('fashion',         0.90, 'Streetwear affiliate programs',             true),
  ('gaming',          0.85, 'Gaming hardware + title sponsors',          true),
  ('ticketing',       0.95, 'Event ticketing high CPC',                  true),
  ('merch',           0.80, 'Artist merch direct affiliate',             true),
  ('energy_drinks',   0.70, 'Gen-Z demographic match',                   true),
  ('sneakers',        0.85, 'High-margin affiliate category',            true)
on conflict (category) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables added:   pipeline_stage_runs, post_monetization, social_posts
-- Columns added:  scout_items.filter_reason, scout_items.title_fingerprint
--                 posts.content_structured, posts.writer_version, posts.revenue_tier
-- Views added:    posts_with_monetization, monetization_summary,
--                 filter_discard_stats, pipeline_stage_health,
--                 pipeline_queue_counts, social_posts_with_post,
--                 pipeline_cost_summary
-- ─────────────────────────────────────────────────────────────────────────────
