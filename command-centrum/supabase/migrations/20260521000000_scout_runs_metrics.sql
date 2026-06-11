-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260521000000_scout_runs_metrics
-- UM-SCOUT #05 — Scout run metriky.
-- Adds the per-run counters the Scout pipeline logs alongside items_found:
--   items_inserted — raw scout_items actually persisted this run (after dedupe)
--   error_count    — number of sources that failed to fetch/parse
-- Idempotent.
-- ──────────────────────────────────────────────────────────────────────────────

alter table scout_runs add column if not exists items_inserted integer not null default 0;
alter table scout_runs add column if not exists error_count    integer not null default 0;
