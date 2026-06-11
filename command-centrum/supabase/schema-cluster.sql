alter table scout_items drop constraint if exists scout_items_status_check;
alter table scout_items add constraint scout_items_status_check
  check (status in ('SCOUTED','CURATED','CLUSTERED','WRITTEN','discarded'));

create table if not exists story_clusters (
  id                    uuid primary key default gen_random_uuid(),
  main_entity           text not null,
  category              text not null,
  title                 text not null,
  confidence            double precision not null default 0,
  merged_context        text[] not null default '{}',
  status                text not null default 'pending',
  primary_scout_item_id uuid references scout_items(id),
  max_attention_score   double precision not null default 0,
  source_count          integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint story_clusters_status_check
    check (status in ('pending','written','skipped'))
);

create table if not exists story_cluster_sources (
  id             uuid primary key default gen_random_uuid(),
  cluster_id     uuid not null references story_clusters(id) on delete cascade,
  scout_item_id  uuid not null references scout_items(id),
  source_name    text not null,
  url            text,
  text_snippet   text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_story_clusters_status   on story_clusters(status);
create index if not exists idx_story_clusters_created  on story_clusters(created_at desc);
create index if not exists idx_story_clusters_score    on story_clusters(max_attention_score desc);
create index if not exists idx_cluster_sources_cluster on story_cluster_sources(cluster_id);
create index if not exists idx_cluster_sources_scout   on story_cluster_sources(scout_item_id);

alter table feed_posts add column if not exists cluster_id uuid references story_clusters(id);

alter table story_clusters enable row level security;
alter table story_cluster_sources enable row level security;

drop policy if exists "story_clusters_select" on story_clusters;
create policy "story_clusters_select"
  on story_clusters for select to authenticated using (true);

drop policy if exists "story_cluster_sources_select" on story_cluster_sources;
create policy "story_cluster_sources_select"
  on story_cluster_sources for select to authenticated using (true);
