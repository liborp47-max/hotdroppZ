-- Migration: feed_posts.scheduled_at column
-- UM-FEED_SCHEMA_AND_EDITOR_DONE sub-01.
--
-- `scheduled_at` is referenced by lib/feed/calendar.ts (deriveScheduledAt) and
-- app/api/cron/feed-publish/route.ts (auto-publish filter) but no prior
-- migration defines it. The editorial workflow + cron worker silently fail
-- without this column. Idempotent.
--
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/migrations/20260523000001_feed_scheduled_at.sql

alter table public.feed_posts
  add column if not exists scheduled_at timestamptz;

-- Auto-publish cron filters on scheduled_at. Partial predicate must be
-- IMMUTABLE, so we cannot reference now(); the planner uses the partial only
-- when the query's WHERE matches, and the cron query (`scheduled_at <= now()
-- AND status = 'scheduled'`) reuses this btree fine without the predicate.
create index if not exists idx_feed_posts_scheduled_at
  on public.feed_posts (scheduled_at)
  where scheduled_at is not null;

comment on column public.feed_posts.scheduled_at is
  'Editorial scheduled publish timestamp; auto-publish cron sets status=published when scheduled_at <= now() (UM-FEED_SCHEMA_AND_EDITOR_DONE)';
