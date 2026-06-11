-- =============================================================================
-- HotDroppZ Pipeline Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type scout_item_status   as enum ('SCOUTED','TRANSLATED','CURATED','CLUSTERED','WRITTEN');
create type scout_item_category as enum ('droppz_news','rap_core','deep_scout','drama','fashion','culture','global_news','science');
create type scout_item_priority as enum ('P0','P1');

create type cluster_status      as enum ('pending','written');
create type enrichment_status   as enum ('pending','done','error');

create type feed_post_type      as enum ('track','album','event','video_release');
create type media_hint_type     as enum ('image','video');

create type post_status         as enum ('draft','approved','published');
create type curated_status      as enum ('pending','sent_to_writer');

create type source_health       as enum ('ok','error');
create type run_status          as enum ('running','complete','error');

-- ---------------------------------------------------------------------------
-- scout_sources
-- ---------------------------------------------------------------------------
create table if not exists scout_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null,
  category        scout_item_category not null,
  lang            text not null default 'en',
  active          boolean not null default true,
  health          source_health not null default 'ok',
  error_message   text,
  last_fetched_at timestamptz
);

create index if not exists scout_sources_active_idx on scout_sources (active);

-- ---------------------------------------------------------------------------
-- scout_runs
-- ---------------------------------------------------------------------------
create table if not exists scout_runs (
  id             uuid primary key default gen_random_uuid(),
  status         run_status not null default 'running',
  triggered_by   text not null default 'manual',
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  duration_ms    integer,
  items_found    integer,
  sources_count  integer,
  error_message  text
);

create index if not exists scout_runs_status_idx      on scout_runs (status);
create index if not exists scout_runs_started_at_idx  on scout_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- scout_items
-- ---------------------------------------------------------------------------
create table if not exists scout_items (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  title_en        text,
  source          text not null,
  url             text,
  category        scout_item_category,
  priority        scout_item_priority,
  language        text,
  lang_detected   text,
  content         text,
  content_en      text,
  raw_content     text,
  english_master  text,
  attention_score numeric(5,2),
  is_release      boolean,
  release_type    text,
  status          scout_item_status not null default 'SCOUTED',
  published_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists scout_items_status_idx          on scout_items (status);
create index if not exists scout_items_url_idx             on scout_items (url) where url is not null;
create index if not exists scout_items_created_at_idx      on scout_items (created_at desc);
create index if not exists scout_items_attention_score_idx on scout_items (attention_score desc);

-- ---------------------------------------------------------------------------
-- story_clusters
-- ---------------------------------------------------------------------------
create table if not exists story_clusters (
  id                    uuid primary key default gen_random_uuid(),
  main_entity           text not null,
  category              scout_item_category,
  title                 text,
  confidence            numeric(4,3),
  merged_context        text[],
  status                cluster_status not null default 'pending',
  primary_scout_item_id uuid references scout_items (id) on delete set null,
  max_attention_score   numeric(5,2),
  source_count          integer not null default 1,
  -- enrichment fields
  artist_name           text,
  spotify_url           text,
  youtube_url           text,
  genius_url            text,
  image_url             text,
  enrichment_status     enrichment_status,
  enriched_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists story_clusters_status_idx           on story_clusters (status);
create index if not exists story_clusters_enrichment_idx       on story_clusters (enrichment_status);
create index if not exists story_clusters_max_attention_idx    on story_clusters (max_attention_score desc);
create index if not exists story_clusters_created_at_idx       on story_clusters (created_at desc);

-- ---------------------------------------------------------------------------
-- story_cluster_sources  (junction: cluster ↔ scout_item)
-- ---------------------------------------------------------------------------
create table if not exists story_cluster_sources (
  id             uuid primary key default gen_random_uuid(),
  cluster_id     uuid not null references story_clusters (id) on delete cascade,
  scout_item_id  uuid not null references scout_items     (id) on delete cascade,
  source_name    text not null,
  url            text,
  text_snippet   text,
  unique (cluster_id, scout_item_id)
);

create index if not exists scs_cluster_id_idx      on story_cluster_sources (cluster_id);
create index if not exists scs_scout_item_id_idx   on story_cluster_sources (scout_item_id);

-- ---------------------------------------------------------------------------
-- curated_items
-- ---------------------------------------------------------------------------
create table if not exists curated_items (
  id             uuid primary key default gen_random_uuid(),
  scout_item_id  uuid references scout_items (id) on delete set null,
  score          integer not null default 0 check (score between 0 and 100),
  category       scout_item_category,
  tags           text[] not null default '{}',
  reasoning      text,
  status         curated_status not null default 'pending',
  created_at     timestamptz not null default now()
);

create index if not exists curated_items_scout_item_id_idx on curated_items (scout_item_id);
create index if not exists curated_items_status_idx        on curated_items (status);

-- ---------------------------------------------------------------------------
-- posts  (CMS)
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  body                text,
  short_text          text,
  summary             text,
  category            scout_item_category,
  tags                text[] not null default '{}',
  source_url          text,
  source_name         text,
  ai_score            numeric(5,2),
  status              post_status not null default 'draft',
  media_hint          media_hint_type,
  image_url           text,
  embeds              jsonb not null default '[]',
  localized_versions  jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists posts_status_idx        on posts (status);
create index if not exists posts_source_url_idx    on posts (source_url) where source_url is not null;
create index if not exists posts_created_at_idx    on posts (created_at desc);
-- partial index for multilang: posts that still need localization
create index if not exists posts_needs_multilang_idx
  on posts (status)
  where status in ('draft','approved','published')
    and (localized_versions is null or localized_versions = '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- feed_posts
-- ---------------------------------------------------------------------------
create table if not exists feed_posts (
  id             uuid primary key default gen_random_uuid(),
  scout_item_id  uuid references scout_items    (id) on delete set null,
  cluster_id     uuid references story_clusters (id) on delete set null,
  type           feed_post_type not null,
  title          text not null,
  content        text not null,
  summary        text,
  confidence     numeric(4,3),
  tags           text[] not null default '{}',
  artist         text,
  spotify_url    text,
  youtube_url    text,
  genius_url     text,
  image_url      text,
  media_hint     media_hint_type,
  created_at     timestamptz not null default now()
);

create index if not exists feed_posts_cluster_id_idx      on feed_posts (cluster_id) where cluster_id is not null;
create index if not exists feed_posts_scout_item_id_idx   on feed_posts (scout_item_id) where scout_item_id is not null;
create index if not exists feed_posts_media_hint_idx      on feed_posts (media_hint);
create index if not exists feed_posts_created_at_idx      on feed_posts (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — enable on all tables, allow authenticated users full access
-- (tighten per-table later as needed)
-- ---------------------------------------------------------------------------
alter table scout_sources         enable row level security;
alter table scout_runs            enable row level security;
alter table scout_items           enable row level security;
alter table story_clusters        enable row level security;
alter table story_cluster_sources enable row level security;
alter table curated_items         enable row level security;
alter table posts                 enable row level security;
alter table feed_posts            enable row level security;

-- Authenticated read/write for all pipeline tables
create policy "auth_all_scout_sources"         on scout_sources         for all to authenticated using (true) with check (true);
create policy "auth_all_scout_runs"            on scout_runs            for all to authenticated using (true) with check (true);
create policy "auth_all_scout_items"           on scout_items           for all to authenticated using (true) with check (true);
create policy "auth_all_story_clusters"        on story_clusters        for all to authenticated using (true) with check (true);
create policy "auth_all_story_cluster_sources" on story_cluster_sources for all to authenticated using (true) with check (true);
create policy "auth_all_curated_items"         on curated_items         for all to authenticated using (true) with check (true);
create policy "auth_all_posts"                 on posts                 for all to authenticated using (true) with check (true);
create policy "auth_all_feed_posts"            on feed_posts            for all to authenticated using (true) with check (true);
