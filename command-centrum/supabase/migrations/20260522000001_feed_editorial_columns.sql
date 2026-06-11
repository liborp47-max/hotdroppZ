-- Migration: feed_posts editorial workflow columns (UM-FEED_UI)
--
-- The feed editorial workflow (8 UI pages + /api/feed/* routes + lib/supabase.ts
-- helpers) is built against the editorial FeedPostRow shape, but feed_posts only
-- had the pipeline columns + the HDUA extension. These additive columns make the
-- table match lib/supabase.ts `FeedPostRow` so the feed module is functional.
--
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/migrations/20260522000001_feed_editorial_columns.sql
--
-- NOTE: `priority` already exists on feed_posts as TEXT ('P0'-'P3', from
-- schema-feed-posts-extension.sql). lib/supabase.ts FeedPostRow treats priority
-- as a number. This column is intentionally LEFT UNTOUCHED here — the TEXT vs
-- number conflict needs a deliberate decision (HDUA frontend-web reads it).

alter table public.feed_posts
  add column if not exists story_package_id text,
  add column if not exists headline         text,
  add column if not exists artist_name      text,
  add column if not exists status           text not null default 'draft',
  add column if not exists source           text not null default 'writer',
  add column if not exists platforms        text[] not null default '{}',
  add column if not exists languages        text[] not null default '{en}',
  add column if not exists schedule_data    jsonb,
  add column if not exists approval_notes   text,
  add column if not exists rejected_reason  text,
  add column if not exists metadata         jsonb not null default '{}',
  add column if not exists updated_at       timestamptz not null default now(),
  add column if not exists approved_at      timestamptz,
  add column if not exists rejected_at      timestamptz;

-- Constrain the editorial enums.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feed_posts_editorial_status_check') then
    alter table public.feed_posts
      add constraint feed_posts_editorial_status_check
      check (status in ('draft', 'scheduled', 'published'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'feed_posts_source_check') then
    alter table public.feed_posts
      add constraint feed_posts_source_check
      check (source in ('writer', 'creator'));
  end if;
end $$;

-- Backfill editorial columns from the existing pipeline columns so rows that
-- predate the editorial workflow still render (same data, editorial names).
update public.feed_posts set headline    = title  where headline    is null and title  is not null;
update public.feed_posts set artist_name = artist where artist_name is null and artist is not null;
update public.feed_posts set updated_at  = created_at where updated_at is null and created_at is not null;

comment on column public.feed_posts.status is 'Editorial workflow status: draft | scheduled | published (UM-FEED_UI)';
comment on column public.feed_posts.schedule_data is 'Per-platform schedule payload from the feed calendar stage (UM-FEED_UI)';
comment on column public.feed_posts.approval_notes is 'Reviewer notes recorded on approval (UM-FEED_UI approval stage)';

-- Editorial stage queries filter heavily by status.
create index if not exists idx_feed_posts_editorial_status on public.feed_posts (status);
