-- Migration: creator_queue table + atomic claim primitive (UM-CC_DATA_CONSISTENCY SM3)
--
-- Replaces ai/scout_hq/creator_queue.json as the source of truth for Creator
-- jobs. Encodes the lock + idempotency requirements at the DB layer:
--   - idempotency : package_id is UNIQUE → re-enqueue is a no-op on conflict
--   - locking     : claim_creator_job() uses FOR UPDATE SKIP LOCKED so
--                   concurrent workers never claim the same row
--   - lease       : claim_expires_at lets a crashed worker's job be reclaimed
--
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/migrations/20260522000003_creator_queue.sql
--
-- NOTE: the Python Creator runner (ai/scout_hq/run_creator_engine.py) must be
-- rewired to enqueue/claim via this table — that file is outside this mission's
-- modulePath and is proposed as a separate sub-mission.

create table if not exists public.creator_queue (
  id               uuid        primary key default gen_random_uuid(),
  package_id       text        not null unique,        -- idempotency dedup key
  artist_name      text,
  template         text,
  payload          jsonb       not null default '{}',  -- caption_variants etc.
  status           text        not null default 'pending',
  attempts         integer     not null default 0,
  claimed_by       text,
  claimed_at       timestamptz,
  claim_expires_at timestamptz,
  error            text,
  generate_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'creator_queue_status_check') then
    alter table public.creator_queue
      add constraint creator_queue_status_check
      check (status in ('pending', 'claimed', 'done', 'failed'));
  end if;
end $$;

-- Worker dispatch scans pending + expired-lease rows by age.
create index if not exists idx_creator_queue_dispatch
  on public.creator_queue (status, created_at)
  where status in ('pending', 'claimed');

comment on table public.creator_queue is
  'Creator job queue — Supabase source of truth, replaces creator_queue.json (SM3)';
comment on column public.creator_queue.package_id is
  'Idempotency key — UNIQUE; enqueue uses ON CONFLICT DO NOTHING';

-- Atomic claim: returns at most one job, locking it against concurrent workers.
-- FOR UPDATE SKIP LOCKED is the standard Postgres concurrent-queue primitive.
create or replace function public.claim_creator_job(
  p_worker text,
  p_lease_seconds integer default 300
)
returns setof public.creator_queue
language sql
as $$
  update public.creator_queue q set
    status           = 'claimed',
    claimed_by       = p_worker,
    claimed_at       = now(),
    claim_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempts         = q.attempts + 1,
    updated_at       = now()
  where q.id = (
    select c.id
    from public.creator_queue c
    where c.status = 'pending'
       or (c.status = 'claimed' and c.claim_expires_at < now())  -- reclaim crashed leases
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning q.*;
$$;
