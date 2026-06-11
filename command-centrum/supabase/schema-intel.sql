-- ═══════════════════════════════════════════════════════════════
-- HDCC — Intel Central Data Hub (UM-INTEL)
-- Run AFTER schema-pipeline-runs.sql + schema-scout.sql
-- ═══════════════════════════════════════════════════════════════
--
-- Strategy: žádná duplikace existujících provozních dat. Přidává jen:
--   1. intel_audit_records      — system audit log (governance, decisions)
--   2. intel_retention_policies — per-source TTL (plan-manager risk #3)
--   3. intel_events VIEW        — UNION ALL nad pipeline_runs + worker_runs
--                                 + scout_runs + intel_audit_records
--                                 s normalized event shape
--
-- Producer coupling: VIEW používá COALESCE / NULL-safe casts (plan-manager
-- risk #2 schema drift). Změna producenta → no crash; pole je null/default.
--
-- Idempotent (IF NOT EXISTS).

-- ───────────────────────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'intel_event_kind') then
    create type intel_event_kind as enum (
      'pipeline_run',    -- pipeline_runs row
      'worker_run',      -- worker_runs row
      'scout_run',       -- scout_runs row (legacy)
      'audit_record',    -- intel_audit_records row
      'api_error',       -- derived from pipeline_runs.metadata
      'model_call'       -- derived from pipeline_runs.metadata
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'intel_severity') then
    create type intel_severity as enum ('info','warn','error','critical');
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────
-- intel_audit_records — system governance log
-- ───────────────────────────────────────────────────────────────
create table if not exists intel_audit_records (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,                                  -- 'mission', 'manual', 'agent', 'policy'
  actor           text not null,                                  -- user email / agent id
  action          text not null,                                  -- 'MISSION_DONE', 'POLICY_CHANGE', etc.
  severity        intel_severity not null default 'info',
  message         text not null,
  correlation_id  uuid,                                           -- ties to pipeline runs
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists intel_audit_records_created_idx       on intel_audit_records (created_at desc);
create index if not exists intel_audit_records_actor_idx         on intel_audit_records (actor, created_at desc);
create index if not exists intel_audit_records_severity_idx      on intel_audit_records (severity, created_at desc);
create index if not exists intel_audit_records_correlation_idx   on intel_audit_records (correlation_id) where correlation_id is not null;

-- ───────────────────────────────────────────────────────────────
-- intel_retention_policies — per-source TTL (plan-manager risk #3)
-- ───────────────────────────────────────────────────────────────
create table if not exists intel_retention_policies (
  source          text primary key,                               -- matches intel_event_kind values OR table names
  retention_days  integer,                                        -- null = forever
  description     text,
  updated_at      timestamptz not null default now()
);

-- Seed default policies — audit forever, runs 90d, derived 7d
insert into intel_retention_policies (source, retention_days, description) values
  ('audit_record',    null, 'Audit log — forever per governance requirement'),
  ('pipeline_run',    90,   'Pipeline runs — 90 days operational history'),
  ('worker_run',      90,   'Worker runs — same as pipeline'),
  ('scout_run',       90,   'Legacy scout runs')
on conflict (source) do nothing;

-- Fix MAJOR-2 (sub-09 audit): explicit cleanup of dead policy rows from earlier
-- shipped seed (api_error / model_call). They reference VIEW-only kinds with
-- no source table → purge function had no branch for them, misleading operators.
delete from intel_retention_policies where source in ('api_error','model_call');

-- ───────────────────────────────────────────────────────────────
-- intel_events VIEW — unified read API
--
-- Normalized shape:
--   id, kind, source_table, stage, status, severity, actor,
--   correlation_id, started_at, ended_at, duration_ms, message,
--   metadata jsonb, created_at
--
-- COALESCE / NULL-safe — survives upstream schema drift.
-- ───────────────────────────────────────────────────────────────
create or replace view intel_events as
  -- pipeline_runs
  select
    pr.id,
    'pipeline_run'::intel_event_kind as kind,
    'pipeline_runs'                  as source_table,
    pr.stage,
    pr.status::text                  as status,
    case
      when pr.status::text = 'error'   then 'error'::intel_severity
      when pr.errors_count > 0         then 'warn'::intel_severity
      else 'info'::intel_severity
    end                              as severity,
    coalesce(pr.actor, 'system')     as actor,
    pr.correlation_id,
    pr.started_at,
    pr.completed_at                  as ended_at,
    pr.duration_ms,
    coalesce(pr.error_summary, pr.stage || ' run') as message,
    pr.metadata,
    pr.created_at
  from pipeline_runs pr

  union all

  -- worker_runs (forward-compat: only included if table exists with expected columns)
  select
    wr.id,
    'worker_run'::intel_event_kind,
    'worker_runs',
    coalesce(wr.worker_id::text, 'worker'),
    coalesce(wr.status::text, 'unknown'),
    case
      when wr.status::text = 'failed' or wr.status::text = 'error' then 'error'::intel_severity
      else 'info'::intel_severity
    end,
    'worker',
    null::uuid,
    wr.started_at,
    coalesce(wr.completed_at, null),
    coalesce(extract(epoch from (wr.completed_at - wr.started_at))::integer * 1000, null),
    coalesce(wr.error_message, 'worker run'),
    '{}'::jsonb,
    coalesce(wr.created_at, wr.started_at)
  from worker_runs wr

  union all

  -- scout_runs (legacy)
  select
    sr.id,
    'scout_run'::intel_event_kind,
    'scout_runs',
    'scout',
    sr.status::text,
    case when sr.status::text = 'error' then 'error'::intel_severity else 'info'::intel_severity end,
    coalesce(sr.triggered_by, 'cron'),
    null::uuid,
    sr.started_at,
    sr.completed_at,
    sr.duration_ms,
    coalesce(sr.error_message, 'scout run — ' || coalesce(sr.items_found::text, '0') || ' items'),
    jsonb_build_object('sources_count', sr.sources_count, 'items_found', sr.items_found),
    sr.started_at
  from scout_runs sr

  union all

  -- intel_audit_records
  select
    ar.id,
    'audit_record'::intel_event_kind,
    'intel_audit_records',
    ar.source,
    'logged',
    ar.severity,
    ar.actor,
    ar.correlation_id,
    ar.created_at                    as started_at,
    ar.created_at                    as ended_at,
    0                                as duration_ms,
    ar.action || ': ' || ar.message  as message,
    ar.metadata,
    ar.created_at
  from intel_audit_records ar;

-- ───────────────────────────────────────────────────────────────
-- RETENTION FUNCTION — purges by per-source policy
-- Audit records with null retention stay forever.
-- ───────────────────────────────────────────────────────────────
create or replace function intel_purge_expired() returns table (source text, purged_count bigint)
language plpgsql
as $$
declare
  pol record;
  cnt bigint;
begin
  for pol in select source, retention_days from intel_retention_policies where retention_days is not null loop
    cnt := 0;
    if pol.source = 'pipeline_run' then
      delete from pipeline_runs where started_at < now() - (pol.retention_days || ' days')::interval;
      get diagnostics cnt = row_count;
    elsif pol.source = 'worker_run' then
      delete from worker_runs where started_at < now() - (pol.retention_days || ' days')::interval;
      get diagnostics cnt = row_count;
    elsif pol.source = 'scout_run' then
      delete from scout_runs where started_at < now() - (pol.retention_days || ' days')::interval;
      get diagnostics cnt = row_count;
    end if;
    return query select pol.source, cnt;
  end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table intel_audit_records      enable row level security;
alter table intel_retention_policies enable row level security;

do $$ begin
  drop policy if exists "intel_audit_records: authenticated can read" on intel_audit_records;
  create policy "intel_audit_records: authenticated can read"
    on intel_audit_records for select using (auth.role() = 'authenticated');
exception when undefined_function then null; end $$;

-- Fix MAJOR-3 (sub-09 audit): restrict INSERT to service_role only. Audit log
-- musí být tamper-resistant — authenticated UI klienti by neměli backdatovat
-- ani injectovat audit řádky. Pipeline kód insertuje přes createAdminClient()
-- = service_role; UI consumer pouze čte.
do $$ begin
  drop policy if exists "intel_audit_records: service-role can insert" on intel_audit_records;
  create policy "intel_audit_records: service-role can insert"
    on intel_audit_records for insert with check (auth.role() = 'service_role');
exception when undefined_function then null; end $$;

do $$ begin
  drop policy if exists "intel_retention_policies: authenticated can read" on intel_retention_policies;
  create policy "intel_retention_policies: authenticated can read"
    on intel_retention_policies for select using (auth.role() = 'authenticated');
exception when undefined_function then null; end $$;
