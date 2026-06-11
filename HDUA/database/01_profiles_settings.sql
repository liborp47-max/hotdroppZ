-- HDUA-01 · 01 — User identity, settings, sessions, search history
-- Shared Supabase project with HDCC → all HDUA user tables are prefixed `hdua_`
-- to avoid collisions (HDCC already owns `profiles`). RLS = owner-only.
-- Apply: node command-centrum/scripts/apply-sql.mjs HDUA/database/01_profiles_settings.sql

-- ── Profile (1:1 with auth.users) ────────────────────────────────────────────
create table if not exists hdua_profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  username      text        unique,
  display_name  text,
  avatar_url    text,
  country       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Per-user settings (feed prefs, follows, locale, push opt-in) ──────────────
create table if not exists hdua_settings (
  user_id            uuid        primary key references auth.users(id) on delete cascade,
  language           text        not null default 'en',
  followed_artists   text[]      not null default '{}',
  followed_countries text[]      not null default '{}',
  followed_genres    text[]      not null default '{}',
  push_enabled       boolean     not null default true,
  -- GDPR: personalization signal collection opt-out (HDUA-09).
  personalization_opt_out boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- ── Sessions (DAU/MAU + session length — HDUA-12) ────────────────────────────
create table if not exists hdua_sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  duration_s   integer,
  platform     text
);
create index if not exists idx_hdua_sessions_user_started on hdua_sessions(user_id, started_at desc);

-- ── Search history ───────────────────────────────────────────────────────────
create table if not exists hdua_search_history (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  query       text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_hdua_search_user on hdua_search_history(user_id, created_at desc);

-- ── RLS: owner-only ──────────────────────────────────────────────────────────
alter table hdua_profiles       enable row level security;
alter table hdua_settings       enable row level security;
alter table hdua_sessions       enable row level security;
alter table hdua_search_history enable row level security;

drop policy if exists hdua_profiles_owner on hdua_profiles;
create policy hdua_profiles_owner on hdua_profiles
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists hdua_settings_owner on hdua_settings;
create policy hdua_settings_owner on hdua_settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists hdua_sessions_owner on hdua_sessions;
create policy hdua_sessions_owner on hdua_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists hdua_search_owner on hdua_search_history;
create policy hdua_search_owner on hdua_search_history
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-provision a profile row when a new auth user is created.
create or replace function hdua_handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into hdua_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into hdua_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists hdua_on_auth_user_created on auth.users;
create trigger hdua_on_auth_user_created
  after insert on auth.users
  for each row execute function hdua_handle_new_user();
