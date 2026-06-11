-- =============================================================================
-- Pipeline Runs — unified run tracking for all pipeline stages
-- =============================================================================
-- Unblocks KPI hydration (errorsToday, latencyP95Ms, recentRuns) for non-scout
-- stages. `scout_runs` zachován pro backward compat — kpi-hydrator fallbackuje
-- z pipeline_runs(stage='scout') na scout_runs pokud je první prázdná.
--
-- Reuses existing `run_status` enum z schema-pipeline.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pipeline_run_trigger') then
    create type pipeline_run_trigger as enum ('manual','cron','event');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- pipeline_runs
-- ---------------------------------------------------------------------------
create table if not exists pipeline_runs (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null,                       -- StageId: scout|filter|curator|cluster|enrichment|writer|feed-engine|multilang|monetizer|droppz-detector
  status            run_status not null default 'running',
  trigger_source    pipeline_run_trigger,
  correlation_id    uuid,                                -- propagates across pipeline run
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  duration_ms       integer,                             -- auto-computed on completed_at set (trigger below)
  items_processed   integer not null default 0,
  errors_count      integer not null default 0,
  actor             text,                                -- user email pro manual, NULL pro auto
  error_summary     text,                                -- short error msg pokud status='error'
  metadata          jsonb not null default '{}'::jsonb,  -- per-stage extras
  created_at        timestamptz not null default now()
);

create index if not exists pipeline_runs_stage_started_idx        on pipeline_runs (stage, started_at desc);
create index if not exists pipeline_runs_status_started_idx       on pipeline_runs (status, started_at desc);
create index if not exists pipeline_runs_stage_status_started_idx on pipeline_runs (stage, status, started_at desc);
create index if not exists pipeline_runs_correlation_idx          on pipeline_runs (correlation_id) where correlation_id is not null;

-- ---------------------------------------------------------------------------
-- worker_runs
-- ---------------------------------------------------------------------------
create table if not exists worker_runs (
  id                uuid primary key default gen_random_uuid(),
  worker_id         text not null,                       -- np. wkr-spotify-playlists
  platform          text not null,                       -- np. spotify_playlists
  status            run_status not null default 'running',
  trigger_source    pipeline_run_trigger,
  correlation_id    uuid,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  duration_ms       integer,
  items_processed   integer not null default 0,
  errors_count      integer not null default 0,
  actor             text,
  error_summary     text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists worker_runs_worker_started_idx    on worker_runs (worker_id, started_at desc);
create index if not exists worker_runs_platform_started_idx  on worker_runs (platform, started_at desc);
create index if not exists worker_runs_status_started_idx    on worker_runs (status, started_at desc);
create index if not exists worker_runs_correlation_idx       on worker_runs (correlation_id) where correlation_id is not null;

-- ---------------------------------------------------------------------------
-- Trigger: auto-compute duration_ms when completed_at is set
-- ---------------------------------------------------------------------------
create or replace function compute_run_duration_ms()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is not null and new.duration_ms is null then
    new.duration_ms := (extract(epoch from (new.completed_at - new.started_at)) * 1000)::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pipeline_runs_duration on pipeline_runs;
create trigger trg_pipeline_runs_duration
  before insert or update on pipeline_runs
  for each row execute function compute_run_duration_ms();

drop trigger if exists trg_worker_runs_duration on worker_runs;
create trigger trg_worker_runs_duration
  before insert or update on worker_runs
  for each row execute function compute_run_duration_ms();
