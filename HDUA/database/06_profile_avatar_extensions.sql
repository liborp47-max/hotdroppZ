-- HDUA-15 · 06 — Rich profile + avatar storage extensions (DRAFT / design-only)
-- Extends the existing HDUA-14 schema (01_profiles_settings.sql). Idempotent and
-- RLS-aware. Builds on what is ALREADY present — does NOT recreate columns.
--
-- ALREADY PRESENT (01_profiles_settings.sql), do not re-add:
--   hdua_profiles: id, username (UNIQUE), display_name, avatar_url, country,
--                  created_at, updated_at
--   hdua_settings: user_id, language, followed_artists[], followed_countries[],
--                  followed_genres[], push_enabled, personalization_opt_out, updated_at
--   RLS owner-only on both; hdua_handle_new_user trigger provisions both rows.
--
-- BLOCKER: SUPABASE_DB_URL / service-role key are EMPTY in this workspace, so this
-- file is design-only. Apply + verify once the credential is set:
--   node command-centrum/scripts/apply-sql.mjs HDUA/database/06_profile_avatar_extensions.sql
-- (or Supabase MCP apply_migration, as 05 was).

-- ── 1. Profile: add only the missing rich-profile columns ────────────────────
alter table hdua_profiles add column if not exists bio                  text;
alter table hdua_profiles add column if not exists onboarding_completed boolean not null default false;

-- bio length guard (idempotent: drop+add so re-runs don't error on duplicate name).
alter table hdua_profiles drop constraint if exists hdua_profiles_bio_len;
alter table hdua_profiles add  constraint hdua_profiles_bio_len check (bio is null or char_length(bio) <= 280);

-- username already UNIQUE (01). Add a case-insensitive uniqueness guard + a format
-- check so "Foo" and "foo" cannot both be claimed and handles stay URL-safe.
-- 3–30 chars, lowercase letters/digits/underscore. App should lower() before write.
alter table hdua_profiles drop constraint if exists hdua_profiles_username_fmt;
alter table hdua_profiles add  constraint hdua_profiles_username_fmt
  check (username is null or username ~ '^[a-z0-9_]{3,30}$');

create unique index if not exists idx_hdua_profiles_username_ci
  on hdua_profiles (lower(username)) where username is not null;

-- keep updated_at honest on profile writes
create or replace function hdua_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists hdua_profiles_touch on hdua_profiles;
create trigger hdua_profiles_touch before update on hdua_profiles
  for each row execute function hdua_touch_updated_at();

drop trigger if exists hdua_settings_touch on hdua_settings;
create trigger hdua_settings_touch before update on hdua_settings
  for each row execute function hdua_touch_updated_at();

-- RLS: existing hdua_profiles_owner / hdua_settings_owner (USING + WITH CHECK on
-- auth.uid()) already cover the new columns — owner-only read+write. No new policy
-- needed. (If public profile read is wanted later, add a SELECT-only policy then.)

-- ── 2. Avatar storage bucket + object RLS ────────────────────────────────────
-- Bucket: public read (avatars render in <Image>), owner-only write/update/delete.
-- Path convention enforced by policy: avatars/<auth.uid()>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hdua-avatars', 'hdua-avatars', true,
  5 * 1024 * 1024,                                   -- 5 MB cap
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read (bucket is public, but be explicit for the SELECT policy too).
drop policy if exists hdua_avatars_read on storage.objects;
create policy hdua_avatars_read on storage.objects
  for select using (bucket_id = 'hdua-avatars');

-- Owner can write/update/delete ONLY under their own uid folder.
-- storage.foldername(name)[1] is the first path segment.
drop policy if exists hdua_avatars_insert on storage.objects;
create policy hdua_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hdua-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists hdua_avatars_update on storage.objects;
create policy hdua_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'hdua-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'hdua-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists hdua_avatars_delete on storage.objects;
create policy hdua_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'hdua-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3. (No new tables needed.) ───────────────────────────────────────────────
-- getSaved()/getLiked() join hdua_saved_posts/hdua_liked_posts.post_id → hdua_feed_items.id.
-- post_id is intentionally NOT an FK (content lives in re-projected pipeline tables),
-- so the join is done client-side via .in('id', ids) — see API spec. No DDL here.
--
-- followed_artists management = array mutation on hdua_settings.followed_artists (text[]).
-- No new table; artists are name strings (matches Content API searchArtists / FeedItem.artist).
