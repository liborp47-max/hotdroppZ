-- ============================================================
-- HOTDROPPZ — ARTIST DATABASE EXTENSION PHASE 2
-- Extends existing ARTIST_INTELLIGENCE.sql schema
-- Adds: artist_links, artist_images, aliases/description/city,
--       release thumbnails, priority score aliases
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTEND ARTISTS TABLE with new fields required by CRM
-- ─────────────────────────────────────────────────────────────────────────────

-- Aliases (alternative names, stage names)
alter table if exists artists add column if not exists aliases text[] not null default '{}';

-- City (for regional filtering)
alter table if exists artists add column if not exists city text;

-- Description (biography / artist notes)
alter table if exists artists add column if not exists description text;

-- Tracking enabled flag (separate from active status for soft-rolloff)
-- Note: existing `is_active` column exists; this adds explicit tracking control
alter table if exists artists add column if not exists tracking_enabled boolean not null default true;

-- Priority score alias (base_score already exists as numeric(4,2); add integer alias for UI)
-- We'll keep base_score as the source of truth; add computed column or just use base_score directly
-- No change needed: base_score is the priority score (0-100)

-- Indexes
create index if not exists idx_artists_city on artists(city) where city is not null;
create index if not exists idx_artists_aliases on artists using gin(aliases);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ARTIST_LINKS — separate table for platform-specific URLs and IDs with verification
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artist_links (
  id                uuid        primary key default gen_random_uuid(),
  artist_id         uuid        not null references artists(id) on delete cascade,

  -- Platform URLs
  spotify_url       text,
  apple_music_url   text,
  youtube_url       text,
  youtube_channel_id text,
  instagram_url     text,
  facebook_url      text,
  tiktok_url        text,
  soundcloud_url    text,
  genius_url        text,

  -- Platform-specific IDs (for API integration)
  spotify_id        text,
  apple_music_id    text,
  youtube_channel_id_hash text,  -- safe-to-store channel identifier
  instagram_handle  text,
  tiktok_handle     text,

  -- Verification status per platform
  spotify_verified  boolean     not null default false,
  apple_verified    boolean     not null default false,
  youtube_verified  boolean     not null default false,
  instagram_verified boolean    not null default false,
  facebook_verified boolean     not null default false,
  tiktok_verified   boolean     not null default false,
  soundcloud_verified boolean   not null default false,
  genius_verified   boolean     not null default false,

  -- Last enrichment run timestamp
  last_enriched_at  timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes
create index if not exists idx_artist_links_artist on artist_links(artist_id);
create index if not exists idx_artist_links_spotify on artist_links(spotify_id) where spotify_id is not null;
create index if not exists idx_artist_links_youtube on artist_links(youtube_channel_id) where youtube_channel_id is not null;
create index if not exists idx_artist_links_instagram on artist_links(instagram_handle) where instagram_handle is not null;
create index if not exists idx_artist_links_tiktok on artist_links(tiktok_handle) where tiktok_handle is not null;

-- Unique constraint: one link record per artist
create unique index if not exists idx_artist_links_artist_unique on artist_links(artist_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ARTIST_IMAGES — profile picture, cover image, gallery
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists artist_images (
  id                uuid        primary key default gen_random_uuid(),
  artist_id         uuid        not null references artists(id) on delete cascade,

  -- Image storage (Supabase storage path)
  image_url         text        not null,  -- full URL or storage path
  storage_path     text,                    -- e.g. 'artists/{artist_id}/profile.jpg'

  -- Image type
  type              text        not null check (type in ('profile','cover','gallery','banner')),

  -- Metadata
  width             integer,
  height            integer,
  file_size         integer,     -- bytes
  mime_type         text,
  uploaded_at       timestamptz not null default now()
);

-- Indexes
create index if not exists idx_artist_images_artist on artist_images(artist_id);
create index if not exists idx_artist_images_type on artist_images(artist_id, type);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EXTEND ARTIST_RELEASES with thumbnail field
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists artist_releases add column if not exists thumbnail text;
alter table if exists artist_releases add column if not exists spotify_id text;
alter table if exists artist_releases add column if not exists apple_music_id text;
alter table if exists artist_releases add column if not exists youtube_id text;
alter table if exists artist_releases add column if not exists genius_id text;

-- Index for release lookups by platform ID
create index if not exists idx_artist_releases_spotify_id on artist_releases(spotify_id) where spotify_id is not null;
create index if not exists idx_artist_releases_youtube_id on artist_releases(youtube_id) where youtube_id is not null;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS POLICIES for new tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table artist_links enable row level security;
alter table artist_images enable row level security;

-- Artist links: read for authenticated, write for admin/editor
drop policy if exists "artist_links: read" on artist_links;
drop policy if exists "artist_links: write" on artist_links;
create policy "artist_links: read" on artist_links
  for select using (auth.role() = 'authenticated');
create policy "artist_links: write" on artist_links
  for all using (get_user_role() in ('admin','editor'));

-- Artist images: read for authenticated, write for admin/editor
drop policy if exists "artist_images: read" on artist_images;
drop policy if exists "artist_images: write" on artist_images;
create policy "artist_images: read" on artist_images
  for select using (auth.role() = 'authenticated');
create policy "artist_images: write" on artist_images
  for all using (get_user_role() in ('admin','editor'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGERS for updated_at
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at on artist_links changes
create or replace function update_artist_links_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artist_links_set_updated_at on artist_links;
create trigger artist_links_set_updated_at
  before update on artist_links
  for each row execute function update_artist_links_updated_at();

-- Auto-update updated_at on artist_images changes
create or replace function update_artist_images_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artist_images_set_updated_at on artist_images;
create trigger artist_images_set_updated_at
  before update on artist_images
  for each row execute function update_artist_images_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REALTIME subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin alter publication supabase_realtime add table artist_links; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table artist_images; exception when duplicate_object then null; end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- Tables added:     artist_links, artist_images
-- Columns added:    artists.aliases, artists.city, artists.description,
--                    artists.tracking_enabled
--                    artist_releases.thumbnail, spotify_id, apple_music_id,
--                    youtube_id, genius_id
-- Views modified:   none
-- ============================================================
