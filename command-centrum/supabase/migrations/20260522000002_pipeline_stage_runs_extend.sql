-- Migration: pipeline_stage_runs per-stage tracking extension (UM-CC_DATA_CONSISTENCY SM5)
--
-- pipeline_stage_runs already exists (PIPELINE_EXTENSIONS.sql) and lib/analytics/
-- collector.ts logs per-stage runs into it. SM5 needs end-to-end stage tracking:
--   - run_id    — links stage runs into one parent pipeline run
--   - error_code — classified failure code for debugging stage failures
-- Both columns are additive and nullable — no existing row or writer breaks.
--
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/migrations/20260522000002_pipeline_stage_runs_extend.sql

alter table public.pipeline_stage_runs
  add column if not exists run_id     uuid,
  add column if not exists error_code text;

comment on column public.pipeline_stage_runs.run_id is
  'Parent pipeline run id — groups stage runs into one end-to-end run (SM5)';
comment on column public.pipeline_stage_runs.error_code is
  'Classified failure code: timeout | rate_limit | auth_error | schema_gap | network_error | ai_error | db_error | parse_error | unknown (SM5)';

-- Stage-failure debugging queries filter by run and by error code.
create index if not exists idx_pipeline_stage_runs_run_id
  on public.pipeline_stage_runs (run_id)
  where run_id is not null;

create index if not exists idx_pipeline_stage_runs_error_code
  on public.pipeline_stage_runs (error_code)
  where error_code is not null;
