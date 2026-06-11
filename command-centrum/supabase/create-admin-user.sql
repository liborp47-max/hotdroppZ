-- ─────────────────────────────────────────────────────────────────────────────
-- HDCC — create the `admin` login (admin@hotdroppz.com / 12345678) + admin role.
--
-- WHY THIS FILE: the project has no SERVICE_ROLE_KEY / DB_URL available locally,
-- and `auth signup` currently returns HTTP 500 "Database error saving new user"
-- — i.e. the handle_new_user() trigger is failing on this Supabase project.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- It is idempotent: safe to run more than once.
--
-- NOTE: login is by email. The app maps the bare username "admin" → this email,
-- so on the login screen you can type:  admin  /  12345678
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- 1) Repair the profile auto-create trigger (the cause of the signup 500) ───────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'editor' check (role in ('admin','editor','viewer')),
  full_name  text,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, role)
  values (new.id, new.email, 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2) Create (or reset) the admin auth user, email pre-confirmed ─────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
  'authenticated', 'admin@hotdroppz.com', crypt('12345678', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
)
on conflict (email) do update
  set encrypted_password = crypt('12345678', gen_salt('bf')),
      email_confirmed_at = now(),
      updated_at         = now();

-- 3) Email identity (required by GoTrue for password sign-in) ───────────────────
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.id::text, now(), now(), now()
from auth.users u
where u.email = 'admin@hotdroppz.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 4) Promote the profile to admin role ─────────────────────────────────────────
insert into profiles (id, email, role)
select id, email, 'admin' from auth.users where email = 'admin@hotdroppz.com'
on conflict (id) do update set role = 'admin';

-- 5) Verify ────────────────────────────────────────────────────────────────────
select u.email, u.email_confirmed_at is not null as confirmed, p.role
from auth.users u
join profiles p on p.id = u.id
where u.email = 'admin@hotdroppz.com';
