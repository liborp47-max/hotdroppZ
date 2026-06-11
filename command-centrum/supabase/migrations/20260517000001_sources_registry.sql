-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260517000001_sources_registry
-- PR-S1 — Sources Registry (canonical polymorphic sources model)
-- Spec: SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/03-registry-schema.md
--
-- Scope (sub-mission #01): create the 5 registry tables + indexes + RLS policies.
-- Out of scope (separate sub-missions / migrations):
--   _002 backfill · _003 backwards-compat views · #04 triggers (updated_at,
--   audit log, platform_identifiers sync).
-- Dependency: get_user_role() helper (canonical def in MASTER_SCHEMA.sql).
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────────
-- sources — master polymorphic entity (type-specific payload in metadata jsonb)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists sources (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in (
                      'artist','playlist','feed','chart','topic','asset')),
  name              text not null,
  slug              text unique,
  status            text not null default 'active' check (status in (
                      'active','paused','archived','broken')),
  category          text,                       -- 'rap_core' (feed) / 'spotify_top_50' (chart)
  region            text,                       -- 'US','EU','CZ','global'
  language          text,                       -- 'en','cs','de'
  authority_score   integer default 50 check (authority_score between 0 and 100),
  health            text default 'unknown' check (health in (
                      'green','amber','red','unknown')),
  last_validated_at timestamptz,
  metadata          jsonb default '{}'::jsonb,  -- type-specific payload
  tags              text[] default '{}',
  owner_user_id     uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_sources_type      on sources (type)                  where status = 'active';
create index if not exists idx_sources_authority on sources (authority_score desc)   where status = 'active';
create index if not exists idx_sources_health    on sources (health);
create index if not exists idx_sources_tags      on sources using gin (tags);
create index if not exists idx_sources_metadata  on sources using gin (metadata);
create index if not exists idx_sources_fts       on sources using gin (to_tsvector('simple', name));

-- ──────────────────────────────────────────────────────────────────────────────
-- source_handles — per-platform handles (replaces artist_links)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists source_handles (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references sources (id) on delete cascade,
  platform    text not null,                    -- 'spotify_playlists','apple_music','youtube','rss',...
  handle      text not null,                    -- platform-specific id (track id, channel id, RSS url)
  url         text,                             -- canonical url
  verified    boolean not null default false,
  verified_at timestamptz,
  verified_by text,                             -- 'manual','spotify_gateway','crawler'
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (platform, handle)
);

create index if not exists idx_source_handles_source   on source_handles (source_id);
create index if not exists idx_source_handles_platform on source_handles (platform);

-- ──────────────────────────────────────────────────────────────────────────────
-- platform_identifiers — canonical id mapping per entity per platform
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists platform_identifiers (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
                'artist','release','playlist','album','track','channel')),
  entity_id   uuid not null,                    -- FK target lives in artists / artist_releases / etc.
  platform    text not null,
  platform_id text not null,                    -- e.g. Spotify '3TVXtAsR1Inumwj472S9r4'
  verified    boolean not null default false,
  verified_at timestamptz,
  verified_by text,
  confidence  numeric(3,2) not null default 1.00,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entity_type, entity_id, platform),    -- one id per entity per platform
  unique (platform, platform_id)                -- no duplicate platform_id
);

create index if not exists idx_platform_identifiers_entity   on platform_identifiers (entity_type, entity_id);
create index if not exists idx_platform_identifiers_platform on platform_identifiers (platform, platform_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- source_assignments — consumer ↔ source relationship
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists source_assignments (
  id                uuid primary key default gen_random_uuid(),
  source_id         uuid not null references sources (id) on delete cascade,
  consumer_type     text not null check (consumer_type in (
                      'worker','writer','curator','enrichment','creator','intelligence','distribution')),
  consumer_id       text not null,              -- 'wkr-spotify-artists','writer-default','ceo-mission-M-42'
  priority          integer not null default 50,
  schedule_override text,
  enabled           boolean not null default true,
  metadata          jsonb default '{}'::jsonb,
  assigned_at       timestamptz not null default now(),
  assigned_by       text,
  unique (source_id, consumer_type, consumer_id)
);

create index if not exists idx_source_assignments_consumer
  on source_assignments (consumer_type, consumer_id) where enabled = true;
create index if not exists idx_source_assignments_source
  on source_assignments (source_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- source_history — audit log (append-only; populated by triggers in sub-mission #04)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists source_history (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references sources (id) on delete cascade,
  actor_user_id  uuid,
  actor_agent    text,                          -- 'system:enrichment','worker:wkr-spotify-artists'
  action         text not null check (action in (
                   'created','updated','archived','validated',
                   'health_changed','assignment_added','assignment_removed')),
  changes        jsonb,                         -- { field: { old, new } }
  reason         text,
  worker_version text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_source_history_source on source_history (source_id, created_at desc);
create index if not exists idx_source_history_actor  on source_history (actor_agent, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS — read: all authenticated · write: role-gated.
-- service_role bypasses RLS entirely (pipeline workers / triggers write freely).
-- ──────────────────────────────────────────────────────────────────────────────
alter table sources              enable row level security;
alter table source_handles       enable row level security;
alter table platform_identifiers enable row level security;
alter table source_assignments   enable row level security;
alter table source_history       enable row level security;

-- sources — write: admin/editor
drop policy if exists "sources_select" on sources;
create policy "sources_select" on sources
  for select to authenticated using (true);
drop policy if exists "sources_write" on sources;
create policy "sources_write" on sources
  for all to authenticated
  using (get_user_role() in ('admin','editor'))
  with check (get_user_role() in ('admin','editor'));

-- source_handles — write: admin/editor
drop policy if exists "source_handles_select" on source_handles;
create policy "source_handles_select" on source_handles
  for select to authenticated using (true);
drop policy if exists "source_handles_write" on source_handles;
create policy "source_handles_write" on source_handles
  for all to authenticated
  using (get_user_role() in ('admin','editor'))
  with check (get_user_role() in ('admin','editor'));

-- source_assignments — write: admin/editor
drop policy if exists "source_assignments_select" on source_assignments;
create policy "source_assignments_select" on source_assignments
  for select to authenticated using (true);
drop policy if exists "source_assignments_write" on source_assignments;
create policy "source_assignments_write" on source_assignments
  for all to authenticated
  using (get_user_role() in ('admin','editor'))
  with check (get_user_role() in ('admin','editor'));

-- platform_identifiers — write: admin (workers write via service_role, which bypasses RLS)
drop policy if exists "platform_identifiers_select" on platform_identifiers;
create policy "platform_identifiers_select" on platform_identifiers
  for select to authenticated using (true);
drop policy if exists "platform_identifiers_write" on platform_identifiers;
create policy "platform_identifiers_write" on platform_identifiers
  for all to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

-- source_history — read-only for users; writes reserved for triggers + service_role
drop policy if exists "source_history_select" on source_history;
create policy "source_history_select" on source_history
  for select to authenticated using (true);
