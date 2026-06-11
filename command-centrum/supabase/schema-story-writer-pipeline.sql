-- Story/Writer pipeline DB bridge
-- Persists outputs from Cluster Pool -> Story Builder -> Writer Engine

create extension if not exists "pgcrypto";

create table if not exists pipeline_cluster_snapshots (
  id uuid primary key default gen_random_uuid(),
  total_items integer,
  total_relationships integer,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_cluster_snapshots_created_at
  on pipeline_cluster_snapshots(created_at desc);

create table if not exists pipeline_story_packages (
  id uuid primary key default gen_random_uuid(),
  story_id text not null unique,
  cluster_ids text[] not null default '{}',
  story_type text,
  headline text,
  tone text,
  audience_interest numeric,
  generated_at timestamptz not null default now(),
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pipeline_story_packages_generated_at
  on pipeline_story_packages(generated_at desc);

create index if not exists idx_pipeline_story_packages_cluster_ids
  on pipeline_story_packages using gin(cluster_ids);

create table if not exists pipeline_writer_outputs (
  id uuid primary key default gen_random_uuid(),
  story_package_id text not null unique,
  writer_profile text,
  tone text,
  recommended_platform text,
  predicted_engagement numeric,
  generated_at timestamptz not null default now(),
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pipeline_writer_outputs_generated_at
  on pipeline_writer_outputs(generated_at desc);

create or replace function pipeline_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pipeline_story_packages_updated_at on pipeline_story_packages;
create trigger trg_pipeline_story_packages_updated_at
before update on pipeline_story_packages
for each row execute function pipeline_touch_updated_at();

drop trigger if exists trg_pipeline_writer_outputs_updated_at on pipeline_writer_outputs;
create trigger trg_pipeline_writer_outputs_updated_at
before update on pipeline_writer_outputs
for each row execute function pipeline_touch_updated_at();
