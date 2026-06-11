-- HDUA-01 · 04 — Trending topics, alerts, notifications
-- trending_topics + alerts are pipeline-fed (Trend Engine / droppz-detector),
-- public-read. notifications are per-user (RLS owner-only).

create table if not exists hdua_trending_topics (
  id          uuid        primary key default gen_random_uuid(),
  topic       text        not null,
  category    text,
  score       numeric     not null default 0,
  delta_pct   numeric,
  rank        integer,
  time_window text        not null default '24h',  -- `window` is a reserved word
  updated_at  timestamptz not null default now()
);
create index if not exists idx_hdua_trending_rank on hdua_trending_topics(time_window, rank);

-- P0/P1 drop alerts (Radar). Public-read; written by pipeline (service role).
create table if not exists hdua_alerts (
  id          uuid        primary key default gen_random_uuid(),
  priority    text        not null check (priority in ('P0','P1','P2','P3')),
  title       text        not null,
  body        text,
  post_id     uuid,
  artist      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_hdua_alerts_created on hdua_alerts(created_at desc);

-- Per-user notifications (follows, replies, drops from followed artists).
create table if not exists hdua_notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null,
  title       text        not null,
  body        text,
  post_id     uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_hdua_notif_user on hdua_notifications(user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table hdua_trending_topics enable row level security;
alter table hdua_alerts          enable row level security;
alter table hdua_notifications   enable row level security;

-- Public content: any authenticated user can read; only service role writes.
drop policy if exists hdua_trending_read on hdua_trending_topics;
create policy hdua_trending_read on hdua_trending_topics
  for select using (auth.role() = 'authenticated');

drop policy if exists hdua_alerts_read on hdua_alerts;
create policy hdua_alerts_read on hdua_alerts
  for select using (auth.role() = 'authenticated');

drop policy if exists hdua_notif_owner on hdua_notifications;
create policy hdua_notif_owner on hdua_notifications
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
